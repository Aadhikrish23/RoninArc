import { test, expect } from "../../fixtures/test";
import { json } from "../../helpers/api";
import { byName } from "../../fixtures/catalog.mjs";

// The backend runs with MOCK_LLM=true: the "LLM" is a deterministic keyword
// matcher (backend/src/modules/ai/clients/OllamaClient.ts). These tests cover
// everything after the model call -- entity resolution, planning, clarification,
// tool execution and the real side effects in the database.
const shelter = byName("Fallout Shelter");

const chat = async (api: any, message: unknown) => {
  const res = await api.post("/ai/chat", { message });
  return { status: res.status(), body: await json(res) };
};

test.describe("AI chat API (/ai/chat)", () => {
  test.describe("input validation", () => {
    for (const [label, message] of [
      ["missing", undefined],
      ["empty", ""],
      ["whitespace-only", "    "],
      ["non-string", 42],
    ] as const) {
      test(`rejects a ${label} message with 400 @negative`, async ({ api }) => {
        const { status, body } = await chat(api, message);
        expect(status).toBe(400);
        expect(body).toEqual({ success: false, message: "Please tell me what you'd like to do." });
      });
    }

    test("requires authentication @negative", async ({ anon }) => {
      expect((await anon.post("/ai/chat", { message: "hi" })).status()).toBe(401);
    });
  });

  test.describe("small talk", () => {
    test("answers a greeting even when the LLM is unavailable @positive", async ({ api }) => {
      test.fail(true, "Known bug: AIRuntime only checks for greetings AFTER calling the LLM, so with the model offline even 'hi' fails");
      const { status, body } = await chat(api, "hi");
      expect(status).toBe(200);
      expect(body.message).toContain("Hello! I am your RoninArc AI assistant.");
    });

    test("a game title containing 'hi' is not mistaken for a greeting @negative", async ({ api }) => {
      await api.addGame(byName("Hitman"));
      const { body } = await chat(api, "Launch Hitman");
      expect(body.message).not.toContain("Hello! I am your RoninArc AI assistant.");
    });
  });

  test.describe("library actions", () => {
    test("'complete <game>' asks for the missing status, then completes on the answer @positive", async ({ api }) => {
      const game = await api.addGame(shelter, { progressStatus: "playing" });
      const ask = await chat(api, "complete fallout shelter");
      expect(ask.status).toBe(200);
      expect(ask.body).toMatchObject({ success: false, status: "CLARIFICATION_REQUIRED", message: "What status should I update the game to?" });
      expect((await json(await api.get(`/game/${game._id}`))).Data.progressStatus).toBe("playing");

      const answer = await chat(api, "completed");
      expect(answer.body).toMatchObject({ success: true, status: "SUCCESS", message: "I've marked Fallout Shelter as completed." });
      expect((await json(await api.get(`/game/${game._id}`))).Data.progressStatus).toBe("completed");
    });

    test("'rate <game>' creates a review with the requested rating @positive", async ({ api }) => {
      const game = await api.addGame(shelter);
      const { body } = await chat(api, "rate fallout shelter 9");
      expect(body).toMatchObject({ success: true, message: "I've posted your 9-star review for Fallout Shelter." });
      expect((await json(await api.get(`/review/${game._id}`))).Data).toMatchObject({ rating: 9 });
    });

    test("'launch <game>' starts a play session and logs the launch @positive", async ({ api }) => {
      const game = await api.addGame(shelter);
      const { body } = await chat(api, "launch fallout shelter");
      expect(body.success, body.message).toBe(true);
      const sessions = (await json(await api.get("/play-session/recent"))).Data;
      expect(sessions[0].gameId._id).toBe(game._id);
      const activity = (await json(await api.get("/activity"))).Data;
      expect(activity.some((a: any) => a.type === "GAME_LAUNCHED")).toBe(true);
    });

    test("acting on a game that is not in the library changes nothing @negative", async ({ api }) => {
      const other = await api.addGame(byName("Celeste"));
      const { status, body } = await chat(api, "complete fallout shelter");
      expect(status).toBe(200);
      expect(body.success).toBe(false);
      expect(body.message).toEqual(expect.any(String));
      expect((await json(await api.get(`/game/${other._id}`))).Data.progressStatus).toBe("plan");
    });
  });

  test.describe("collections", () => {
    test("creates a collection and adds a game to it @positive", async ({ api }) => {
      const game = await api.addGame(shelter);
      const created = await chat(api, "create an rpg collection");
      expect(created.body.success, created.body.message).toBe(true);
      let collections = (await json(await api.get("/collection"))).Data;
      expect(collections.map((c: any) => c.name)).toEqual(["RPG Collection"]);

      const added = await chat(api, "add fallout shelter to my rpg collection");
      expect(added.body.success, added.body.message).toBe(true);
      collections = (await json(await api.get("/collection"))).Data;
      expect(collections[0].gameIds.map((g: any) => g._id)).toEqual([game._id]);
    });
  });

  test.describe("resilience", () => {
    test("an LLM outage is refused with a clear error and the server keeps serving @negative", async ({ api }) => {
      await api.addGame(shelter);
      // No mock rule matches this, so the client falls through to a "live"
      // Ollama call against an unreachable port.
      const res = await api.post("/ai/chat", { message: "zxqv blorp" });
      expect(res.status()).toBeGreaterThanOrEqual(400);
      expect((await json(res)).error).toContain("Ollama is not running");

      expect((await api.get("/health")).status()).toBe(200);
      const { body } = await chat(api, "rate fallout shelter 9");
      expect(body.success, body.message).toBe(true);
    });

    test("concurrent requests from one user are serialised, not corrupted @positive", async ({ api }) => {
      const a = await api.addGame(shelter);
      const b = await api.addGame(byName("Cyberpunk 2077"));
      const results = await Promise.all(["rate fallout shelter 9", "launch cyberpunk 2077"].map((m) => chat(api, m)));
      for (const r of results) expect(r.body.success, r.body.message).toBe(true);
      expect((await json(await api.get(`/review/${a._id}`))).Data.rating).toBe(9);
      expect((await json(await api.get("/play-session/recent"))).Data[0].gameId._id).toBe(b._id);
    });
  });
});
