import { test, expect } from "../../fixtures/test";
import { Api, MISSING_ID, json, registerUser } from "../../helpers/api";
import { byName } from "../../fixtures/catalog.mjs";
import { API_URL } from "../../env";

const hades = byName("Hades");

test.describe("Play Session API (/play-session)", () => {
  test("starts an open session for a game @positive", async ({ api }) => {
    const game = await api.addGame(hades);
    const res = await api.post(`/play-session/start/${game._id}`);
    expect(res.status()).toBe(200);
    const { Data } = await json(res);
    expect(Data).toMatchObject({ gameId: game._id });
    expect(Data.startedAt).toEqual(expect.any(String));
    expect(Data.endedAt ?? null).toBeNull();
  });

  test("starting twice returns the same open session @positive", async ({ api }) => {
    const game = await api.addGame(hades);
    const first = (await json(await api.post(`/play-session/start/${game._id}`))).Data;
    const second = (await json(await api.post(`/play-session/start/${game._id}`))).Data;
    expect(second._id).toBe(first._id);
  });

  test("ends the open session and records its duration @positive", async ({ api }) => {
    const game = await api.addGame(hades);
    await api.post(`/play-session/start/${game._id}`);
    const res = await api.post(`/play-session/end/${game._id}`);
    expect(res.status()).toBe(200);
    const { Data } = await json(res);
    expect(Data.endedAt).toEqual(expect.any(String));
    expect(Data.durationMinutes).toBe(0);
  });

  test("lists recent sessions newest first, honouring the limit @positive", async ({ api }) => {
    const a = await api.addGame(hades);
    const b = await api.addGame(byName("Celeste"));
    await api.post(`/play-session/start/${a._id}`);
    await api.post(`/play-session/end/${a._id}`);
    await api.post(`/play-session/start/${b._id}`);

    const all = (await json(await api.get("/play-session/recent"))).Data;
    expect(all.map((s: any) => s.gameId.title)).toEqual(["Celeste", "Hades"]);

    const one = (await json(await api.get("/play-session/recent", { limit: 1 }))).Data;
    expect(one).toHaveLength(1);
  });

  test("out-of-range limits are clamped instead of failing @negative", async ({ api }) => {
    for (const limit of [0, -5, 9999]) {
      const res = await api.get("/play-session/recent", { limit });
      expect(res.status(), `limit=${limit}`).toBe(200);
    }
  });

  test("returns aggregate playtime stats @positive", async ({ api }) => {
    const game = await api.addGame(hades);
    const empty = (await json(await api.get("/play-session/stats"))).Data;
    expect(empty).toEqual({ totalMinutes: 0, totalHours: 0, totalSessions: 0, averageSessionMinutes: 0, mostPlayedGame: null, mostPlayedMinutes: 0 });

    await api.post(`/play-session/start/${game._id}`);
    await api.post(`/play-session/end/${game._id}`);
    const stats = (await json(await api.get("/play-session/stats"))).Data;
    expect(stats.totalSessions).toBe(1);
    expect(stats.mostPlayedGame).toMatchObject({ title: "Hades" });
  });

  test("returns per-game playtime @positive", async ({ api }) => {
    const game = await api.addGame(hades);
    const before = (await json(await api.get(`/play-session/game/${game._id}`))).Data;
    expect(before).toEqual({ totalHours: 0, lastPlayed: null });

    await api.post(`/play-session/start/${game._id}`);
    const after = (await json(await api.get(`/play-session/game/${game._id}`))).Data;
    expect(after.lastPlayed).toEqual(expect.any(String));
  });

  test("ending with no open session returns 404 @negative", async ({ api }) => {
    const game = await api.addGame(hades);
    const res = await api.post(`/play-session/end/${game._id}`);
    expect(res.status()).toBe(404);
    expect((await json(res)).Message).toBe("No active session found");
  });

  test("malformed game ids are rejected with 400 @negative", async ({ api }) => {
    for (const call of [
      () => api.post("/play-session/start/bad"),
      () => api.post("/play-session/end/bad"),
      () => api.get("/play-session/game/bad"),
    ]) {
      const res = await call();
      expect(res.status()).toBe(400);
      expect((await json(res)).Message).toBe("Invalid game id");
    }
  });

  test("sessions are isolated between users @negative", async ({ api, request }) => {
    const game = await api.addGame(hades);
    await api.post(`/play-session/start/${game._id}`);
    const intruder = new Api(request, API_URL, (await registerUser(request, API_URL)).accessToken);
    expect((await json(await intruder.get("/play-session/recent"))).Data).toEqual([]);
    expect((await intruder.post(`/play-session/end/${game._id}`)).status()).toBe(404);
  });

  test("cannot start a session for a game that is not in the library @negative", async ({ api }) => {
    const res = await api.post(`/play-session/start/${MISSING_ID}`);
    expect(res.status()).toBe(404);
    expect((await json(res)).Message).toBe("Game not found in your library");
  });

  test("cannot start a session on another user's game @negative", async ({ api, request }) => {
    const other = new Api(request, API_URL, (await registerUser(request, API_URL)).accessToken);
    const foreign = await other.addGame(hades);
    expect((await api.post(`/play-session/start/${foreign._id}`)).status()).toBe(404);
    expect((await json(await api.get("/play-session/recent"))).Data).toEqual([]);
  });

  test("requires authentication @negative", async ({ anon }) => {
    expect((await anon.get("/play-session/stats")).status()).toBe(401);
    expect((await anon.post(`/play-session/start/${MISSING_ID}`)).status()).toBe(401);
  });
});
