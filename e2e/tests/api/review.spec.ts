import { test, expect } from "../../fixtures/test";
import { Api, MISSING_ID, json, registerUser } from "../../helpers/api";
import { byName } from "../../fixtures/catalog.mjs";
import { API_URL } from "../../env";

const hades = byName("Hades");

test.describe("Review API (/review)", () => {
  test("creates a review, trimming the text, and logs REVIEW_CREATED @positive", async ({ api }) => {
    const game = await api.addGame(hades);
    const res = await api.put(`/review/${game._id}`, { rating: 9, reviewText: "  Fantastic loop  " });
    expect(res.status()).toBe(200);
    expect((await json(res)).Data).toMatchObject({ gameId: game._id, rating: 9, reviewText: "Fantastic loop" });

    const activity = await json(await api.get("/activity"));
    expect(activity.Data.some((a: any) => a.type === "REVIEW_CREATED" && a.message === "Reviewed a game (9/10)")).toBe(true);
  });

  test("reads back the review for a game @positive", async ({ api }) => {
    const game = await api.addGame(hades);
    await api.put(`/review/${game._id}`, { rating: 7, reviewText: "Good" });
    const res = await api.get(`/review/${game._id}`);
    expect(res.status()).toBe(200);
    expect((await json(res)).Data).toMatchObject({ rating: 7, reviewText: "Good" });
  });

  test("returns null data for a game with no review @positive", async ({ api }) => {
    const game = await api.addGame(hades);
    const res = await api.get(`/review/${game._id}`);
    expect(res.status()).toBe(200);
    expect((await json(res)).Data).toBeNull();
  });

  test("updating keeps a single review and logs REVIEW_UPDATED @positive", async ({ api }) => {
    const game = await api.addGame(hades);
    await api.put(`/review/${game._id}`, { rating: 6 });
    const res = await api.put(`/review/${game._id}`, { rating: 10, reviewText: "Grew on me" });
    expect((await json(res)).Data).toMatchObject({ rating: 10, reviewText: "Grew on me" });

    const activity = (await json(await api.get("/activity"))).Data;
    expect(activity.filter((a: any) => a.type === "REVIEW_CREATED")).toHaveLength(1);
    expect(activity.filter((a: any) => a.type === "REVIEW_UPDATED")).toHaveLength(1);
  });

  test("re-saving an identical review does not log another activity @positive", async ({ api }) => {
    const game = await api.addGame(hades);
    await api.put(`/review/${game._id}`, { rating: 8, reviewText: "Same" });
    await api.put(`/review/${game._id}`, { rating: 8, reviewText: "Same" });
    const activity = (await json(await api.get("/activity"))).Data;
    expect(activity.filter((a: any) => a.type.startsWith("REVIEW_"))).toHaveLength(1);
  });

  test("the rating shows up on the library listing @positive", async ({ api }) => {
    const game = await api.addGame(hades);
    await api.put(`/review/${game._id}`, { rating: 5 });
    const lib = (await json(await api.get("/game"))).Data;
    expect(lib[0].rating).toBe(5);
  });

  test("deletes a review and logs REVIEW_DELETED @positive", async ({ api }) => {
    const game = await api.addGame(hades);
    await api.put(`/review/${game._id}`, { rating: 4 });
    const res = await api.delete(`/review/${game._id}`);
    expect(res.status()).toBe(200);
    expect((await json(res)).Message).toBe("Review deleted");
    expect((await json(await api.get(`/review/${game._id}`))).Data).toBeNull();
    const activity = (await json(await api.get("/activity"))).Data;
    expect(activity.some((a: any) => a.type === "REVIEW_DELETED")).toBe(true);
  });

  test("deleting a non-existent review is a harmless no-op @negative", async ({ api }) => {
    const res = await api.delete(`/review/${MISSING_ID}`);
    expect(res.status()).toBe(200);
    const activity = (await json(await api.get("/activity"))).Data;
    expect(activity.some((a: any) => a.type === "REVIEW_DELETED")).toBe(false);
  });

  test("a malformed game id is rejected @negative", async ({ api }) => {
    const get = await api.get("/review/not-an-id");
    expect(get.status()).toBeGreaterThanOrEqual(400);
    const put = await api.put("/review/not-an-id", { rating: 5 });
    expect(put.status()).toBeGreaterThanOrEqual(400);
    expect((await json(put)).Message).toBe("Failed to save review");
  });

  test("users cannot read each other's reviews @negative", async ({ api, request }) => {
    const game = await api.addGame(hades);
    await api.put(`/review/${game._id}`, { rating: 9, reviewText: "Private thoughts" });
    const intruder = new Api(request, API_URL, (await registerUser(request, API_URL)).accessToken);
    expect((await json(await intruder.get(`/review/${game._id}`))).Data).toBeNull();
  });

  test("rejects a rating above 10 @negative", async ({ api }) => {
    test.fail(true, "Known bug: upsert uses findOneAndUpdate without runValidators, so min/max on rating are never enforced");
    const game = await api.addGame(hades);
    const res = await api.put(`/review/${game._id}`, { rating: 99 });
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });

  test("rejects a rating below 1 @negative", async ({ api }) => {
    test.fail(true, "Known bug: rating min (1) is not enforced on upsert");
    const game = await api.addGame(hades);
    const res = await api.put(`/review/${game._id}`, { rating: 0 });
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });

  test("rejects reviewing a game that is not in the user's library @negative", async ({ api, request }) => {
    test.fail(true, "Known bug: upsertReview never checks the game belongs to the caller");
    const other = new Api(request, API_URL, (await registerUser(request, API_URL)).accessToken);
    const foreignGame = await other.addGame(hades);
    const res = await api.put(`/review/${foreignGame._id}`, { rating: 1, reviewText: "drive-by" });
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });

  test("requires authentication @negative", async ({ anon }) => {
    expect((await anon.get(`/review/${MISSING_ID}`)).status()).toBe(401);
    expect((await anon.put(`/review/${MISSING_ID}`, { rating: 5 })).status()).toBe(401);
    expect((await anon.delete(`/review/${MISSING_ID}`)).status()).toBe(401);
  });
});
