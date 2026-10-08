import { randomUUID } from "node:crypto";
import { test, expect } from "../../fixtures/test";
import { DEFAULT_PASSWORD, json, uniqueName } from "../../helpers/api";
import { rawLogText, readLogLines, waitForLog, waitForSentryEvent } from "../../helpers/logs";
import { RAWG_FAILURE_QUERY } from "../../fixtures/catalog.mjs";
import { API_URL } from "../../env";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

test.describe("Logging & error monitoring (backend)", () => {
  test.describe("request ids", () => {
    test("every response carries a generated X-Request-Id @positive", async ({ anon }) => {
      const res = await anon.get("/health");
      expect(res.headers()["x-request-id"]).toMatch(UUID);
    });

    test("a well-formed incoming X-Request-Id is reused for correlation @positive", async ({ request }) => {
      const id = `e2e-${randomUUID()}`;
      const res = await request.get(`${API_URL}/health`, { headers: { "X-Request-Id": id } });
      expect(res.headers()["x-request-id"]).toBe(id);
    });

    test("a malformed incoming X-Request-Id is replaced, not trusted @negative", async ({ request }) => {
      const res = await request.get(`${API_URL}/health`, { headers: { "X-Request-Id": "bad id <script>" } });
      expect(res.headers()["x-request-id"]).toMatch(UUID);
    });
  });

  test.describe("JSON log files (offline record)", () => {
    test("each request is logged with method, path, status, duration, request and user id @positive", async ({ api, user }) => {
      const res = await api.get("/game");
      const requestId = res.headers()["x-request-id"];
      const line = await waitForLog((l) => l.requestId === requestId && l.type === "http");
      expect(line).toMatchObject({ method: "GET", path: "/game", status: 200, module: "http", service: "roninarc-backend" });
      expect(line.durationMs).toEqual(expect.any(Number));
      expect(line.userId).toEqual(expect.any(String));
      expect(line.msg).toMatch(/^GET \/game 200 \d+ms$/);
      expect(Date.parse(line.time)).not.toBeNaN();
      void user;
    });

    test("client errors (4xx) are logged at warn level @negative", async ({ api }) => {
      const res = await api.get("/game/not-an-id");
      const line = await waitForLog((l) => l.requestId === res.headers()["x-request-id"] && l.type === "http");
      expect(line).toMatchObject({ status: 400, level: 40 });
    });

    test("query strings are never written to the log @negative", async ({ api }) => {
      const secret = `qs${randomUUID().slice(0, 8)}`;
      const res = await api.get("/rawg/search", { query: secret });
      const line = await waitForLog((l) => l.requestId === res.headers()["x-request-id"] && l.type === "http");
      expect(line.path).toBe("/rawg/search");
      expect(rawLogText()).not.toContain(secret);
    });

    test("passwords and tokens are never written to the log @negative", async ({ anon }) => {
      const password = `Pw-${randomUUID()}`;
      const username = uniqueName("logpw");
      const reg = await anon.post("/auth/register", { username, password });
      const { accessToken, refreshToken } = (await json(reg)).Data;
      await anon.post("/auth/login", { username, password: `${password}-wrong` });
      await waitForLog((l) => l.requestId === reg.headers()["x-request-id"]);
      const text = rawLogText();
      for (const secret of [password, accessToken, refreshToken]) expect(text).not.toContain(secret);
    });

    test("malformed JSON bodies get a clean 400 instead of a 500 @negative", async ({ request }) => {
      const res = await request.post(`${API_URL}/auth/login`, {
        headers: { "Content-Type": "application/json" },
        data: "{ not json",
      });
      expect(res.status()).toBe(400);
      expect(await json(res)).toEqual({ Status: "Fail", error: "Malformed JSON body" });
    });
  });

  test.describe("server errors", () => {
    test("a 5xx is logged with its stack and reported to Sentry, tagged with the request id @positive", async ({ api }) => {
      const res = await api.get("/rawg/search", { query: RAWG_FAILURE_QUERY });
      expect(res.status()).toBe(502);
      const requestId = res.headers()["x-request-id"];

      const errorLine = await waitForLog((l) => l.requestId === requestId && l.level === 50 && !l.type);
      expect(errorLine.msg).toBe("Failed to fetch RAWG data");
      expect((errorLine.err as any).stack).toContain("Failed to fetch RAWG data");
      expect(errorLine).toMatchObject({ path: "/rawg/search", statusCode: 502 });

      const event = await waitForSentryEvent((e) => e.project === "1" && e.tags.requestId === requestId);
      expect(event).toMatchObject({ message: "Failed to fetch RAWG data", environment: "e2e", platform: "node", hasStack: true });
      // ...and nothing sensitive leaves the machine with it. (Sentry also
      // de-duplicates identical consecutive errors, so one event covers both checks.)
      expect(JSON.stringify(event.request ?? {})).not.toContain("Bearer");
      expect(event.request?.data).toBeUndefined();
    });

    test("expected client errors are not sent to Sentry @negative", async ({ api }) => {
      const res = await api.get("/game/not-an-id");
      await waitForLog((l) => l.requestId === res.headers()["x-request-id"]);
      await new Promise((r) => setTimeout(r, 1500));
      const { sentryEvents } = await import("../../helpers/logs");
      expect((await sentryEvents()).some((e) => e.tags.requestId === res.headers()["x-request-id"])).toBe(false);
    });
  });

  test.describe("client log ingestion (POST /logs/client)", () => {
    const entry = (over: Record<string, unknown> = {}) => ({
      level: "error",
      message: `client-${randomUUID()}`,
      stack: "Error: boom\n    at App.tsx:10:5",
      context: { route: "#/library" },
      url: "http://localhost/#/",
      timestamp: new Date().toISOString(),
      sessionId: "s-1",
      ...over,
    });

    test("accepts a batch and writes each entry to the log with the user id @positive", async ({ api }) => {
      const a = entry();
      const b = entry({ level: "warn", requestId: "client-req-1" });
      const res = await api.post("/logs/client", { entries: [a, b] });
      expect(res.status()).toBe(202);
      expect((await json(res)).Data).toEqual({ accepted: 2 });

      const lineA = await waitForLog((l) => l.msg === a.message);
      expect(lineA).toMatchObject({ source: "client", module: "client", level: 50, stack: a.stack, sessionId: "s-1" });
      expect(lineA.userId).toEqual(expect.any(String));
      const lineB = await waitForLog((l) => l.msg === b.message);
      expect(lineB).toMatchObject({ level: 40, clientRequestId: "client-req-1" });
    });

    test("works without authentication (e.g. a crash on the login page) @positive", async ({ anon }) => {
      const e = entry();
      expect((await anon.post("/logs/client", { entries: [e] })).status()).toBe(202);
      const line = await waitForLog((l) => l.msg === e.message);
      expect(line.userId).toBeUndefined();
    });

    for (const [label, body, error] of [
      ["missing entries", {}, "entries must be a non-empty array"],
      ["empty entries", { entries: [] }, "entries must be a non-empty array"],
      ["too many entries", { entries: Array.from({ length: 51 }, () => entry()) }, "at most 50 entries per request"],
      ["unknown level", { entries: [entry({ level: "panic" })] }, "entries[0]: level must be one of debug, info, warn, error"],
      ["missing message", { entries: [entry({ message: "" })] }, "entries[0]: message is required"],
      ["oversized message", { entries: [entry({ message: "x".repeat(2001) })] }, "entries[0]: message exceeds 2000 characters"],
      ["oversized context", { entries: [entry({ context: { blob: "x".repeat(5000) } })] }, "entries[0]: context exceeds 4000 bytes"],
      ["non-object entry", { entries: ["just a string"] }, "entries[0]: must be an object"],
    ] as const) {
      test(`rejects ${label} with 400 @negative`, async ({ api }) => {
        const res = await api.post("/logs/client", body);
        expect(res.status()).toBe(400);
        expect((await json(res)).error).toBe(error);
      });
    }

    test("rate-limits a flood of entries from one user @negative", async ({ api }) => {
      const statuses: number[] = [];
      for (let i = 0; i < 7; i++) {
        const batch = Array.from({ length: 50 }, () => entry({ level: "debug", message: "flood" }));
        statuses.push((await api.post("/logs/client", { entries: batch })).status());
      }
      expect(statuses.slice(0, 6)).toEqual([202, 202, 202, 202, 202, 202]);
      expect(statuses[6]).toBe(429);
    });

    test("log lines are valid JSON with ISO timestamps @positive", async ({ anon }) => {
      const e = entry({ level: "info" });
      await anon.post("/logs/client", { entries: [e] });
      await waitForLog((l) => l.msg === e.message);
      for (const line of readLogLines().slice(-50)) {
        expect(typeof line.level).toBe("number");
        expect(Date.parse(line.time)).not.toBeNaN();
      }
    });
  });

  test("a stale password on login is never echoed back @negative", async ({ anon }) => {
    const res = await anon.post("/auth/login", { username: uniqueName("nobody"), password: DEFAULT_PASSWORD });
    expect(JSON.stringify(await json(res))).not.toContain(DEFAULT_PASSWORD);
  });
});
