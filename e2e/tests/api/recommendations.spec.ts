import { test, expect } from "../../fixtures/test";
import { Api, json, registerUser } from "../../helpers/api";
import { RAWG_FAILURE_GENRE, byName } from "../../fixtures/catalog.mjs";
import { API_URL } from "../../env";

const get = async (api: Api, params: Record<string, string | number> = {}) => {
  const res = await api.get("/recommendations", params);
  return { status: res.status(), body: await json(res) };
};
const titles = (list: any[]) => list.map((r) => r.title);

test.describe("Recommendations API (/recommendations)", () => {
  test.describe("taste profile & backlog", () => {
    test("a brand-new user gets popular picks and is told it's not personalised yet @positive", async ({ api }) => {
      const { status, body } = await get(api);
      expect(status).toBe(200);
      expect(body.Data.profile).toEqual({ personalized: false, signalCount: 0, topGenres: [] });
      expect(body.Data.backlog).toEqual([]);
      expect(body.Data.discover.length).toBeGreaterThan(0);
      expect(body.Data.discover.length).toBeLessThanOrEqual(6);
      for (const r of body.Data.discover) {
        expect(r).toMatchObject({ source: "rawg", rawgId: expect.any(Number), title: expect.any(String) });
        expect(r.score).toBeGreaterThanOrEqual(0);
        expect(r.score).toBeLessThanOrEqual(100);
        expect(r.reasons.length).toBeGreaterThan(0);
      }
    });

    test("ranks the backlog by what the user loves, explaining why @positive", async ({ api }) => {
      const hk = await api.addGame(byName("Hollow Knight"), { progressStatus: "completed" });
      await api.put(`/review/${hk._id}`, { rating: 9 });
      await api.addGame(byName("Celeste"));
      await api.addGame(byName("Elden Ring"));

      const { body } = await get(api, { type: "backlog" });
      const { profile, backlog } = body.Data;
      expect(profile.personalized).toBe(true);
      expect(profile.topGenres.map((g: any) => g.genre).sort()).toEqual(["Indie", "Platformer"]);

      expect(titles(backlog)).toEqual(["Celeste", "Elden Ring"]);
      expect(backlog[0]).toMatchObject({ source: "library", status: "plan", gameId: expect.any(String) });
      expect(backlog[0].reasons[0]).toContain("like Hollow Knight -- you rated Hollow Knight 9/10");
      expect(backlog[0].score).toBeGreaterThan(backlog[1].score);
    });

    test("games in genres the user dislikes sink to the bottom @negative", async ({ api }) => {
      const hades = await api.addGame(byName("Hades"), { progressStatus: "dropped" });
      await api.put(`/review/${hades._id}`, { rating: 2 });
      await api.addGame(byName("Elden Ring"));
      await api.addGame(byName("Stardew Valley"));

      const { body } = await get(api, { type: "backlog" });
      expect(titles(body.Data.backlog)).toEqual(["Stardew Valley", "Elden Ring"]);
      expect(body.Data.profile.topGenres.map((g: any) => g.genre)).not.toContain("Action");
    });

    test("paused games get a nudge to pick them back up @positive", async ({ api }) => {
      await api.addGame(byName("Celeste"), { progressStatus: "paused" });
      const { body } = await get(api, { type: "backlog" });
      expect(body.Data.backlog[0].reasons).toContain("You paused it -- a good time to pick it back up");
    });

    test("games already played, finished or dropped are never suggested from the backlog @negative", async ({ api }) => {
      for (const [name, status] of [["Hades", "playing"], ["Celeste", "completed"], ["Elden Ring", "dropped"]] as const) {
        await api.addGame(byName(name), { progressStatus: status });
      }
      expect((await get(api, { type: "backlog" })).body.Data.backlog).toEqual([]);
    });

    test("only uses the caller's own library @negative", async ({ api, request }) => {
      const other = new Api(request, API_URL, (await registerUser(request, API_URL)).accessToken);
      await other.addGame(byName("Celeste"));
      const { body } = await get(api, { type: "backlog" });
      expect(body.Data.backlog).toEqual([]);
      expect(body.Data.profile.signalCount).toBe(0);
    });
  });

  test.describe("discover", () => {
    test("suggests unowned games in the user's favourite genres @positive", async ({ api }) => {
      const hk = await api.addGame(byName("Hollow Knight"), { progressStatus: "completed" });
      await api.put(`/review/${hk._id}`, { rating: 10 });

      const { body } = await get(api, { type: "discover" });
      const discover = body.Data.discover;
      expect(titles(discover)).not.toContain("Hollow Knight");
      expect(titles(discover)[0]).toBe("Celeste");
      expect(titles(discover)).toContain("Stardew Valley");
      expect(discover[0]).toMatchObject({ source: "rawg", rawgId: byName("Celeste").id });
      expect(discover.every((r: any) => r.genres.some((g: string) => ["Platformer", "Indie"].includes(g)))).toBe(true);
    });

    test("a game the user already owns is never suggested, even by title @negative", async ({ api }) => {
      await api.addGame(byName("Celeste"), { rawgId: 1, progressStatus: "completed" });
      const { body } = await get(api, { type: "discover", limit: 20 });
      expect(titles(body.Data.discover)).not.toContain("Celeste");
    });

    test("when the game database is unreachable, backlog picks still work offline @negative", async ({ api }) => {
      await api.addGame(byName("Hades"), { rawgId: 5001, title: "Gwent Night", tags: [RAWG_FAILURE_GENRE], progressStatus: "completed" });
      await api.addGame(byName("Celeste"));

      const { status, body } = await get(api);
      expect(status).toBe(200);
      expect(body.Data.discover).toEqual([]);
      expect(body.Data.discoverError).toContain("Couldn't reach the game database");
      expect(titles(body.Data.backlog)).toEqual(["Celeste"]);
    });
  });

  test.describe("focus hints (?q=)", () => {
    test("'like <owned game>' focuses on that game's genres @positive", async ({ api }) => {
      await api.addGame(byName("Hades"), { progressStatus: "completed" });
      await api.addGame(byName("Elden Ring"));
      await api.addGame(byName("Stardew Valley"));

      const { body } = await get(api, { q: "something like Hades" });
      expect(body.Data.focus.sort()).toEqual(["Action", "RPG"]);
      expect(titles(body.Data.backlog)).toEqual(["Elden Ring"]);
      expect(body.Data.discover.every((r: any) => r.genres.some((g: string) => ["Action", "RPG"].includes(g)))).toBe(true);
    });

    test("a genre name focuses on that genre @positive", async ({ api }) => {
      await api.addGame(byName("Celeste"));
      await api.addGame(byName("Elden Ring"));
      const { body } = await get(api, { q: "a good platformer" });
      expect(body.Data.focus).toEqual(["Platformer"]);
      expect(titles(body.Data.backlog)).toEqual(["Celeste"]);
    });

    test("a hint that matches nothing in the backlog returns no backlog picks @negative", async ({ api }) => {
      await api.addGame(byName("Celeste"));
      const { body } = await get(api, { type: "backlog", q: "racing" });
      expect(body.Data.focus).toEqual(["Racing"]);
      expect(body.Data.backlog).toEqual([]);
    });
  });

  test.describe("query validation", () => {
    test("type selects which lists are computed @positive", async ({ api }) => {
      await api.addGame(byName("Celeste"));
      const backlogOnly = (await get(api, { type: "backlog" })).body.Data;
      expect(backlogOnly.discover).toEqual([]);
      expect(backlogOnly.backlog).toHaveLength(1);
      expect(backlogOnly).not.toHaveProperty("discoverError");

      const discoverOnly = (await get(api, { type: "discover" })).body.Data;
      expect(discoverOnly.backlog).toEqual([]);
    });

    test("limit caps each list @positive", async ({ api }) => {
      const { body } = await get(api, { type: "discover", limit: 2 });
      expect(body.Data.discover).toHaveLength(2);
    });

    for (const [label, params, error] of [
      ["unknown type", { type: "everything" }, "type must be one of: all, backlog, discover"],
      ["zero limit", { limit: 0 }, "limit must be a whole number from 1 to 20"],
      ["huge limit", { limit: 500 }, "limit must be a whole number from 1 to 20"],
      ["non-numeric limit", { limit: "lots" }, "limit must be a whole number from 1 to 20"],
    ] as const) {
      test(`rejects ${label} with 400 @negative`, async ({ api }) => {
        const { status, body } = await get(api, params as Record<string, string | number>);
        expect(status).toBe(400);
        expect(body.error).toBe(error);
      });
    }

    test("requires authentication @negative", async ({ anon }) => {
      expect((await anon.get("/recommendations")).status()).toBe(401);
      expect((await anon.post("/recommendations/dismiss", { rawgId: 28 })).status()).toBe(401);
    });
  });

  test.describe("not interested", () => {
    test("a dismissed game stops being suggested, and can be restored @positive", async ({ api }) => {
      const celeste = byName("Celeste");
      expect(titles((await get(api, { type: "discover", limit: 20 })).body.Data.discover)).toContain("Celeste");

      const dismiss = await api.post("/recommendations/dismiss", { rawgId: celeste.id, title: "Celeste" });
      expect(dismiss.status()).toBe(200);
      expect(titles((await get(api, { type: "discover", limit: 20 })).body.Data.discover)).not.toContain("Celeste");

      // Dismissing twice is harmless.
      expect((await api.post("/recommendations/dismiss", { rawgId: celeste.id })).status()).toBe(200);

      const undo = await api.delete(`/recommendations/dismiss/${celeste.id}`);
      expect(undo.status()).toBe(200);
      expect(titles((await get(api, { type: "discover", limit: 20 })).body.Data.discover)).toContain("Celeste");
    });

    test("dismissals are per user @negative", async ({ api, request }) => {
      await api.post("/recommendations/dismiss", { rawgId: byName("Celeste").id });
      const other = new Api(request, API_URL, (await registerUser(request, API_URL)).accessToken);
      expect(titles((await get(other, { type: "discover", limit: 20 })).body.Data.discover)).toContain("Celeste");
    });

    for (const [label, body] of [
      ["missing rawgId", {}],
      ["string rawgId", { rawgId: "28" }],
      ["negative rawgId", { rawgId: -1 }],
      ["non-text title", { rawgId: 28, title: 5 }],
    ] as const) {
      test(`dismiss rejects ${label} with 400 @negative`, async ({ api }) => {
        expect((await api.post("/recommendations/dismiss", body)).status()).toBe(400);
      });
    }

    test("restoring something that was never dismissed returns 404 @negative", async ({ api }) => {
      const res = await api.delete("/recommendations/dismiss/28");
      expect(res.status()).toBe(404);
      expect((await json(res)).error).toBe("That game wasn't dismissed");
      expect((await api.delete("/recommendations/dismiss/abc")).status()).toBe(400);
    });
  });
});
