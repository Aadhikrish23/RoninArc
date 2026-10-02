import { test, expect } from "../../fixtures/test";
import { json } from "../../helpers/api";
import { RAWG_FAILURE_QUERY, byName } from "../../fixtures/catalog.mjs";

test.describe("RAWG proxy API (/rawg)", () => {
  test("search returns discoverable games in the app's shape @positive", async ({ api }) => {
    const res = await api.get("/rawg/search", { query: "hollow" });
    expect(res.status()).toBe(200);
    const { Data } = await json(res);
    expect(Data).toMatchObject({ owned: [], totalOwned: 0, totalDiscover: 1 });
    expect(Data.discover[0]).toMatchObject({ id: byName("Hollow Knight").id, name: "Hollow Knight", genres: ["Platformer", "Indie"] });
    expect(Data.discover[0].imageURL).toEqual(expect.any(String));
  });

  test("games already in the library move from discover to owned @positive", async ({ api }) => {
    await api.addGame(byName("Hades"));
    const { Data } = await json(await api.get("/rawg/search", { query: "Hades" }));
    expect(Data.owned.map((g: any) => g.title)).toEqual(["Hades"]);
    expect(Data.discover).toEqual([]);
  });

  test("an invalid page number falls back to page 1 @negative", async ({ api }) => {
    const res = await api.get("/rawg/search", { query: "celeste", page: "-3" });
    expect(res.status()).toBe(200);
    expect((await json(res)).Data.totalDiscover).toBe(1);
  });

  test("a search with no matches returns empty lists @positive", async ({ api }) => {
    const { Data } = await json(await api.get("/rawg/search", { query: "no such game anywhere" }));
    expect(Data).toEqual({ owned: [], discover: [], totalOwned: 0, totalDiscover: 0 });
  });

  test("returns full game details by RAWG id @positive", async ({ api }) => {
    const elden = byName("Elden Ring");
    const res = await api.get(`/rawg/${elden.id}`);
    expect(res.status()).toBe(200);
    expect((await json(res)).Data).toMatchObject({
      id: elden.id,
      name: "Elden Ring",
      developers: ["FromSoftware"],
      platforms: ["PC"],
      screenshots: [expect.any(String)],
      trailers: [],
    });
  });

  test("rejects a missing or blank query with 400 @negative", async ({ api }) => {
    for (const params of [{}, { query: "   " }]) {
      const res = await api.get("/rawg/search", params);
      expect(res.status()).toBe(400);
      expect((await json(res)).error).toBe("Search query is required");
    }
  });

  test("an upstream RAWG failure surfaces as 502 @negative", async ({ api }) => {
    const res = await api.get("/rawg/search", { query: RAWG_FAILURE_QUERY });
    expect(res.status()).toBe(502);
    expect((await json(res)).error).toBe("Failed to fetch RAWG data");
  });

  test("an unknown RAWG id returns 404 @negative", async ({ api }) => {
    const res = await api.get("/rawg/123456789");
    expect(res.status()).toBe(404);
    expect((await json(res)).error).toBe("RAWG game not found");
  });

  test("requires authentication @negative", async ({ anon }) => {
    expect((await anon.get("/rawg/search", { query: "hades" })).status()).toBe(401);
    expect((await anon.get("/rawg/28")).status()).toBe(401);
  });
});
