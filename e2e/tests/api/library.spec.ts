import { test, expect } from "../../fixtures/test";
import { Api, MISSING_ID, json, registerUser } from "../../helpers/api";
import { byName } from "../../fixtures/catalog.mjs";
import { API_URL } from "../../env";

const hades = byName("Hades");
const celeste = byName("Celeste");

test.describe("Library API (/game)", () => {
  test.describe("add", () => {
    test("adds a game with defaults and logs a GAME_ADDED activity @positive", async ({ api }) => {
      const res = await api.post("/game/add", { rawgId: hades.id, title: `  ${hades.name}  `, tags: hades.genres });
      expect(res.status()).toBe(201);
      const { Data } = await json(res);
      expect(Data).toMatchObject({ rawgId: hades.id, title: hades.name, progressStatus: "plan", tags: hades.genres });

      const activity = await json(await api.get("/activity"));
      expect(activity.Data.some((a: any) => a.type === "GAME_ADDED" && a.message.includes(hades.name))).toBe(true);
    });

    test("accepts every valid progress status @positive", async ({ api }) => {
      for (const [i, status] of ["none", "plan", "playing", "paused", "completed", "dropped"].entries()) {
        const res = await api.post("/game/add", { rawgId: 900000 + i, title: `Status ${status}`, tags: [], progressStatus: status });
        expect(res.status(), status).toBe(201);
        expect((await json(res)).Data.progressStatus).toBe(status);
      }
    });

    test("rejects a duplicate rawgId for the same user @negative", async ({ api }) => {
      await api.addGame(hades);
      const res = await api.post("/game/add", { rawgId: hades.id, title: "Hades again", tags: [] });
      expect(res.status()).toBe(400);
      expect((await json(res)).error).toBe("Game already exists");
    });

    test("allows the same game in two different users' libraries @positive", async ({ api, request }) => {
      await api.addGame(hades);
      const other = await registerUser(request, API_URL);
      const otherApi = new Api(request, API_URL, other.accessToken);
      await otherApi.addGame(hades);
    });

    for (const [label, payload, error] of [
      ["missing rawgId", { title: "X", tags: [] }, "Valid rawgId is required"],
      ["string rawgId", { rawgId: "123", title: "X", tags: [] }, "Valid rawgId is required"],
      ["missing title", { rawgId: 1, tags: [] }, "Title is required"],
      ["blank title", { rawgId: 1, title: "   ", tags: [] }, "Title is required"],
      ["non-array tags", { rawgId: 1, title: "X", tags: "rpg" }, "Invalid Tags"],
      ["non-string description", { rawgId: 1, title: "X", tags: [], description: 42 }, "Invalid inputs: description,imageURL,exePath must be text/string "],
      ["unknown status", { rawgId: 1, title: "X", tags: [], progressStatus: "speedrunning" }, "Invalid status"],
    ] as const) {
      test(`rejects ${label} with 400 @negative`, async ({ api }) => {
        const res = await api.post("/game/add", payload);
        expect(res.status()).toBe(400);
        expect((await json(res)).error).toBe(error);
      });
    }

    test("requires authentication @negative", async ({ anon }) => {
      expect((await anon.post("/game/add", { rawgId: 1, title: "X", tags: [] })).status()).toBe(401);
    });
  });

  test.describe("read", () => {
    test("lists only the current user's games, with review rating merged in @positive", async ({ api, request }) => {
      const game = await api.addGame(hades);
      await api.addGame(celeste);
      await api.put(`/review/${game._id}`, { rating: 9, reviewText: "Great" });

      const other = new Api(request, API_URL, (await registerUser(request, API_URL)).accessToken);
      await other.addGame(byName("Elden Ring"));

      const { Data } = await json(await api.get("/game"));
      expect(Data.map((g: any) => g.title).sort()).toEqual(["Celeste", "Hades"]);
      expect(Data.find((g: any) => g.title === "Hades").rating).toBe(9);
      expect(Data.find((g: any) => g.title === "Celeste").rating).toBeNull();
    });

    test("an empty library returns an empty array @positive", async ({ api }) => {
      expect((await json(await api.get("/game"))).Data).toEqual([]);
    });

    test("gets a single game by id @positive", async ({ api }) => {
      const game = await api.addGame(hades);
      const res = await api.get(`/game/${game._id}`);
      expect(res.status()).toBe(200);
      expect((await json(res)).Data).toMatchObject({ _id: game._id, title: hades.name });
    });

    test("rejects a malformed id with 400 @negative", async ({ api }) => {
      const res = await api.get("/game/not-an-id");
      expect(res.status()).toBe(400);
      expect((await json(res)).error).toBe("Invalid game id");
    });

    test("returns 404 for a game that does not exist @negative", async ({ api }) => {
      expect((await api.get(`/game/${MISSING_ID}`)).status()).toBe(404);
    });

    test("returns 404 for another user's game (no cross-user access) @negative", async ({ api, request }) => {
      const game = await api.addGame(hades);
      const intruder = new Api(request, API_URL, (await registerUser(request, API_URL)).accessToken);
      expect((await intruder.get(`/game/${game._id}`)).status()).toBe(404);
      expect((await intruder.patch(`/game/${game._id}`, { progressStatus: "dropped" })).status()).toBe(404);
      expect((await intruder.delete(`/game/${game._id}`)).status()).toBe(404);
      expect((await json(await api.get(`/game/${game._id}`))).Data.progressStatus).toBe("plan");
    });

    test("requires authentication @negative", async ({ anon }) => {
      expect((await anon.get("/game")).status()).toBe(401);
    });
  });

  test.describe("filter", () => {
    test("filters by title, tag and status (status is an alias of progressStatus) @positive", async ({ api }) => {
      await api.addGame(hades, { progressStatus: "playing" });
      await api.addGame(celeste);

      const byTitle = await json(await api.get("/game/filter/search", { param: "title", value: "Celeste" }));
      expect(byTitle.Data.map((g: any) => g.title)).toEqual(["Celeste"]);

      const byTag = await json(await api.get("/game/filter/search", { param: "tags", value: "RPG" }));
      expect(byTag.Data.map((g: any) => g.title)).toEqual(["Hades"]);

      const byStatus = await json(await api.get("/game/filter/search", { param: "status", value: "playing" }));
      expect(byStatus.Data.map((g: any) => g.title)).toEqual(["Hades"]);
    });

    test("returns an empty list when nothing matches @positive", async ({ api }) => {
      await api.addGame(hades);
      const res = await api.get("/game/filter/search", { param: "title", value: "Nope" });
      expect(res.status()).toBe(200);
      expect((await json(res)).Data).toEqual([]);
    });

    for (const [label, params, error] of [
      ["missing param", { value: "x" }, "Missing search param"],
      ["missing value", { param: "title" }, "Missing search value"],
      ["unsupported param", { param: "exePath", value: "x" }, "Invalid Search params"],
      ["blank value", { param: "title", value: "   " }, "Invalid Search value"],
    ] as const) {
      test(`rejects ${label} with 400 @negative`, async ({ api }) => {
        const res = await api.get("/game/filter/search", params as Record<string, string>);
        expect(res.status()).toBe(400);
        expect((await json(res)).error).toBe(error);
      });
    }
  });

  test.describe("update", () => {
    test("updates status, tags and exe path, logging STATUS_CHANGED @positive", async ({ api }) => {
      const game = await api.addGame(hades);
      const res = await api.patch(`/game/${game._id}`, { progressStatus: "completed", tags: ["Roguelike"], exePath: "  C:/Games/Hades.exe  " });
      expect(res.status()).toBe(200);
      expect((await json(res)).Data).toMatchObject({ progressStatus: "completed", tags: ["Roguelike"], exePath: "C:/Games/Hades.exe" });

      const activity = await json(await api.get("/activity"));
      expect(activity.Data.some((a: any) => a.type === "STATUS_CHANGED" && a.message === "Hades marked as completed")).toBe(true);
    });

    test("setting the same status again is a no-op (no duplicate activity) @positive", async ({ api }) => {
      const game = await api.addGame(hades);
      await api.patch(`/game/${game._id}`, { progressStatus: "playing" });
      await api.patch(`/game/${game._id}`, { progressStatus: "playing" });
      const activity = await json(await api.get("/activity"));
      expect(activity.Data.filter((a: any) => a.type === "STATUS_CHANGED")).toHaveLength(1);
    });

    for (const [label, payload, error] of [
      ["unknown status", { progressStatus: "finished" }, "Invalid status"],
      ["non-array tags", { tags: "rpg" }, "Invalid Tags"],
      ["non-string exePath", { exePath: 7 }, "Invalid inputs: exePath must be text/string "],
    ] as const) {
      test(`rejects ${label} with 400 @negative`, async ({ api }) => {
        const game = await api.addGame(hades);
        const res = await api.patch(`/game/${game._id}`, payload);
        expect(res.status()).toBe(400);
        expect((await json(res)).error).toBe(error);
      });
    }

    test("rejects a malformed id and a missing game @negative", async ({ api }) => {
      expect((await api.patch("/game/123", { progressStatus: "plan" })).status()).toBe(400);
      expect((await api.patch(`/game/${MISSING_ID}`, { progressStatus: "plan" })).status()).toBe(404);
    });
  });

  test.describe("delete", () => {
    test("deletes the game and cascades to its collections and review @positive", async ({ api }) => {
      const game = await api.addGame(hades);
      const collection = await api.createCollection("Roguelikes");
      await api.post(`/collection/${collection._id}/games`, { gameId: game._id });
      await api.put(`/review/${game._id}`, { rating: 8 });

      const res = await api.delete(`/game/${game._id}`);
      expect(res.status()).toBe(200);

      expect((await api.get(`/game/${game._id}`)).status()).toBe(404);
      expect((await json(await api.get(`/collection/${collection._id}`))).Data.gameIds).toEqual([]);
      expect((await json(await api.get(`/review/${game._id}`))).Data).toBeNull();
    });

    test("rejects a malformed id and a missing game @negative", async ({ api }) => {
      expect((await api.delete("/game/abc")).status()).toBe(400);
      expect((await api.delete(`/game/${MISSING_ID}`)).status()).toBe(404);
    });
  });

  test.describe("metadata enrichment", () => {
    test("enriches a game from RAWG (screenshots, developers, rating) @positive", async ({ api }) => {
      const game = await api.addGame(byName("Stardew Valley"), { rawgId: 1 });
      const res = await api.post(`/game/${game._id}/enrich`);
      expect(res.status()).toBe(200);
      const { Data } = await json(res);
      expect(Data.metadataState.status).toBe("complete");
      expect(Data.rawgId).toBe(byName("Stardew Valley").id);
      expect(Data.developers).toEqual(["ConcernedApe"]);
      expect(Data.screenshots).toHaveLength(1);
    });

    test("marks enrichment as failed when RAWG has no plausible match @negative", async ({ api }) => {
      const game = await api.addGame(hades, { title: "Zzqx Totally Unknown Title", rawgId: 2 });
      const res = await api.post(`/game/${game._id}/enrich`);
      expect(res.status()).toBe(200);
      expect((await json(res)).Data.metadataState.status).toBe("failed");
    });

    test("rejects a malformed id @negative", async ({ api }) => {
      expect((await api.post("/game/xyz/enrich")).status()).toBe(400);
    });

    test("returns 404 for a game that does not exist @negative", async ({ api }) => {
      test.fail(true, "Known bug: enrichGame throws a plain Error, so a missing game surfaces as 500 instead of 404");
      expect((await api.post(`/game/${MISSING_ID}/enrich`)).status()).toBe(404);
    });
  });
});
