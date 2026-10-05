import { test, expect } from "../../fixtures/test";
import { Api, MISSING_ID, json, registerUser } from "../../helpers/api";
import { byName } from "../../fixtures/catalog.mjs";
import { API_URL } from "../../env";

const hades = byName("Hades");

test.describe("Notes API (/notes)", () => {
  test("creates a trimmed note and logs NOTE_CREATED @positive", async ({ api }) => {
    const game = await api.addGame(hades);
    const res = await api.post(`/notes/${game._id}`, { content: "  Beat Megaera with the spear  " });
    expect(res.status()).toBe(201);
    expect((await json(res)).Data).toMatchObject({ gameId: game._id, content: "Beat Megaera with the spear" });
    const activity = (await json(await api.get("/activity"))).Data;
    expect(activity.some((a: any) => a.type === "NOTE_CREATED")).toBe(true);
  });

  test("keeps multiple notes per game, newest first @positive", async ({ api }) => {
    const game = await api.addGame(hades);
    await api.post(`/notes/${game._id}`, { content: "first" });
    await api.post(`/notes/${game._id}`, { content: "second" });
    const { Data } = await json(await api.get(`/notes/${game._id}`));
    expect(Data.map((n: any) => n.content)).toEqual(["second", "first"]);
  });

  test("notes are scoped per game @positive", async ({ api }) => {
    const a = await api.addGame(hades);
    const b = await api.addGame(byName("Celeste"));
    await api.post(`/notes/${a._id}`, { content: "for hades" });
    expect((await json(await api.get(`/notes/${b._id}`))).Data).toEqual([]);
  });

  test("accepts exactly 2000 characters @positive", async ({ api }) => {
    const game = await api.addGame(hades);
    const res = await api.post(`/notes/${game._id}`, { content: "x".repeat(2000) });
    expect(res.status()).toBe(201);
  });

  test("updates a note @positive", async ({ api }) => {
    const game = await api.addGame(hades);
    const note = (await json(await api.post(`/notes/${game._id}`, { content: "draft" }))).Data;
    const res = await api.patch(`/notes/${note._id}`, { content: " final " });
    expect(res.status()).toBe(200);
    expect((await json(res)).Data.content).toBe("final");
  });

  test("deletes a note and logs NOTE_DELETED @positive", async ({ api }) => {
    const game = await api.addGame(hades);
    const note = (await json(await api.post(`/notes/${game._id}`, { content: "bye" }))).Data;
    const res = await api.delete(`/notes/${note._id}`);
    expect(res.status()).toBe(200);
    expect((await json(res)).Message).toBe("Note deleted");
    expect((await json(await api.get(`/notes/${game._id}`))).Data).toEqual([]);
    const activity = (await json(await api.get("/activity"))).Data;
    expect(activity.some((a: any) => a.type === "NOTE_DELETED")).toBe(true);
  });

  for (const [label, body] of [
    ["missing content", {}],
    ["empty content", { content: "" }],
    ["whitespace-only content", { content: "    " }],
  ] as const) {
    test(`rejects ${label} on create and update @negative`, async ({ api }) => {
      const game = await api.addGame(hades);
      const create = await api.post(`/notes/${game._id}`, body);
      expect(create.status()).toBe(400);
      expect((await json(create)).Message).toBe("Note content is required");

      const note = (await json(await api.post(`/notes/${game._id}`, { content: "ok" }))).Data;
      expect((await api.patch(`/notes/${note._id}`, body)).status()).toBe(400);
    });
  }

  test("rejects a note longer than 2000 characters @negative", async ({ api }) => {
    const game = await api.addGame(hades);
    const res = await api.post(`/notes/${game._id}`, { content: "x".repeat(2001) });
    expect(res.status()).toBe(400);
    expect((await json(res)).Message).toBe("Note must be 2000 characters or fewer");
    expect((await json(await api.get(`/notes/${game._id}`))).Data).toEqual([]);
  });

  test("returns 404 when updating or deleting a missing note @negative", async ({ api }) => {
    expect((await api.patch(`/notes/${MISSING_ID}`, { content: "x" })).status()).toBe(404);
    expect((await api.delete(`/notes/${MISSING_ID}`)).status()).toBe(404);
  });

  test("users cannot read, edit or delete each other's notes @negative", async ({ api, request }) => {
    const game = await api.addGame(hades);
    const note = (await json(await api.post(`/notes/${game._id}`, { content: "secret" }))).Data;
    const intruder = new Api(request, API_URL, (await registerUser(request, API_URL)).accessToken);

    expect((await json(await intruder.get(`/notes/${game._id}`))).Data).toEqual([]);
    expect((await intruder.patch(`/notes/${note._id}`, { content: "hacked" })).status()).toBe(404);
    expect((await intruder.delete(`/notes/${note._id}`)).status()).toBe(404);
    expect((await json(await api.get(`/notes/${game._id}`))).Data[0].content).toBe("secret");
  });

  test("rejects a malformed game id @negative", async ({ api }) => {
    const res = await api.post("/notes/not-an-id", { content: "x" });
    expect(res.status()).toBe(400);
    expect((await json(res)).Message).toBe("Invalid game id");
    expect((await api.get("/notes/not-an-id")).status()).toBe(400);
  });

  test("cannot add a note to a game that is not in the user's library @negative", async ({ api, request }) => {
    const other = new Api(request, API_URL, (await registerUser(request, API_URL)).accessToken);
    const foreign = await other.addGame(hades);
    const res = await api.post(`/notes/${foreign._id}`, { content: "drive-by" });
    expect(res.status()).toBe(404);
    expect((await json(res)).Message).toBe("Game not found in your library");
    expect((await json(await other.get(`/notes/${foreign._id}`))).Data).toEqual([]);
  });

  test("malformed note ids return 404 rather than 500 @negative", async ({ api }) => {
    expect((await api.patch("/notes/bogus", { content: "x" })).status()).toBe(404);
    expect((await api.delete("/notes/bogus")).status()).toBe(404);
  });

  test("rejects an update longer than 2000 characters @negative", async ({ api }) => {
    const game = await api.addGame(hades);
    const note = (await json(await api.post(`/notes/${game._id}`, { content: "short" }))).Data;
    const res = await api.patch(`/notes/${note._id}`, { content: "x".repeat(2001) });
    expect(res.status()).toBe(400);
    expect((await json(await api.get(`/notes/${game._id}`))).Data[0].content).toBe("short");
  });

  test("requires authentication @negative", async ({ anon }) => {
    expect((await anon.get(`/notes/${MISSING_ID}`)).status()).toBe(401);
    expect((await anon.post(`/notes/${MISSING_ID}`, { content: "x" })).status()).toBe(401);
  });
});
