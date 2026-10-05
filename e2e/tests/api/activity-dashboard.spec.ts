import { test, expect } from "../../fixtures/test";
import { Api, MISSING_ID, json, registerUser } from "../../helpers/api";
import { CATALOG, byName } from "../../fixtures/catalog.mjs";
import { API_URL } from "../../env";

test.describe("Activity API (/activity)", () => {
  test("a new user has an empty feed @positive", async ({ api }) => {
    const res = await api.get("/activity");
    expect(res.status()).toBe(200);
    expect((await json(res)).Data).toEqual([]);
  });

  test("lists activity newest first with the game populated @positive", async ({ api }) => {
    const game = await api.addGame(byName("Hades"));
    await api.patch(`/game/${game._id}`, { progressStatus: "playing" });
    const { Data } = await json(await api.get("/activity"));
    expect(Data.map((a: any) => a.type)).toEqual(["STATUS_CHANGED", "GAME_ADDED"]);
    expect(Data[0].gameId).toMatchObject({ _id: game._id, title: "Hades" });
  });

  test("returns at most the 20 most recent entries @positive", async ({ api }) => {
    for (const [i, g] of CATALOG.entries()) await api.addGame(g, { rawgId: 700000 + i });
    const game = await api.addGame(byName("Hades"), { rawgId: 799999, title: "Extra" });
    for (const status of ["playing", "paused", "completed", "dropped", "plan", "playing", "paused", "completed", "dropped", "plan", "playing", "paused"]) {
      await api.patch(`/game/${game._id}`, { progressStatus: status });
    }
    const { Data } = await json(await api.get("/activity"));
    expect(Data).toHaveLength(20);
    expect(Data[0].type).toBe("STATUS_CHANGED");
  });

  test("records a launch for an owned game @positive", async ({ api }) => {
    const game = await api.addGame(byName("Celeste"));
    const res = await api.post(`/activity/launch/${game._id}`);
    expect(res.status()).toBe(200);
    const { Data } = await json(await api.get("/activity"));
    expect(Data[0]).toMatchObject({ type: "GAME_LAUNCHED", message: "Launched Celeste" });
  });

  test("launching a missing or foreign game returns 404 @negative", async ({ api, request }) => {
    expect((await api.post(`/activity/launch/${MISSING_ID}`)).status()).toBe(404);
    const other = new Api(request, API_URL, (await registerUser(request, API_URL)).accessToken);
    const foreign = await other.addGame(byName("Hades"));
    const res = await api.post(`/activity/launch/${foreign._id}`);
    expect(res.status()).toBe(404);
    expect((await json(res)).Message).toBe("Game not found");
  });

  test("a malformed id does not record anything @negative", async ({ api }) => {
    const res = await api.post("/activity/launch/not-an-id");
    expect(res.status()).toBe(400);
    expect((await json(res)).Message).toBe("Invalid game id");
    expect((await json(await api.get("/activity"))).Data).toEqual([]);
  });

  test("feeds are isolated between users @negative", async ({ api, request }) => {
    await api.addGame(byName("Hades"));
    const other = new Api(request, API_URL, (await registerUser(request, API_URL)).accessToken);
    expect((await json(await other.get("/activity"))).Data).toEqual([]);
  });

  test("requires authentication @negative", async ({ anon }) => {
    expect((await anon.get("/activity")).status()).toBe(401);
  });
});

test.describe("Dashboard API (/dashboard/stats)", () => {
  test("a new user gets zeroed stats @positive", async ({ api }) => {
    const res = await api.get("/dashboard/stats");
    expect(res.status()).toBe(200);
    const stats = await json(res);
    expect(stats).toMatchObject({ totalGames: 0, owned: 0, installed: 0, playing: 0, completed: 0, continuePlaying: [], recentGames: [], genreStats: [] });
    expect(stats.statusStats.map((s: any) => s.status)).toEqual([
      "Owned Games", "Installed Games", "Currently Playing", "Planned", "Completed", "Paused", "Dropped",
    ]);
    expect(stats.statusStats.every((s: any) => s.count === 0)).toBe(true);
  });

  test("aggregates totals, statuses, genres and recent games @positive", async ({ api }) => {
    await api.addGame(byName("Hades"), { progressStatus: "playing" });
    await api.addGame(byName("Elden Ring"), { progressStatus: "completed" });
    await api.addGame(byName("Celeste"), { progressStatus: "paused" });
    await api.addGame(byName("Fallout Shelter"));

    const stats = await json(await api.get("/dashboard/stats"));
    expect(stats).toMatchObject({ totalGames: 4, playing: 1, completed: 1 });
    expect(stats.continuePlaying.map((g: any) => g.title)).toEqual(["Hades"]);
    expect(stats.recentGames[0].title).toBe("Fallout Shelter");

    const count = (s: string) => stats.statusStats.find((x: any) => x.status === s).count;
    expect([count("Currently Playing"), count("Completed"), count("Paused"), count("Planned")]).toEqual([1, 1, 1, 1]);

    // Action and RPG appear twice each, so they lead the (descending) genre list.
    expect(stats.genreStats.slice(0, 2).map((g: any) => g.count)).toEqual([2, 2]);
    expect(stats.genreStats.slice(0, 2).map((g: any) => g.genre).sort()).toEqual(["Action", "RPG"]);
  });

  test("recentGames and continuePlaying are capped at 5 @positive", async ({ api }) => {
    for (const [i, g] of CATALOG.slice(0, 7).entries()) await api.addGame(g, { rawgId: 600000 + i, progressStatus: "playing" });
    const stats = await json(await api.get("/dashboard/stats"));
    expect(stats.totalGames).toBe(7);
    expect(stats.recentGames).toHaveLength(5);
    expect(stats.continuePlaying).toHaveLength(5);
  });

  test("only counts the caller's own games @negative", async ({ api, request }) => {
    await api.addGame(byName("Hades"));
    const other = new Api(request, API_URL, (await registerUser(request, API_URL)).accessToken);
    expect((await json(await other.get("/dashboard/stats"))).totalGames).toBe(0);
  });

  test("requires authentication @negative", async ({ anon }) => {
    expect((await anon.get("/dashboard/stats")).status()).toBe(401);
  });
});
