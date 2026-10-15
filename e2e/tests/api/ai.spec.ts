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
      expect(answer.body).toMatchObject({ success: true, status: "SUCCESS", message: "I've marked Fallout Shelter as Completed. Congrats on finishing it!" });
      expect((await json(await api.get(`/game/${game._id}`))).Data.progressStatus).toBe("completed");
    });

    test("'rate <game>' creates a review with the requested rating @positive", async ({ api }) => {
      const game = await api.addGame(shelter);
      const { body } = await chat(api, "rate fallout shelter 9");
      // A rated game still on Plan to Play gets an offer to mark it Completed.
      expect(body).toMatchObject({ success: true, message: "I've rated Fallout Shelter 9/10. It's still on Plan to Play. Want me to mark Fallout Shelter as Completed?" });
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

    test("removing a game that is not in the library changes nothing @negative", async ({ api }) => {
      const other = await api.addGame(byName("Celeste"));
      const { status, body } = await chat(api, "remove fallout shelter");
      expect(status).toBe(200);
      expect(body.message).toContain("isn't in your library");
      expect((await json(await api.get("/game"))).Data.map((g: any) => g.title)).toEqual(["Celeste"]);
      expect((await json(await api.get(`/game/${other._id}`))).Data.progressStatus).toBe("plan");
    });

    test("completing a game you don't have yet adds it, then marks it completed @positive", async ({ api }) => {
      await api.addGame(byName("Celeste"));
      // The mock model leaves out the status, so the assistant adds the game and then asks for it.
      const { body } = await chat(api, "complete fallout shelter");
      expect(body.message).toContain("I've added Fallout Shelter to your library");
      await chat(api, "completed");
      const library = (await json(await api.get("/game"))).Data;
      expect(library.find((g: any) => g.title === "Fallout Shelter")?.progressStatus).toBe("completed");
      expect(library.find((g: any) => g.title === "Celeste")?.progressStatus).toBe("plan");
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
      expect(body.message).toContain("From your backlog, I'd play next:\n- **Celeste**");
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

    test("'anything i could beat this weekend?' is a recommendation and skips long games @positive", async ({ api }) => {
      await api.addGame(byName("Elden Ring"));
      const { body } = await chat(api, "anything i could beat this weekend?");
      expect(body.success, body.message).toBe(true);
      expect(body.message).not.toContain("Elden Ring");
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

    test("'what's in <collection>?' lists its games from the data, no model needed @positive", async ({ api }) => {
      const game = await api.addGame(shelter);
      const col = (await json(await api.post("/collection", { name: "Cozy Nights" }))).Data;
      await api.post(`/collection/${col._id}/games`, { gameId: game._id });
      const { body } = await chat(api, "what's in cozy nights?");
      expect(body).toMatchObject({ success: true, message: "**Cozy Nights** has 1 game:\n- Fallout Shelter" });
    });

    test("'read me my notes for <game>' reads them and saves nothing @positive", async ({ api }) => {
      const game = await api.addGame(shelter);
      await api.post(`/notes/${game._id}`, { content: "build the power room first" });
      const { body } = await chat(api, "read me my notes for fallout shelter");
      expect(body).toMatchObject({ success: true, message: "Your note on Fallout Shelter:\n- build the power room first" });
      expect((await json(await api.get(`/notes/${game._id}`))).Data).toHaveLength(1);
    });

    test("two questions in one message both get answered @positive", async ({ api }) => {
      const game = await api.addGame(shelter);
      const col = (await json(await api.post("/collection", { name: "Soulslikes" }))).Data;
      await api.post(`/collection/${col._id}/games`, { gameId: game._id });
      const { body } = await chat(api, "whats in my soulslike collection rn? and did i write any notes on fallout shelter");
      expect(body.message).toBe("**Soulslikes** has 1 game:\n- Fallout Shelter\n\nYou haven't written any notes on Fallout Shelter yet.");
    });

    test("an empty collection says so instead of inventing games @negative", async ({ api }) => {
      await api.post("/collection", { name: "Cozy Nights" });
      const { body } = await chat(api, "what's in cozy nights");
      expect(body.message).toBe("**Cozy Nights** is empty right now.");
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
    // Real questions get a fresh answer from the model (answer mode).
    expect(body.message).toBe("Mock answer about: is elden ring too hard for a beginner?");
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

// Round 3 of the gamer playtest: real answers, the right game, every game.
test.describe("AI chat API: questions, targets and multi-game requests", () => {
  test("a general gaming question gets an answer, not a library readout @positive", async ({ api }) => {
    await api.addGame(byName("Hollow Knight"), { progressStatus: "completed" });
    const { body } = await chat(api, "whats the difference between a roguelike and a roguelite");
    expect(body.success).toBe(true);
    expect(body.message).toBe("Mock answer about: whats the difference between a roguelike and a roguelite");
  });

  test("'remove the last game I added' targets the newest game, after confirming @positive", async ({ api }) => {
    await api.addGame(shelter);
    await api.addGame(byName("Celeste"));
    const { body } = await chat(api, "remove the last game i added");
    expect(body.status).toBe("CONFIRMATION_REQUIRED");
    expect(body.message).toContain("Remove Celeste from your library?");
  });
});

// Round 2 of the gamer playtest: the assistant must never change something it
// wasn't asked to change.
test.describe("AI chat API: only changes what the user asked for", () => {
  test("a keyboard mash changes nothing, even if the model guesses a game @negative", async ({ api }) => {
    const game = await api.addGame(byName("Hades"), { progressStatus: "plan" });
    const { body } = await chat(api, "asdfgh");
    expect(body.message).toBe("I'm not sure what you'd like me to change, so I left everything as it is. Could you say it another way?");
    expect((await json(await api.get(`/game/${game._id}`))).Data.progressStatus).toBe("plan");
  });

  test("asking what you rated a game answers it and keeps the review text @positive", async ({ api }) => {
    const game = await api.addGame(byName("Hades"), { progressStatus: "completed" });
    await api.put(`/review/${game._id}`, { rating: 9, reviewText: "Tight combat" });
    const { body } = await chat(api, "what did i rate hades?");
    expect(body.message).toBe('Hades is marked Completed. You rated it 9/10: "Tight combat"');
    expect((await json(await api.get(`/review/${game._id}`))).Data).toMatchObject({ rating: 9, reviewText: "Tight combat" });
  });

  test("rating a game by chat keeps the review text already written @positive", async ({ api }) => {
    const game = await api.addGame(shelter);
    await api.put(`/review/${game._id}`, { rating: 6, reviewText: "Good on the bus" });
    await chat(api, "rate fallout shelter 9");
    expect((await json(await api.get(`/review/${game._id}`))).Data).toMatchObject({ rating: 9, reviewText: "Good on the bus" });
  });
});

// Round 4 of the gamer playtest: "Clear" has to make the assistant forget, too.
test.describe("AI conversation reset (/ai/reset)", () => {
  test("requires authentication @negative", async ({ anon }) => {
    expect((await anon.post("/ai/reset")).status()).toBe(401);
  });

  test("drops a pending removal: 'yes' after Clear removes nothing @negative", async ({ api }) => {
    const game = await api.addGame(shelter);
    expect((await chat(api, "remove fallout shelter")).body.status).toBe("CONFIRMATION_REQUIRED");

    const reset = await api.post("/ai/reset");
    expect(reset.status()).toBe(200);
    expect(await json(reset)).toEqual({ Status: "Success", Message: "Conversation cleared" });

    await chat(api, "Yes, remove it");
    expect((await api.get(`/game/${game._id}`)).status()).toBe(200);
  });

  test("ignores page ids that aren't ids @negative", async ({ api }) => {
    await api.addGame(shelter);
    const res = await api.post("/ai/chat", { message: "hi", client: { pageGameId: "{$ne:1}", pageCollectionId: 42 } });
    expect(res.status()).toBe(200);
  });
});

// Round 6 of the gamer playtest: no silent changes for things the assistant can't do,
// and questions answered from what the app already knows.
test.describe("AI chat API: round 6", () => {
  test("a reminder request changes nothing and says so @negative", async ({ api }) => {
    const game = await api.addGame(shelter, { progressStatus: "plan" });
    const { body } = await chat(api, "remind me on friday to play fallout shelter with the boys");
    expect(body.message).toMatch(/^I can't set reminders yet/);
    expect((await json(await api.get(`/game/${game._id}`))).Data.progressStatus).toBe("plan");
    expect((await json(await api.get("/collection"))).Data).toEqual([]);
  });

  test("'undo' is refused honestly @negative", async ({ api }) => {
    const { body } = await chat(api, "undo the last thing you did");
    expect(body.message).toMatch(/^I can't undo changes yet/);
  });

  test("a collection can be deleted from chat, after a yes @positive", async ({ api }) => {
    const game = await api.addGame(shelter);
    const col = (await json(await api.post("/collection", { name: "Outer Wilds" }))).Data;
    await api.post(`/collection/${col._id}/games`, { gameId: game._id });
    const ask = await chat(api, "delete the whole collection called Outer Wilds");
    expect(ask.body).toMatchObject({ status: "CONFIRMATION_REQUIRED", message: 'Delete the collection "Outer Wilds"? The game in it stays in your library.' });
    expect((await json(await api.get("/collection"))).Data).toHaveLength(1);
    const yes = await chat(api, "yes");
    expect(yes.body).toMatchObject({ success: true, message: 'I\'ve deleted the collection "Outer Wilds".' });
    expect((await json(await api.get("/collection"))).Data).toEqual([]);
    expect((await api.get(`/game/${game._id}`)).status()).toBe(200);
  });

  test("'no' keeps the collection @negative", async ({ api }) => {
    await api.post("/collection", { name: "Soulslikes" });
    await chat(api, "delete my soulslikes collection");
    const no = await chat(api, "no");
    expect(no.body.message).toBe('Okay, I kept the collection "Soulslikes".');
    expect((await json(await api.get("/collection"))).Data).toHaveLength(1);
  });

  test("a collection can be renamed from chat @positive", async ({ api }) => {
    await api.post("/collection", { name: "Soulslikes" });
    const { body } = await chat(api, "rename soulslikes to Hard Games");
    expect(body.message).toBe('I\'ve renamed the collection "Soulslikes" to "Hard Games".');
    expect((await json(await api.get("/collection"))).Data[0].name).toBe("Hard Games");
  });

  test("'what did i write about gta?' finds the review and notes by shorthand @positive", async ({ api }) => {
    const game = await api.addGame(byName("Grand Theft Auto V"));
    await api.put(`/review/${game._id}`, { rating: 8.5, reviewText: "heists are great" });
    await api.post(`/notes/${game._id}`, { content: "finish the big score" });
    const { body } = await chat(api, "what did i write about gta? any notes?");
    expect(body.message).toBe('Your review of Grand Theft Auto V: 8.5/10 -- "heists are great"\n\nYour note on Grand Theft Auto V:\n- finish the big score');
  });

  test("'how long is <game>' answers with the average playtime @positive", async ({ api }) => {
    await api.addGame(shelter);
    const { body } = await chat(api, "how long is fallout shelter to beat?");
    expect(body.message).toBe("Players spend about 20 hours on Fallout Shelter on average (RAWG's playtime average, so a focused run can be shorter).");
  });

  test("'any co-op games in my library' reads the games' tags @positive", async ({ api }) => {
    await api.addGame(byName("Stardew Valley"));
    await api.addGame(byName("Elden Ring"));
    await api.addGame(byName("Hollow Knight"));
    const { body } = await chat(api, "yo any coop games in my library i can play w my gf? she's not into hard stuff");
    expect(body.message).toBe("Laid-back games in your library with co-op:\n- Stardew Valley");
  });

  test("'whats my fav game and what am i playing rn' answers both @positive", async ({ api }) => {
    const hk = await api.addGame(byName("Hollow Knight"), { progressStatus: "completed" });
    await api.put(`/review/${hk._id}`, { rating: 10 });
    await api.addGame(byName("Hades"), { progressStatus: "playing" });
    const { body } = await chat(api, "whats my fav game so far and what am i playing rn");
    expect(body.message).toBe("Your favourite so far is Hollow Knight, rated 10/10.\n\nYou're playing Hades.");
  });
});

// Round 7 of the gamer playtest: a question must never change anything.
test.describe("AI chat API: round 7", () => {
  test("'should i play X or Y first' answers and changes nothing @negative", async ({ api }) => {
    const elden = await api.addGame(byName("Elden Ring"), { progressStatus: "plan" });
    const { body } = await chat(api, "should i play elden ring or hollow knight first");
    expect(body.message).toBe("Mock answer about: should i play elden ring or hollow knight first");
    expect((await json(await api.get(`/game/${elden._id}`))).Data.progressStatus).toBe("plan");
  });

  test("'is this one worth it?' on a game page is about that game @positive", async ({ api }) => {
    const game = await api.addGame(byName("Hollow Knight"));
    const res = await api.post("/ai/chat", { message: "is this one worth it?", client: { pageGameId: game._id } });
    expect((await json(res)).message).toBe("Mock answer about: is Hollow Knight worth it?");
  });

  test("'highest rated and how many have i finished' answers both @positive", async ({ api }) => {
    const hk = await api.addGame(byName("Hollow Knight"), { progressStatus: "completed" });
    await api.put(`/review/${hk._id}`, { rating: 9 });
    await api.addGame(byName("Hades"), { progressStatus: "playing" });
    const { body } = await chat(api, "whats my highest rated game and how many have i finished");
    expect(body.message).toBe("Your favourite so far is Hollow Knight, rated 9/10.\n\nYou have 1 game finished, out of 2 games in your library.");
  });
});

// Round 8 of the gamer playtest: never lose what the user wrote.
test.describe("AI chat API: round 8", () => {
  test("re-rating keeps a review the user wrote by hand @negative", async ({ api }) => {
    const game = await api.addGame(shelter, { progressStatus: "completed" });
    await api.put(`/review/${game._id}`, { rating: 8, reviewText: "Got stuck at the raiders, still great" });
    const { body } = await chat(api, "rate fallout shelter 9 it was amazing");
    expect(body.message).toContain("I kept the review you'd already written");
    expect((await json(await api.get(`/review/${game._id}`))).Data).toMatchObject({ rating: 9, reviewText: "Got stuck at the raiders, still great" });
  });

  test("'change my review on it to: ...' replaces the text and keeps the score @positive", async ({ api }) => {
    const game = await api.addGame(shelter, { progressStatus: "completed" });
    await api.put(`/review/${game._id}`, { rating: 9, reviewText: "old text" });
    const { body } = await chat(api, "change my review on fallout shelter to: gorgeous and brutal. keep the 9");
    expect(body.message).toBe('I\'ve updated your review of Fallout Shelter: 9/10 -- "gorgeous and brutal".');
    expect((await json(await api.get(`/review/${game._id}`))).Data).toMatchObject({ rating: 9, reviewText: "gorgeous and brutal" });
  });

  test("rating a game still on Plan to Play offers to mark it Completed; 'yes' does it @positive", async ({ api }) => {
    const game = await api.addGame(shelter, { progressStatus: "plan" });
    const { body } = await chat(api, "rate fallout shelter 9");
    expect(body.message).toContain("Want me to mark Fallout Shelter as Completed?");
    const yes = await chat(api, "yes");
    expect(yes.body.message).toBe("I've marked Fallout Shelter as Completed.");
    expect((await json(await api.get(`/game/${game._id}`))).Data.progressStatus).toBe("completed");
  });

  test("'whats my average rating' is answered from the data @positive", async ({ api }) => {
    const a = await api.addGame(shelter, { progressStatus: "completed" });
    const b = await api.addGame(byName("Hades"), { progressStatus: "completed" });
    await api.put(`/review/${a._id}`, { rating: 6 });
    await api.put(`/review/${b._id}`, { rating: 9 });
    const { body } = await chat(api, "how many games do i have total and whats my average rating");
    expect(body.message).toBe("You have 2 games: 2 completed.\n\nYour average rating is 7.5/10 across 2 rated games.");
  });

  test("removing a game keeps it out of recommendations @negative", async ({ api }) => {
    const game = await api.addGame(byName("Hades"));
    await api.delete(`/game/${game._id}`);
    const recs = (await json(await api.get("/recommendations?type=discover&limit=20"))).Data;
    expect(recs.discover.map((r: any) => r.title)).not.toContain("Hades");
  });
});
