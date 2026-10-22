import { test, expect } from "../../fixtures/test";
import { Api, DEFAULT_PASSWORD, json, registerUser, uniqueName, type RegisteredUser } from "../../helpers/api";
import { byName } from "../../fixtures/catalog.mjs";
import { API_URL, CLOUD_AI_LIMIT, CLOUD_URL, RESEND_URL } from "../../env";

// A PC (the suite's backend, local mode) syncing with RoninArc Cloud (a second backend, cloud
// mode). "On the phone" = calling the cloud's API directly, as the mobile app does.

async function cloudSignIn(request: any, username: string, password = DEFAULT_PASSWORD): Promise<Api> {
  const res = await request.post(`${CLOUD_URL}/auth/login`, { data: { username, password } });
  expect(res.status(), await res.text()).toBe(200);
  return new Api(request, CLOUD_URL, (await res.json()).Data.accessToken);
}

async function link(api: Api, user: RegisteredUser, extra: Record<string, unknown> = {}) {
  const res = await api.post("/sync/link", { mode: "create", username: user.username, email: user.email, password: user.password, ...extra });
  const body = await json(res);
  expect(res.status(), JSON.stringify(body)).toBe(200);
  return body;
}

const syncNow = async (api: Api) => json(await api.post("/sync/now"));
const titles = async (api: Api) => ((await json(await api.get("/game"))).Data as any[]).map((g) => g.title).sort();
const gameByTitle = async (api: Api, title: string) => ((await json(await api.get("/game"))).Data as any[]).find((g) => g.title === title);

test.describe("Sync with RoninArc Cloud", () => {
  test("a PC isn't linked until asked, and says sync is available @positive", async ({ api }) => {
    const status = await json(await api.get("/sync/status"));
    expect(status).toMatchObject({ available: true, linked: false, pending: { changes: 0, deletes: 0 } });
  });

  test("linking uploads the whole library, keeping the same account @positive", async ({ api, user, request }) => {
    const hades = await api.addGame(byName("Hades"));
    await api.post(`/notes/${hades._id}`, { content: "beat Meg first" });
    await api.put(`/review/${hades._id}`, { rating: 9, reviewText: "so good" });
    const col = await api.createCollection("Roguelikes");
    await api.post(`/collection/${col._id}/games`, { gameId: hades._id });

    const status = await link(api, user);
    expect(status).toMatchObject({ linked: true, cloudUsername: user.username, lastError: null, pending: { changes: 0, deletes: 0 } });

    const phone = await cloudSignIn(request, user.username);
    const cloudHades = await gameByTitle(phone, "Hades");
    expect(cloudHades._id).toBe(hades._id);
    expect((await json(await phone.get(`/notes/${hades._id}`))).Data.map((n: any) => n.content)).toEqual(["beat Meg first"]);
    expect((await json(await phone.get(`/review/${hades._id}`))).Data).toMatchObject({ rating: 9 });
    const cols = (await json(await phone.get("/collection"))).Data;
    expect(cols.find((c: any) => c.name === "Roguelikes").gameIds.map((g: any) => String(g._id ?? g))).toContain(hades._id);
  });

  test("changes made on the phone reach the PC, and the PC's reach the phone @positive", async ({ api, user, request }) => {
    const celeste = await api.addGame(byName("Celeste"));
    await link(api, user);
    const phone = await cloudSignIn(request, user.username);

    await phone.patch(`/game/${celeste._id}`, { progressStatus: "completed" });
    await phone.addGame(byName("Hollow Knight"));
    await syncNow(api);
    expect(await titles(api)).toEqual(["Celeste", "Hollow Knight"]);
    expect((await gameByTitle(api, "Celeste")).progressStatus).toBe("completed");

    await api.patch(`/game/${celeste._id}`, { progressStatus: "playing" });
    await syncNow(api);
    expect((await gameByTitle(phone, "Celeste")).progressStatus).toBe("playing");
  });

  test("deleting on either side deletes on the other, with the game's notes @positive", async ({ api, user, request }) => {
    const hades = await api.addGame(byName("Hades"));
    const celeste = await api.addGame(byName("Celeste"));
    await api.post(`/notes/${celeste._id}`, { content: "strawberries" });
    await link(api, user);
    const phone = await cloudSignIn(request, user.username);

    await api.delete(`/game/${hades._id}`);
    await syncNow(api);
    expect(await titles(phone)).toEqual(["Celeste"]);

    await phone.delete(`/game/${celeste._id}`);
    await syncNow(api);
    expect(await titles(api)).toEqual([]);
    const notes = await api.get(`/notes/${celeste._id}`);
    expect(notes.status() === 404 || (await json(notes)).Data?.length === 0).toBe(true);
  });

  test("a game's .exe path stays on its PC @negative", async ({ api, user, request }) => {
    const hades = await api.addGame(byName("Hades"), { exePath: "C:\\Games\\Hades\\Hades.exe" });
    await link(api, user);
    const phone = await cloudSignIn(request, user.username);
    expect((await gameByTitle(phone, "Hades")).exePath ?? "").toBe("");

    await phone.patch(`/game/${hades._id}`, { progressStatus: "playing" });
    await syncNow(api);
    const local = await gameByTitle(api, "Hades");
    expect(local.progressStatus).toBe("playing");
    expect(local.exePath).toBe("C:\\Games\\Hades\\Hades.exe");
  });

  test("the same game changed on both: the later change wins @positive", async ({ api, user, request }) => {
    const hades = await api.addGame(byName("Hades"));
    await link(api, user);
    const phone = await cloudSignIn(request, user.username);

    await api.patch(`/game/${hades._id}`, { progressStatus: "paused" }); // earlier
    await new Promise((r) => setTimeout(r, 50));
    await phone.patch(`/game/${hades._id}`, { progressStatus: "completed" }); // later
    await syncNow(api);
    expect((await gameByTitle(api, "Hades")).progressStatus).toBe("completed");
    expect((await gameByTitle(phone, "Hades")).progressStatus).toBe("completed");
  });

  test("signing in to an existing cloud account merges this PC's library into it @positive", async ({ api, user, request }) => {
    // The phone account came first, with Hades and a note.
    const cloudUser = await registerUser(request, CLOUD_URL, { username: uniqueName("phone") });
    const phone = new Api(request, CLOUD_URL, cloudUser.accessToken);
    const cloudHades = await phone.addGame(byName("Hades"));
    await phone.post(`/notes/${cloudHades._id}`, { content: "from the phone" });
    const phoneCol = await phone.createCollection("Favourites");
    await phone.post(`/collection/${phoneCol._id}/games`, { gameId: cloudHades._id });

    // This PC's own account has Hades too (another id), with a review, plus Celeste.
    const pcHades = await api.addGame(byName("Hades"));
    await api.put(`/review/${pcHades._id}`, { rating: 8 });
    const celeste = await api.addGame(byName("Celeste"));
    const pcCol = await api.createCollection("Favourites");
    await api.post(`/collection/${pcCol._id}/games`, { gameId: celeste._id });

    const res = await link(api, user, { mode: "signin", username: cloudUser.username, password: cloudUser.password, email: undefined });
    expect(res.moved).toBe(true);
    const pc = new Api(request, API_URL, res.session.accessToken);
    await syncNow(pc);

    for (const side of [pc, phone]) {
      expect(await titles(side)).toEqual(["Celeste", "Hades"]);
      const h = await gameByTitle(side, "Hades");
      expect(h._id).toBe(cloudHades._id); // one Hades: the cloud's
      expect((await json(await side.get(`/notes/${h._id}`))).Data.map((n: any) => n.content)).toEqual(["from the phone"]);
      expect((await json(await side.get(`/review/${h._id}`))).Data).toMatchObject({ rating: 8 });
      const favs = (await json(await side.get("/collection"))).Data.filter((c: any) => c.name === "Favourites");
      expect(favs).toHaveLength(1);
      expect(favs[0].gameIds.map((g: any) => String(g._id ?? g)).sort()).toEqual([celeste._id, cloudHades._id].sort());
    }
  });

  test("a new PC signs in with the cloud account and gets the library @positive", async ({ request }) => {
    const cloudUser = await registerUser(request, CLOUD_URL, { username: uniqueName("newpc") });
    const phone = new Api(request, CLOUD_URL, cloudUser.accessToken);
    await phone.addGame(byName("Celeste"));

    const res = await request.post(`${API_URL}/auth/login`, { data: { username: cloudUser.username, password: cloudUser.password } });
    expect(res.status(), await res.text()).toBe(200);
    const pc = new Api(request, API_URL, (await res.json()).Data.accessToken);
    expect(await titles(pc)).toEqual(["Celeste"]);
    expect(await json(await pc.get("/sync/status"))).toMatchObject({ linked: true, cloudUsername: cloudUser.username });
  });

  test("a wrong password still fails on the PC, cloud or not @negative", async ({ api, user, request }) => {
    await link(api, user);
    const res = await request.post(`${API_URL}/auth/login`, { data: { username: user.username, password: "not-the-password" } });
    expect(res.status()).toBe(401);
  });

  test("changing the password on the phone: the PC asks to sign in again, then syncs @positive", async ({ api, user, request }) => {
    await link(api, user);
    const phone = await cloudSignIn(request, user.username);
    expect((await phone.patch("/auth/change-password", { currentPassword: user.password, newPassword: "N3wPassw0rd!" })).status()).toBe(200);

    await syncNow(api);
    expect(await json(await api.get("/sync/status"))).toMatchObject({ needsSignIn: true });
    const again = await json(await api.post("/sync/reconnect", { password: "N3wPassw0rd!" }));
    expect(again).toMatchObject({ needsSignIn: false, lastError: null });
  });

  test("unlinking keeps the library on the PC @positive", async ({ api, user }) => {
    await api.addGame(byName("Hades"));
    await link(api, user);
    const status = await json(await api.post("/sync/unlink"));
    expect(status).toMatchObject({ linked: false });
    expect(await titles(api)).toEqual(["Hades"]);
  });

  test("linking twice, or with a name the cloud already has, is refused @negative", async ({ api, user, request }) => {
    const taken = await registerUser(request, CLOUD_URL, { username: uniqueName("taken") });
    const clash = await api.post("/sync/link", { mode: "create", username: taken.username, email: `${uniqueName()}@example.com`, password: DEFAULT_PASSWORD });
    expect(clash.status()).toBe(409);
    await link(api, user);
    expect((await api.post("/sync/link", { mode: "create", username: user.username, email: user.email, password: user.password })).status()).toBe(409);
  });

  test("deleting the account on a linked PC deletes the cloud account too @positive", async ({ api, user, request }) => {
    await link(api, user);
    expect((await api.delete("/auth/account", { password: user.password })).status()).toBe(200);
    const res = await request.post(`${CLOUD_URL}/auth/login`, { data: { username: user.username, password: user.password } });
    expect(res.status()).toBe(401);
  });
});

test.describe("RoninArc Cloud accounts", () => {
  test("cloud accounts need an email, and one account per email @negative", async ({ request }) => {
    const noEmail = await request.post(`${CLOUD_URL}/auth/register`, { data: { username: uniqueName(), password: DEFAULT_PASSWORD } });
    expect(noEmail.status()).toBe(400);
    const first = await registerUser(request, CLOUD_URL);
    const again = await request.post(`${CLOUD_URL}/auth/register`, { data: { username: uniqueName(), password: DEFAULT_PASSWORD, email: first.email.toUpperCase() } });
    expect(again.status()).toBe(409);
  });

  test("forgot password emails a single-use link; the new password works on the phone and the PC @positive", async ({ api, user, request }) => {
    await link(api, user);
    // Asked from the PC: it goes through the cloud.
    const ask = await api.post("/auth/forgot-password", { identifier: user.email });
    expect(ask.status()).toBe(200);

    const emails = await (await request.get(`${RESEND_URL}/__emails?to=${encodeURIComponent(user.email)}`)).json();
    expect(emails).toHaveLength(1);
    expect(emails[0].subject).toBe("Reset your RoninArc password");
    const linkUrl = new URL(String(emails[0].text).match(/https?:\/\/\S+reset-password\?token=\S+/)![0]);
    expect(linkUrl.origin).toBe(new URL(CLOUD_URL).origin);

    const page = await request.get(linkUrl.toString());
    expect(page.status()).toBe(200);
    expect(await page.text()).toContain("Set a new password");

    const token = linkUrl.searchParams.get("token");
    expect((await request.post(`${CLOUD_URL}/auth/reset-password`, { data: { token, password: "Res3tPass!" } })).status()).toBe(200);
    expect((await request.post(`${CLOUD_URL}/auth/reset-password`, { data: { token, password: "Another1!" } })).status()).toBe(400);

    expect((await request.post(`${CLOUD_URL}/auth/login`, { data: { username: user.username, password: "Res3tPass!" } })).status()).toBe(200);
    // The PC: the new password signs in (the cloud vouches for it, then its hash comes down).
    expect((await request.post(`${API_URL}/auth/login`, { data: { username: user.username, password: "Res3tPass!" } })).status()).toBe(200);
  });

  test("forgot password never reveals whether an account exists @negative", async ({ request }) => {
    const res = await request.post(`${CLOUD_URL}/auth/forgot-password`, { data: { identifier: `${uniqueName()}@nowhere.example` } });
    expect(res.status()).toBe(200);
    expect((await res.json()).Message).toMatch(/If an account matches/);
  });

  test("each cloud user has a daily AI allowance @negative", async ({ request }) => {
    const u = await registerUser(request, CLOUD_URL);
    const phone = new Api(request, CLOUD_URL, u.accessToken);
    for (let i = 0; i < CLOUD_AI_LIMIT; i++) {
      const r = await json(await phone.post("/ai/chat", { message: "hi" }));
      expect(r.status).not.toBe("LIMITED");
    }
    const over = await json(await phone.post("/ai/chat", { message: "hi" }));
    expect(over).toMatchObject({ success: false, status: "LIMITED" });
  });

  test("a PC can't push into someone else's account @negative", async ({ request }) => {
    const alice = await registerUser(request, CLOUD_URL);
    const bob = await registerUser(request, CLOUD_URL);
    const aliceGame = await new Api(request, CLOUD_URL, alice.accessToken).addGame(byName("Hades"));
    const res = await request.post(`${CLOUD_URL}/sync/push`, {
      headers: { Authorization: `Bearer ${bob.accessToken}` },
      data: { changes: { games: [{ _id: { $oid: aliceGame._id }, title: "pwned", updatedAt: { $date: new Date(Date.now() + 1e9).toISOString() } }] }, deletes: [{ coll: "games", id: aliceGame._id, deletedAt: new Date().toISOString() }] },
    });
    expect(res.status()).toBe(200);
    expect((await gameByTitle(new Api(request, CLOUD_URL, alice.accessToken), "Hades"))._id).toBe(aliceGame._id);
  });
});
