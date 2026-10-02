import { test, expect } from "../../fixtures/test";
import { DEFAULT_PASSWORD, json, uniqueName } from "../../helpers/api";
import { byName } from "../../fixtures/catalog.mjs";

// The suite points Atlas_URL at a second database on the throwaway mongod, so
// these exercise the real push -> restore round-trip, not a mock.
test.describe("Cloud backup API (/backup)", () => {
  test("push mirrors the user's data to the cloud database @positive", async ({ api }) => {
    await api.addGame(byName("Hades"));
    const res = await api.post("/backup/push");
    expect(res.status()).toBe(200);
    const { Data } = await json(res);
    expect(Data.collections).toBe(7);
    expect(Data.documents).toBeGreaterThanOrEqual(2);
  });

  test("pushing twice is idempotent @positive", async ({ api }) => {
    await api.addGame(byName("Hades"));
    const first = (await json(await api.post("/backup/push"))).Data;
    const second = (await json(await api.post("/backup/push"))).Data;
    expect(second).toEqual(first);
  });

  test("restores a deleted local account, data included, from the cloud @positive", async ({ api, anon, user }) => {
    const game = await api.addGame(byName("Celeste"), { progressStatus: "completed" });
    await api.put(`/review/${game._id}`, { rating: 10, reviewText: "Perfect" });
    const collection = await api.createCollection("Platformers");
    await api.post(`/collection/${collection._id}/games`, { gameId: game._id });
    expect((await api.post("/backup/push")).status()).toBe(200);

    // Simulate a fresh install: the local account is gone.
    expect((await api.delete("/auth/account", { password: user.password })).status()).toBe(200);
    expect((await anon.post("/auth/login", { username: user.username, password: user.password })).status()).toBe(401);

    const restore = await anon.post("/backup/restore", { username: user.username, password: user.password });
    expect(restore.status(), await restore.text()).toBe(200);
    expect((await json(restore)).Data.username).toBe(user.username);

    const login = await anon.post("/auth/login", { username: user.username, password: user.password });
    expect(login.status()).toBe(200);
    api.token = (await json(login)).Data.accessToken;

    const library = (await json(await api.get("/game"))).Data;
    expect(library).toHaveLength(1);
    expect(library[0]).toMatchObject({ _id: game._id, title: "Celeste", progressStatus: "completed", rating: 10 });
    const collections = (await json(await api.get("/collection"))).Data;
    expect(collections[0]).toMatchObject({ name: "Platformers" });
    expect(collections[0].gameIds[0]._id).toBe(game._id);
  });

  test("restores notes too, even after the account was deleted locally @positive", async ({ api, anon, user }) => {
    const game = await api.addGame(byName("Hades"));
    await api.post(`/notes/${game._id}`, { content: "Use the shield" });
    await api.post("/backup/push");
    await api.delete("/auth/account", { password: user.password });

    const restore = await anon.post("/backup/restore", { username: user.username, password: user.password });
    expect(restore.status(), await restore.text()).toBe(200);

    api.token = (await json(await anon.post("/auth/login", { username: user.username, password: user.password }))).Data.accessToken;
    expect((await json(await api.get(`/notes/${game._id}`))).Data.map((n: any) => n.content)).toEqual(["Use the shield"]);
  });

  test("restore requires username and password @negative", async ({ anon }) => {
    for (const body of [{}, { username: "someone" }, { password: DEFAULT_PASSWORD }]) {
      const res = await anon.post("/backup/restore", body);
      expect(res.status()).toBe(400);
      expect((await json(res)).Message).toBe("Username and password are required");
    }
  });

  test("restore of an account with no cloud backup returns 404 @negative", async ({ anon }) => {
    const res = await anon.post("/backup/restore", { username: uniqueName("nobackup"), password: DEFAULT_PASSWORD });
    expect(res.status()).toBe(404);
    expect((await json(res)).Message).toBe("No cloud backup found for this account.");
  });

  test("restore with the wrong password returns 401 @negative", async ({ api, anon, user }) => {
    await api.post("/backup/push");
    await api.delete("/auth/account", { password: user.password });
    const res = await anon.post("/backup/restore", { username: user.username, password: "WrongPass123" });
    expect(res.status()).toBe(401);
    expect((await json(res)).Message).toBe("Invalid credentials");
  });

  test("restore refuses to overwrite an account that still exists locally @negative", async ({ api, anon, user }) => {
    await api.post("/backup/push");
    const res = await anon.post("/backup/restore", { username: user.username, password: user.password });
    expect(res.status()).toBe(409);
  });

  test("push requires authentication @negative", async ({ anon }) => {
    expect((await anon.post("/backup/push")).status()).toBe(401);
  });
});
