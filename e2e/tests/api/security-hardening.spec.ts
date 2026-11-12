import crypto from "node:crypto";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { test, expect } from "../../fixtures/test";
import { Api, json, registerUser, uniqueName } from "../../helpers/api";
import { byName } from "../../fixtures/catalog.mjs";
import { API_URL, CLOUD_URL, IGDB_PORT, LOG_DIR, MONGO_URL, RESEND_URL } from "../../env";
import { CLOUD_DB, PC_DATABASE, indexNames, insertLegacyRefreshToken, insertRaw, storedRefreshTokens } from "../../helpers/db";

// Findings from the 2026-11-11 security and engineering review (issues/SECURITY-AND-ENGINEERING-FEEDBACK.md).

const oid = () => crypto.randomBytes(12).toString("hex");
const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");
const ahead = (ms: number) => ({ $date: new Date(Date.now() + ms).toISOString() });
const chat = async (api: Api, message: string) => json(await api.post("/ai/chat", { message }));

test.describe("RA-004: a pushed document can't point at someone else's data", () => {
  test("foreign game ids in a collection, review, note, play session or activity are dropped, and nothing foreign is read back @negative", async ({ request }) => {
    const alice = await registerUser(request, CLOUD_URL);
    const bob = await registerUser(request, CLOUD_URL);
    const aliceApi = new Api(request, CLOUD_URL, alice.accessToken);
    const bobApi = new Api(request, CLOUD_URL, bob.accessToken);
    const aliceGame = await aliceApi.addGame(byName("Hades"));
    const bobGame = await bobApi.addGame(byName("Celeste"));

    const stolenCollection = oid();
    const res = await request.post(`${CLOUD_URL}/sync/push`, {
      headers: { Authorization: `Bearer ${bob.accessToken}` },
      data: {
        changes: {
          collections: [{ _id: { $oid: stolenCollection }, name: "Stolen", gameIds: [{ $oid: aliceGame._id }, { $oid: bobGame._id }], updatedAt: ahead(-1000) }],
          reviews: [{ _id: { $oid: oid() }, gameId: { $oid: aliceGame._id }, rating: 1, updatedAt: ahead(-1000) }],
          notes: [{ _id: { $oid: oid() }, gameId: { $oid: aliceGame._id }, content: "mine now", updatedAt: ahead(-1000) }],
          playSessions: [{ _id: { $oid: oid() }, gameId: { $oid: aliceGame._id }, startedAt: ahead(-60000), updatedAt: ahead(-1000) }],
          activities: [{ _id: { $oid: oid() }, type: "GAME_ADDED", message: "x", gameId: { $oid: aliceGame._id }, updatedAt: ahead(-1000) }],
        },
      },
    });
    expect(res.status(), await res.text()).toBe(200);
    const body = await res.json();
    // The collection is taken without the foreign id; the documents whose only reference is foreign are not.
    expect(Object.keys(body.accepted)).toEqual(["collections"]);

    const collections = (await json(await bobApi.get("/collection"))).Data;
    const stolen = collections.find((c: any) => c.name === "Stolen");
    expect(stolen.gameIds.map((g: any) => g._id)).toEqual([bobGame._id]);

    for (const [label, call] of [
      ["collections", () => bobApi.get("/collection")],
      ["notes", () => bobApi.get(`/notes/${aliceGame._id}`)],
      ["review", () => bobApi.get(`/review/${aliceGame._id}`)],
      ["play sessions", () => bobApi.get("/play-session/recent")],
      ["activity", () => bobApi.get("/activity")],
      ["dashboard", () => bobApi.get("/dashboard/stats")],
    ] as const) {
      const text = await (await call()).text();
      expect(text, label).not.toContain("Hades");
      expect(text, label).not.toContain(aliceGame._id);
    }
  });

  test("reads never populate another account's game even if a bad reference is already stored @negative", async ({ request }) => {
    const alice = await registerUser(request, CLOUD_URL);
    const bob = await registerUser(request, CLOUD_URL);
    const aliceGame = await new Api(request, CLOUD_URL, alice.accessToken).addGame(byName("Hades"));
    const bobApi = new Api(request, CLOUD_URL, bob.accessToken);
    const bobGame = await bobApi.addGame(byName("Celeste"));
    const now = new Date();

    // Written straight into the database, past every check the API has.
    const uid = await userId(request, bob.accessToken);
    await insertRaw(CLOUD_DB, "collections", { userId: uid, name: "Planted", gameIds: [aliceGame._id, bobGame._id], createdAt: now, updatedAt: now });
    await insertRaw(CLOUD_DB, "activities", { userId: uid, type: "GAME_ADDED", message: "planted", gameId: aliceGame._id, createdAt: now, updatedAt: now });
    await insertRaw(CLOUD_DB, "playsessions", { userId: uid, gameId: aliceGame._id, startedAt: now, endedAt: now, durationMinutes: 5, createdAt: now, updatedAt: now });

    for (const [label, call] of [
      ["collections", () => bobApi.get("/collection")],
      ["activity", () => bobApi.get("/activity")],
      ["play sessions", () => bobApi.get("/play-session/recent")],
      ["dashboard", () => bobApi.get("/dashboard/stats")],
    ] as const) {
      const text = await (await call()).text();
      expect(text, label).not.toContain("Hades");
      expect(text, label).not.toContain(aliceGame._id);
    }
  });
});

async function userId(request: any, accessToken: string): Promise<string> {
  const me = await json(await request.get(`${CLOUD_URL}/auth/me`, { headers: { Authorization: `Bearer ${accessToken}` } }));
  return String(me.Data.id);
}

test.describe("RA-008: a device can't claim a far-future time", () => {
  test("a pushed document dated 2099 is stored as at most a few minutes ahead @negative", async ({ request }) => {
    const user = await registerUser(request, CLOUD_URL);
    const api = new Api(request, CLOUD_URL, user.accessToken);
    const game = await api.addGame(byName("Hades"));
    const noteId = oid();
    const res = await request.post(`${CLOUD_URL}/sync/push`, {
      headers: { Authorization: `Bearer ${user.accessToken}` },
      data: { changes: { notes: [{ _id: { $oid: noteId }, gameId: { $oid: game._id }, content: "from the future", updatedAt: { $date: "2099-01-01T00:00:00.000Z" } }] } },
    });
    expect(res.status()).toBe(200);
    const accepted = (await res.json()).accepted?.notes;
    expect(accepted).toHaveLength(1);
    expect(new Date(accepted[0].updatedAt).getTime()).toBeLessThan(Date.now() + 6 * 60_000);
  });
});

test.describe("RA-006: one account per email, even when sign-ups race", () => {
  for (const [label, base] of [
    ["the cloud", CLOUD_URL],
    ["a PC", API_URL],
  ] as const) {
    test(`six simultaneous sign-ups for one email (in different letter cases) make exactly one account on ${label} @negative`, async ({ request }) => {
      const stem = uniqueName("race");
      const email = `${stem}@example.com`;
      const results = await Promise.all(
        Array.from({ length: 6 }, (_, i) =>
          request.post(`${base}/auth/register`, {
            data: { displayName: `Racer ${i}`, email: i % 2 ? email.toUpperCase() : email, password: `Passw0rd-${i}-${stem}` },
          }),
        ),
      );
      const statuses = results.map((r) => r.status()).sort();
      expect(statuses.filter((s) => s === 201)).toHaveLength(1);
      expect(statuses.filter((s) => s === 409)).toHaveLength(5);
    });
  }

  test("the database has a unique, case-insensitive email index @positive", async () => {
    for (const db of [PC_DATABASE, CLOUD_DB]) expect(await indexNames(db, "users"), db).toContain("email_unique_ci");
  });
});

test.describe("RA-007: refresh tokens are single-use under concurrency and stored hashed", () => {
  test("five simultaneous refreshes with one token succeed once @negative", async ({ request }) => {
    const user = await registerUser(request, API_URL);
    const results = await Promise.all(Array.from({ length: 5 }, () => request.post(`${API_URL}/auth/refresh`, { data: { refreshToken: user.refreshToken } })));
    const statuses = results.map((r) => r.status());
    expect(statuses.filter((s) => s === 200)).toHaveLength(1);
    expect(statuses.filter((s) => s === 401)).toHaveLength(4);
  });

  test("the database holds a hash of the token, never the token @positive", async ({ request }) => {
    const user = await registerUser(request, API_URL);
    const stored = await storedRefreshTokens(PC_DATABASE, await meId(request, user.accessToken));
    expect(stored).toContain(sha256(user.refreshToken));
    expect(stored).not.toContain(user.refreshToken);
  });

  test("a stolen stored value can't be presented as a token @negative", async ({ request }) => {
    const user = await registerUser(request, API_URL);
    const res = await request.post(`${API_URL}/auth/refresh`, { data: { refreshToken: sha256(user.refreshToken) } });
    expect(res.status()).toBe(401);
  });

  test("a token stored the old way (raw) still works once, and its replacement is hashed @positive", async ({ request }) => {
    const user = await registerUser(request, API_URL);
    const id = await meId(request, user.accessToken);
    const legacy = crypto.randomBytes(64).toString("hex");
    await insertLegacyRefreshToken(PC_DATABASE, id, legacy);

    const first = await request.post(`${API_URL}/auth/refresh`, { data: { refreshToken: legacy } });
    expect(first.status(), await first.text()).toBe(200);
    expect((await request.post(`${API_URL}/auth/refresh`, { data: { refreshToken: legacy } })).status()).toBe(401);
    const stored = await storedRefreshTokens(PC_DATABASE, id);
    expect(stored).not.toContain(legacy);
    const next = (await first.json()).Data.refreshToken;
    expect(stored).toContain(sha256(next));
  });

  test("logout still revokes a hashed token @positive", async ({ request }) => {
    const user = await registerUser(request, API_URL);
    expect((await request.post(`${API_URL}/auth/logout`, { data: { refreshToken: user.refreshToken } })).status()).toBe(200);
    expect((await request.post(`${API_URL}/auth/refresh`, { data: { refreshToken: user.refreshToken } })).status()).toBe(401);
  });
});

async function meId(request: any, accessToken: string): Promise<string> {
  const me = await json(await request.get(`${API_URL}/auth/me`, { headers: { Authorization: `Bearer ${accessToken}` } }));
  return String(me.Data.id);
}

test.describe("RA-012: a reset link works once, even when used twice at the same moment", () => {
  test("five simultaneous uses of one link: one wins @negative", async ({ request }) => {
    const user = await registerUser(request, CLOUD_URL);
    expect((await request.post(`${CLOUD_URL}/auth/forgot-password`, { data: { identifier: user.email } })).status()).toBe(200);
    const emails = await (await request.get(`${RESEND_URL}/__emails?to=${encodeURIComponent(user.email)}`)).json();
    const token = new URL(String(emails[0].text).match(/https?:\/\/\S+reset-password\?token=\S+/)![0]).searchParams.get("token");
    const results = await Promise.all(
      Array.from({ length: 5 }, (_, i) => request.post(`${CLOUD_URL}/auth/reset-password`, { data: { token, password: `Reset-pass-${i}-ok` } })),
    );
    const statuses = results.map((r) => r.status());
    expect(statuses.filter((s) => s === 200)).toHaveLength(1);
    expect(statuses.filter((s) => s === 400)).toHaveLength(4);
  });
});

test.describe("RA-011: passwords", () => {
  test("a new password needs 8 characters; 7 is refused and 8 is taken @negative", async ({ anon }) => {
    const email = `${uniqueName("pw")}@example.com`;
    const short = await anon.post("/auth/register", { email, password: "1234567" });
    expect(short.status()).toBe(400);
    expect((await json(short)).error).toBe("Use a password of at least 8 characters.");
    expect((await anon.post("/auth/register", { email, password: "12345678" })).status()).toBe(201);
  });

  test("a password is used as typed: spaces count, and it's refused if typed differently @positive", async ({ anon }) => {
    const email = `${uniqueName("sp")}@example.com`;
    const typed = "  spaced pass  ";
    expect((await anon.post("/auth/register", { email, password: typed })).status()).toBe(201);
    expect((await anon.post("/auth/login", { email, password: typed })).status()).toBe(200);
    expect((await anon.post("/auth/login", { email, password: "spaced pass" })).status()).toBe(401);
  });

  test("an older account whose password was stored trimmed still signs in, typed with or without spaces @positive", async ({ anon, user }) => {
    // Registered normally (no spaces); an extra space typed at the end still works, as it did before.
    expect((await anon.post("/auth/login", { email: user.email, password: `${user.password} ` })).status()).toBe(200);
    expect((await anon.post("/auth/login", { email: user.email, password: user.password })).status()).toBe(200);
  });

  test("changing a password to a short one is refused @negative", async ({ api, user }) => {
    const res = await api.patch("/auth/change-password", { currentPassword: user.password, newPassword: "short" });
    expect(res.status()).toBe(400);
  });
});

test.describe("RA-010: a casual reply isn't a yes to removing a game", () => {
  for (const reply of ["thanks", "cool", "fine", "alright", "ty"]) {
    test(`"${reply}" while a removal is pending keeps the game @negative`, async ({ api }) => {
      await api.addGame(byName("Fallout Shelter"));
      const ask = await chat(api, "remove fallout shelter");
      expect(ask.status).toBe("CONFIRMATION_REQUIRED");
      await chat(api, reply);
      const library = (await json(await api.get("/game"))).Data;
      expect((library.games ?? library).map((g: any) => g.title)).toContain("Fallout Shelter");
    });
  }

  test("a plain yes still removes it @positive", async ({ api }) => {
    await api.addGame(byName("Fallout Shelter"));
    await chat(api, "remove fallout shelter");
    const yes = await chat(api, "yes");
    expect(yes.success, yes.message).toBe(true);
    const library = (await json(await api.get("/game"))).Data;
    expect((library.games ?? library)).toEqual([]);
  });
});

test.describe("RA-001: no tokens or secrets in logs", () => {
  test("the Epic sign-in code no longer logs the authentication response @negative", async () => {
    const source = fs.readFileSync(path.resolve(__dirname, "../../../backend/src/modules/providers/epic/epicOAuthService.ts"), "utf8");
    expect(source).not.toMatch(/console\.(log|dir|info)\([^)]*response/i);
  });

  test("console text is scrubbed of tokens, secrets, bearer headers and JWTs @positive", async () => {
    process.env.LOG_DIR ??= LOG_DIR;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { scrubSecrets } = require("../../../backend/src/shared/logging/logger");
    const text = scrubSecrets(
      `auth { access_token: "eg1~abcdef", refresh_token: 'zzz999', expires_in: 7200 } password=hunter2 Authorization: Bearer abcdefghijklmnop jwt eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0In0.sig_nature-ok count: 12`,
    );
    for (const secret of ["eg1~abcdef", "zzz999", "hunter2", "abcdefghijklmnop", "eyJhbGciOiJIUzI1NiJ9"]) expect(text).not.toContain(secret);
    expect(text).toContain("expires_in: 7200");
    expect(text).toContain("count: 12");
  });
});

test.describe.serial("RA-003: the PC's backend only answers this machine", () => {
  const PORT = 5094;
  let child: ChildProcess | undefined;

  const get = (url: string, headers: Record<string, string> = {}) =>
    new Promise<{ status: number; headers: http.IncomingHttpHeaders }>((resolve, reject) => {
      const req = http.get(url, { headers, timeout: 4000 }, (res) => {
        res.resume();
        resolve({ status: res.statusCode ?? 0, headers: res.headers });
      });
      req.on("error", reject);
      req.on("timeout", () => req.destroy(new Error("timeout")));
    });

  test.beforeAll(async () => {
    child = spawn(process.execPath, ["dist/server.js"], {
      cwd: path.resolve(__dirname, "../../../backend"),
      env: {
        ...process.env,
        ELECTRON_EMBEDDED: "1",
        PORT: String(PORT),
        MONGO_URI: `${MONGO_URL}/RoninArc_embedded_e2e`,
        JWT_SECRET: "roninarc-e2e-embedded",
        IGDB_BASE_URL: `http://127.0.0.1:${IGDB_PORT}`,
        IGDB_API_KEY: "e2e-key",
        AI_PROVIDER: "ollama",
        MOCK_LLM: "true",
        LOG_DIR: path.join(os.tmpdir(), "roninarc-e2e-logs-embedded"),
        SENTRY_DSN: "",
        NODE_ENV: "test",
      },
      stdio: "ignore",
    });
    const deadline = Date.now() + 40_000;
    for (;;) {
      try {
        if ((await get(`http://127.0.0.1:${PORT}/health`)).status === 200) break;
      } catch {
        /* not up yet */
      }
      if (Date.now() > deadline) throw new Error("the embedded-mode backend didn't start");
      await new Promise((r) => setTimeout(r, 500));
    }
  });

  test.afterAll(() => {
    child?.kill();
  });

  test("it answers on loopback @positive", async () => {
    expect((await get(`http://127.0.0.1:${PORT}/health`)).status).toBe(200);
  });

  test("it does not answer on the machine's network address @negative", async () => {
    const lan = Object.values(os.networkInterfaces())
      .flat()
      .find((i) => i && i.family === "IPv4" && !i.internal)?.address;
    test.skip(!lan, "no network interface other than loopback on this machine");
    await expect(get(`http://${lan}:${PORT}/health`)).rejects.toThrow();
  });

  test("web pages from other sites are refused by CORS; the app's own origins are allowed @negative", async () => {
    const allow = async (origin: string) => (await get(`http://127.0.0.1:${PORT}/health`, { Origin: origin })).headers["access-control-allow-origin"];
    expect(await allow("https://evil.example")).toBeUndefined();
    expect(await allow("http://localhost.evil.example")).toBeUndefined();
    expect(await allow("null")).toBe("null");
    expect(await allow("file://")).toBeDefined();
    expect(await allow("http://localhost:5173")).toBe("http://localhost:5173");
  });
});
