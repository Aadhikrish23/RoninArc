import { test, expect } from "../../fixtures/test";
import { Api, MISSING_ID, json, registerUser, uniqueName } from "../../helpers/api";
import { byName } from "../../fixtures/catalog.mjs";
import { API_URL } from "../../env";

const hades = byName("Hades");
const celeste = byName("Celeste");

test.describe("Collection API (/collection)", () => {
  test.describe("create & read", () => {
    test("creates a collection and logs COLLECTION_CREATED @positive", async ({ api }) => {
      const res = await api.post("/collection", { name: "  Roguelikes  ", description: "  Run-based games " });
      expect(res.status()).toBe(201);
      expect((await json(res)).Data).toMatchObject({ name: "Roguelikes", description: "Run-based games", gameIds: [] });
      const activity = (await json(await api.get("/activity"))).Data;
      expect(activity.some((a: any) => a.type === "COLLECTION_CREATED" && a.message === 'Created collection "Roguelikes"')).toBe(true);
    });

    test("creating a name that already exists (any case) returns the existing collection @positive", async ({ api }) => {
      const first = await api.createCollection("Cozy Games");
      const res = await api.post("/collection", { name: "cozy games" });
      expect(res.status()).toBe(201);
      expect((await json(res)).Data._id).toBe(first._id);
      expect((await json(await api.get("/collection"))).Data).toHaveLength(1);
    });

    test("names with regex characters are matched literally @positive", async ({ api }) => {
      await api.createCollection("A+ Tier (2024)");
      const second = await api.post("/collection", { name: "A Tier 2024" });
      expect((await json(second)).Data.name).toBe("A Tier 2024");
      expect((await json(await api.get("/collection"))).Data).toHaveLength(2);
    });

    test("lists the user's collections newest first, with games populated @positive", async ({ api }) => {
      const game = await api.addGame(hades);
      const older = await api.createCollection("Older");
      await api.post(`/collection/${older._id}/games`, { gameId: game._id });
      await api.createCollection("Newer");

      const { Data } = await json(await api.get("/collection"));
      expect(Data.map((c: any) => c.name)).toEqual(["Newer", "Older"]);
      expect(Data[1].gameIds[0]).toMatchObject({ _id: game._id, title: "Hades" });
    });

    test("gets one collection by id @positive", async ({ api }) => {
      const c = await api.createCollection("Single");
      const res = await api.get(`/collection/${c._id}`);
      expect(res.status()).toBe(200);
      expect((await json(res)).Data.name).toBe("Single");
    });

    test("rejects a missing or blank name @negative", async ({ api }) => {
      for (const body of [{ description: "no name" }, { name: "   " }, { name: 42 }]) {
        const res = await api.post("/collection", body);
        expect(res.status()).toBe(400);
        expect((await json(res)).Message).toBe("Collection name is required");
      }
    });

    test("returns 404 for a missing or malformed collection id @negative", async ({ api }) => {
      const missing = await api.get(`/collection/${MISSING_ID}`);
      expect(missing.status()).toBe(404);
      expect((await json(missing)).Message).toBe("Collection not found");
      expect((await api.get("/collection/nope")).status()).toBe(404);
    });

    test("users cannot see each other's collections @negative", async ({ api, request }) => {
      const c = await api.createCollection("Mine");
      const intruder = new Api(request, API_URL, (await registerUser(request, API_URL)).accessToken);
      expect((await json(await intruder.get("/collection"))).Data).toEqual([]);
      expect((await intruder.get(`/collection/${c._id}`)).status()).toBe(404);
    });

    test("requires authentication @negative", async ({ anon }) => {
      expect((await anon.get("/collection")).status()).toBe(401);
      expect((await anon.post("/collection", { name: "x" })).status()).toBe(401);
    });
  });

  test.describe("games in a collection", () => {
    test("adds and removes games, logging both activities @positive", async ({ api }) => {
      const game = await api.addGame(hades);
      const c = await api.createCollection("Action");

      const add = await api.post(`/collection/${c._id}/games`, { gameId: game._id });
      expect(add.status()).toBe(200);
      expect((await json(add)).Data.gameIds.map((g: any) => g._id)).toEqual([game._id]);

      const remove = await api.delete(`/collection/${c._id}/games/${game._id}`);
      expect(remove.status()).toBe(200);
      expect((await json(remove)).Data.gameIds).toEqual([]);

      const types = (await json(await api.get("/activity"))).Data.map((a: any) => a.type);
      expect(types).toEqual(expect.arrayContaining(["GAME_ADDED_TO_COLLECTION", "GAME_REMOVED_FROM_COLLECTION"]));
    });

    test("adding the same game twice is idempotent @positive", async ({ api }) => {
      const game = await api.addGame(hades);
      const c = await api.createCollection("Dupes");
      await api.post(`/collection/${c._id}/games`, { gameId: game._id });
      const again = await api.post(`/collection/${c._id}/games`, { gameId: game._id });
      expect((await json(again)).Data.gameIds).toHaveLength(1);
      const added = (await json(await api.get("/activity"))).Data.filter((a: any) => a.type === "GAME_ADDED_TO_COLLECTION");
      expect(added).toHaveLength(1);
    });

    test("removing a game that is not in the collection is a no-op @negative", async ({ api }) => {
      const game = await api.addGame(celeste);
      const c = await api.createCollection("Empty");
      const res = await api.delete(`/collection/${c._id}/games/${game._id}`);
      expect(res.status()).toBe(200);
      expect((await json(res)).Data.gameIds).toEqual([]);
    });

    test("adding to a missing collection fails @negative", async ({ api }) => {
      const game = await api.addGame(hades);
      const res = await api.post(`/collection/${MISSING_ID}/games`, { gameId: game._id });
      expect(res.status()).toBe(400);
      expect((await json(res)).Message).toBe("Collection not found");
    });

    test("adding a malformed game id fails @negative", async ({ api }) => {
      const c = await api.createCollection("Bad ids");
      expect((await api.post(`/collection/${c._id}/games`, { gameId: "not-an-id" })).status()).toBe(400);
    });

    test("rejects a request with no game id @negative", async ({ api }) => {
      const c = await api.createCollection("No id");
      const res = await api.post(`/collection/${c._id}/games`, {});
      expect(res.status()).toBe(400);
      expect((await json(res)).Message).toBe("A valid gameId is required");
      const added = (await json(await api.get("/activity"))).Data.filter((a: any) => a.type === "GAME_ADDED_TO_COLLECTION");
      expect(added).toEqual([]);
    });

    test("cannot add a game to another user's collection @negative", async ({ api, request }) => {
      const c = await api.createCollection("Private");
      const intruder = new Api(request, API_URL, (await registerUser(request, API_URL)).accessToken);
      const theirGame = await intruder.addGame(hades);
      const res = await intruder.post(`/collection/${c._id}/games`, { gameId: theirGame._id });
      expect(res.status()).toBe(400);
      expect((await json(await api.get(`/collection/${c._id}`))).Data.gameIds).toEqual([]);
    });

    test("cannot put another user's game into your own collection @negative", async ({ api, request }) => {
      const other = new Api(request, API_URL, (await registerUser(request, API_URL)).accessToken);
      const foreignGame = await other.addGame(hades);
      const c = await api.createCollection("Sneaky");
      const res = await api.post(`/collection/${c._id}/games`, { gameId: foreignGame._id });
      expect(res.status()).toBe(400);
      expect((await json(res)).Message).toBe("Game not found in your library");
      expect((await json(await api.get(`/collection/${c._id}`))).Data.gameIds).toEqual([]);
    });

    test("rejects renaming to a blank name @negative", async ({ api }) => {
      const c = await api.createCollection("Named");
      const res = await api.patch(`/collection/${c._id}`, { name: "  " });
      expect(res.status()).toBe(400);
      expect((await json(res)).Message).toBe("Collection name is required");
    });
  });

  test.describe("update & delete", () => {
    test("renames a collection and logs COLLECTION_UPDATED @positive", async ({ api }) => {
      const c = await api.createCollection("Old name");
      const res = await api.patch(`/collection/${c._id}`, { name: " New name ", description: "Fresh" });
      expect(res.status()).toBe(200);
      expect((await json(res)).Data).toMatchObject({ name: "New name", description: "Fresh" });
      const activity = (await json(await api.get("/activity"))).Data;
      expect(activity.some((a: any) => a.type === "COLLECTION_UPDATED")).toBe(true);
    });

    test("rejects renaming to another collection's name @negative", async ({ api }) => {
      await api.createCollection("Taken");
      const c = await api.createCollection("Free");
      const res = await api.patch(`/collection/${c._id}`, { name: "Taken" });
      expect(res.status()).toBe(400);
      expect((await json(res)).Message).toBe("Collection with this name already exists");
    });

    test("rejects updating a missing collection @negative", async ({ api }) => {
      const res = await api.patch(`/collection/${MISSING_ID}`, { name: uniqueName("c") });
      expect(res.status()).toBe(400);
      expect((await json(res)).Message).toBe("Collection not found");
    });

    test("deletes a collection but keeps its games in the library @positive", async ({ api }) => {
      const game = await api.addGame(hades);
      const c = await api.createCollection("Doomed");
      await api.post(`/collection/${c._id}/games`, { gameId: game._id });

      const res = await api.delete(`/collection/${c._id}`);
      expect(res.status()).toBe(200);
      expect((await json(res)).Message).toBe("Collection deleted");
      expect((await api.get(`/collection/${c._id}`)).status()).toBe(404);
      expect((await api.get(`/game/${game._id}`)).status()).toBe(200);
    });

    test("rejects deleting a missing collection or another user's collection @negative", async ({ api, request }) => {
      expect((await api.delete(`/collection/${MISSING_ID}`)).status()).toBe(400);
      const c = await api.createCollection("Keep out");
      const intruder = new Api(request, API_URL, (await registerUser(request, API_URL)).accessToken);
      expect((await intruder.delete(`/collection/${c._id}`)).status()).toBe(400);
      expect((await api.get(`/collection/${c._id}`)).status()).toBe(200);
    });
  });
});
