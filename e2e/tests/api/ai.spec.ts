import { test, expect } from "../../fixtures/test";
import { json } from "../../helpers/api";
import { byName } from "../../fixtures/catalog.mjs";

// The backend runs with MOCK_LLM=true: the "LLM" is a deterministic keyword
// matcher (backend/src/modules/ai/clients/OllamaClient.ts). These tests cover
// everything after the model call -- entity resolution, planning, clarification,
// tool execution and the real side effects in the database.
const shelter = byName("Fallout Shelter");

const chat = async (api: any, message: unknown, client?: { canLaunchGames: boolean }) => {
  const res = await api.post("/ai/chat", client ? { message, client } : { message });
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
    // The suite's "LLM" is unreachable for anything the mock doesn't match, so
    // these prove greetings are answered without calling the model at all.
    for (const [message, expected] of [
      ["hi", "Hello! I am your RoninArc AI assistant."],
      ["Hello!", "Hello! I am your RoninArc AI assistant."],
      ["thanks", "You're welcome!"],
      ["How are you?", "I'm doing great"],
      ["What can you do?", "I can help you manage your gaming library."],
    ] as const) {
      test(`answers "${message}" even when the LLM is offline @positive`, async ({ api }) => {
        const { status, body } = await chat(api, message);
        expect(status).toBe(200);
        expect(body.success).toBe(true);
        expect(body.message).toContain(expected);
      });
    }

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
      expect(answer.body).toMatchObject({ success: true, status: "SUCCESS", message: "I've marked Fallout Shelter as Completed." });
      expect((await json(await api.get(`/game/${game._id}`))).Data.progressStatus).toBe("completed");
    });

    test("'rate <game>' creates a review with the requested rating @positive", async ({ api }) => {
      const game = await api.addGame(shelter);
      const { body } = await chat(api, "rate fallout shelter 9");
      expect(body).toMatchObject({ success: true, message: "I've rated Fallout Shelter 9/10." });
      expect((await json(await api.get(`/review/${game._id}`))).Data).toMatchObject({ rating: 9 });
    });

    test("'launch <game>' from the desktop app hands the launch back as a client action @positive", async ({ api }) => {
      const game = await api.addGame(shelter);
      const { body } = await chat(api, "launch fallout shelter", { canLaunchGames: true });
      expect(body).toMatchObject({ success: true, message: "Launching Fallout Shelter on your PC." });
      expect(body.clientActions).toEqual([{ type: "launch_game", gameId: game._id, title: "Fallout Shelter" }]);
      // The server never starts a game or a play session itself; the app does, through its normal launch flow.
      expect((await json(await api.get("/play-session/recent"))).Data).toEqual([]);
      expect((await json(await api.get("/activity"))).Data.some((a: any) => a.type === "GAME_LAUNCHED")).toBe(false);
    });

    for (const [label, client] of [["the web build", { canLaunchGames: false }], ["a client that doesn't say", undefined]] as const) {
      test(`'launch <game>' from ${label} explains it needs the desktop app and changes nothing @negative`, async ({ api }) => {
        await api.addGame(shelter);
        const { body } = await chat(api, "launch fallout shelter", client);
        expect(body).toMatchObject({
          success: true,
          message: "Launching games only works in the RoninArc desktop app, so I can't start Fallout Shelter from here.",
        });
        expect(body.clientActions).toBeUndefined();
        expect((await json(await api.get("/play-session/recent"))).Data).toEqual([]);
      });
    }

    test("acting on a game that is not in the library changes nothing @negative", async ({ api }) => {
      const other = await api.addGame(byName("Celeste"));
      const { status, body } = await chat(api, "complete fallout shelter");
      expect(status).toBe(200);
      expect(body.success).toBe(false);
      expect(body.message).toEqual(expect.any(String));
      expect((await json(await api.get(`/game/${other._id}`))).Data.progressStatus).toBe("plan");
    });
  });

  test.describe("recommendations", () => {
    test("'what should I play next?' recommends from the backlog with reasons @positive", async ({ api }) => {
      const hk = await api.addGame(byName("Hollow Knight"), { progressStatus: "completed" });
      await api.put(`/review/${hk._id}`, { rating: 9 });
      await api.addGame(byName("Celeste"));

      const { status, body } = await chat(api, "What should I play next?");
      expect(status).toBe(200);
      expect(body.success, body.message).toBe(true);
      expect(body.message).toContain("From your backlog, I'd play next: Celeste");
      expect(body.message).toContain("Similar to Hollow Knight, which you rated 9/10");
      expect(body.message).toContain("New to discover:");
    });

    test("'recommend something like <game>' focuses on that game's genres @positive", async ({ api }) => {
      await api.addGame(byName("Hades"), { progressStatus: "completed" });
      await api.addGame(byName("Elden Ring"));
      await api.addGame(byName("Stardew Valley"));
      const { body } = await chat(api, "recommend something like Hades");
      expect(body.success, body.message).toBe(true);
      expect(body.message).toContain("Elden Ring");
      expect(body.message).not.toContain("Stardew Valley");
    });

    test("with nothing to go on it says how to get better picks @negative", async ({ api }) => {
      for (const [name, status] of [["Hades", "playing"], ["Celeste", "completed"]] as const) {
        await api.addGame(byName(name), { progressStatus: status });
      }
      const { body } = await chat(api, "suggest a racing game");
      expect(body.success).toBe(true);
      expect(body.message).toContain("I don't have any recommendations matching Racing yet");
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
      expect(res.status()).toBe(503);
      const body = await json(res);
      expect(body).toMatchObject({ success: false, offline: true });
      expect(body.message).toContain("The AI assistant is offline right now");
      expect(body.message).not.toContain("127.0.0.1");

      expect((await api.get("/health")).status()).toBe(200);
      const after = await chat(api, "rate fallout shelter 9");
      expect(after.body.success, after.body.message).toBe(true);
    });

    test("concurrent requests from one user are serialised, not corrupted @positive", async ({ api }) => {
      const a = await api.addGame(shelter);
      const b = await api.addGame(byName("Cyberpunk 2077"));
      const results = await Promise.all(
        ["rate fallout shelter 9", "launch cyberpunk 2077"].map((m) => chat(api, m, { canLaunchGames: true })),
      );
      for (const r of results) expect(r.body.success, r.body.message).toBe(true);
      expect((await json(await api.get(`/review/${a._id}`))).Data.rating).toBe(9);
      expect(results[1].body.clientActions).toEqual([{ type: "launch_game", gameId: b._id, title: "Cyberpunk 2077" }]);
    });
  });
});

// Behaviour added after the gamer playtest (2026-10-15). The mock model maps
// phrases to intents; these check what the app then does with them.
test.describe("AI chat API: everyday requests", () => {
  test("'pause <game>' sets the status to Paused and names the game @positive", async ({ api }) => {
    const game = await api.addGame(shelter, { progressStatus: "playing" });
    const { body } = await chat(api, "pause fallout shelter, taking a break");
    expect(body).toMatchObject({ success: true, message: "I've marked Fallout Shelter as Paused." });
    expect((await json(await api.get(`/game/${game._id}`))).Data.progressStatus).toBe("paused");
  });

  test("library questions are answered from the library, not searched as titles @positive", async ({ api }) => {
    await api.addGame(shelter, { progressStatus: "playing" });
    await api.addGame(byName("Celeste"), { progressStatus: "plan" });
    await api.addGame(byName("Hades"), { progressStatus: "completed" });

    const backlog = await chat(api, "what's in my backlog?");
    expect(backlog.body.success).toBe(true);
    expect(backlog.body.message).toBe("You have 2 games in your backlog: playing Fallout Shelter; planned Celeste.");

    const counts = await chat(api, "how many games do i have and how many have i finished?");
    expect(counts.body.message).toContain("You have 3 games: 1 playing, 1 plan to play, 1 completed.");
  });

  test("'buy <game>' is refused instead of adding it @negative", async ({ api }) => {
    const { body } = await chat(api, "can u buy hades 2 for me on steam");
    expect(body.success).toBe(true);
    expect(body.message).toContain("I can't buy games");
    expect((await json(await api.get("/game"))).Data).toEqual([]);
  });

  test("a general gaming question gets an answer, not the greeting @positive", async ({ api }) => {
    const { body } = await chat(api, "is elden ring too hard for a beginner?");
    expect(body.message).toContain("explore elsewhere");
    expect(body.message).not.toContain("Hello! I am your RoninArc AI assistant");
  });

  test("'I finished <game>' for a game not in the library adds it, then marks it completed @positive", async ({ api }) => {
    const { body } = await chat(api, "I finished celeste last night!!");
    expect(body.success, body.message).toBe(true);
    expect(body.message).toContain("Celeste");
    expect(body.message).toContain("Completed");
    const library = (await json(await api.get("/game"))).Data;
    expect(library.map((g: any) => [g.title, g.progressStatus])).toEqual([["Celeste", "completed"]]);
  });

  test("'it' after adding a game means that game, not the one before @positive", async ({ api }) => {
    const shelterGame = await api.addGame(shelter);
    await chat(api, "rate fallout shelter 9");
    await chat(api, "I finished celeste");
    const { body } = await chat(api, "rate it 10");
    expect(body.message).toBe("I've rated Celeste 10/10.");
    expect((await json(await api.get(`/review/${shelterGame._id}`))).Data.rating).toBe(9);
  });

  test("removing a game asks first; 'yes' removes it @positive", async ({ api }) => {
    const game = await api.addGame(shelter);
    const ask = await chat(api, "remove fallout shelter");
    expect(ask.body).toMatchObject({ success: false, status: "CONFIRMATION_REQUIRED" });
    expect(ask.body.message).toBe("Remove Fallout Shelter from your library? Its review and notes will be deleted too.");
    expect(ask.body.clarificationRequest.options.map((o: any) => o.label)).toEqual(["Yes, remove it", "No, keep it"]);
    expect((await api.get(`/game/${game._id}`)).status()).toBe(200);

    const yes = await chat(api, "Yes, remove it");
    expect(yes.body.success, yes.body.message).toBe(true);
    expect((await json(await api.get("/game"))).Data).toEqual([]);
  });

  test("'no' keeps the game, and an unrelated reply drops the pending removal @negative", async ({ api }) => {
    const game = await api.addGame(shelter);
    await chat(api, "remove fallout shelter");
    const no = await chat(api, "No, keep it");
    expect(no.body).toMatchObject({ success: true, message: "Okay, I kept Fallout Shelter in your library." });

    await chat(api, "remove fallout shelter");
    await chat(api, "what's in my backlog?");
    const lateYes = await chat(api, "yes");
    expect(lateYes.body.message).not.toContain("removed");
    expect((await api.get(`/game/${game._id}`)).status()).toBe(200);
  });
});
