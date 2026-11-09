import { test, expect } from "../../fixtures/test";
import { Api, DEFAULT_PASSWORD, json, registerUser, uniqueName } from "../../helpers/api";
import { makeLegacyPcAccount } from "../../helpers/db";
import { byName } from "../../fixtures/catalog.mjs";
import { API_URL, CLOUD_URL } from "../../env";

// Getting a PC's library onto a phone without Settings: the "Sync with my other devices" box at
// sign-in (auto-link), a 6-digit code / QR the PC shows, a phone trading it for a session, and
// email sign-in (an email that already has a cloud account, or an account with no email yet).

const status = async (api: Api) => json(await api.get("/sync/status"));
const claim = (request: any, code: string) => request.post(`${CLOUD_URL}/sync/link-code/claim`, { data: { code } });
const cloudLogin = (request: any, email: string, password = DEFAULT_PASSWORD, headers: Record<string, string> = {}) =>
  request.post(`${CLOUD_URL}/auth/login`, { data: { email, password }, headers });

test.describe("Sync with my other devices (auto-link at sign-in)", () => {
  test("links this PC straight away and uploads the library @positive", async ({ api, user, request }) => {
    const hades = await api.addGame(byName("Hades"));
    const body = await json(await api.post("/sync/auto-link", { password: user.password }));
    expect(body).toMatchObject({ result: "linked", linked: true, cloudEmail: user.email, autoLink: null, moved: false });
    const phone = await cloudLogin(request, user.email);
    const cloud = new Api(request, CLOUD_URL, (await phone.json()).Data.accessToken);
    expect(((await json(await cloud.get("/game"))).Data as any[]).map((g) => g._id)).toEqual([hades._id]);
  });

  test("a second call when already linked changes nothing @negative", async ({ api, user }) => {
    await api.post("/sync/auto-link", { password: user.password });
    const again = await json(await api.post("/sync/auto-link", { password: user.password }));
    expect(again).toMatchObject({ result: "linked", linked: true, moved: false });
  });

  test("signed up on the phone first (same email and password): signs in to that account and merges @positive", async ({ request }) => {
    const name = uniqueName("same");
    // The phone made the cloud account first, with a game in it.
    const onPhone = await registerUser(request, CLOUD_URL, { username: name });
    const phone = new Api(request, CLOUD_URL, onPhone.accessToken);
    await phone.addGame(byName("Celeste"));
    // Then the PC account, same email and password, with its own game.
    const pcUser = await registerUser(request, API_URL, { username: "On The PC", email: onPhone.email });
    const pc = new Api(request, API_URL, pcUser.accessToken);
    await pc.addGame(byName("Hades"));

    const body = await json(await pc.post("/sync/auto-link", { password: DEFAULT_PASSWORD }));
    expect(body).toMatchObject({ result: "linked", linked: true, moved: true, cloudEmail: onPhone.email });
    expect(body.session?.accessToken).toEqual(expect.any(String));
    // The app carries on as the cloud account (its name, the same email).
    expect(body.session.userdata).toMatchObject({ email: onPhone.email });
    const after = new Api(request, API_URL, body.session.accessToken);
    await after.post("/sync/now");
    const titles = ((await json(await after.get("/game"))).Data as any[]).map((g) => g.title).sort();
    expect(titles).toEqual(["Celeste", "Hades"]);
  });

  test("the email already has a cloud account with another password: needs attention, then its password links it @negative", async ({ api, user, request }) => {
    await registerUser(request, CLOUD_URL, { username: "Cloud Me", email: user.email, password: "Someone3lse!" });
    const body = await json(await api.post("/sync/auto-link", { password: user.password }));
    expect(body).toMatchObject({
      result: "needs-attention",
      linked: false,
      autoLink: { waiting: false, attention: "email-taken", message: "That email already has a RoninArc Cloud account. Enter its password to sync with it." },
    });
    expect(body.autoLink).not.toHaveProperty("suggestions");
    // The local account is untouched: still signed in, still working.
    expect((await api.get("/game")).status()).toBe(200);

    // A wrong password keeps it waiting; the cloud account's password links and merges.
    expect((await api.post("/sync/link", { mode: "signin", email: user.email, password: "not-it-either" })).status()).toBe(401);
    const linked = await json(await api.post("/sync/link", { mode: "signin", email: user.email, password: "Someone3lse!" }));
    expect(linked).toMatchObject({ linked: true, cloudEmail: user.email, autoLink: null, moved: true });
  });

  test("an account with no email waits for one; adding it turns sync on @positive", async ({ anon, request }) => {
    const u = await registerUser(request, API_URL);
    const oldName = await makeLegacyPcAccount(u.email);
    const pc = new Api(request, API_URL, (await json(await anon.post("/auth/login", { username: oldName, password: u.password }))).Data.accessToken);

    const body = await json(await pc.post("/sync/auto-link", { password: u.password }));
    expect(body).toMatchObject({ result: "needs-attention", linked: false, autoLink: { attention: "needs-email", message: "Add your email to turn on sync." } });
    expect((await pc.post("/sync/link", { mode: "create" })).status()).toBe(400);

    const email = `${uniqueName("later")}@example.com`;
    expect((await pc.patch("/auth/email", { email, password: u.password })).status()).toBe(200);
    // It links in the background right after.
    await expect.poll(async () => (await status(pc)).linked, { timeout: 30_000 }).toBe(true);
    expect(await status(pc)).toMatchObject({ cloudEmail: email, autoLink: null });
    expect((await cloudLogin(request, email, u.password)).status()).toBe(200);
  });

  test("'not now' drops the pending link @positive", async ({ api, user, request }) => {
    await registerUser(request, CLOUD_URL, { username: "Cloud Me", email: user.email, password: "Someone3lse!" });
    await api.post("/sync/auto-link", { password: user.password });
    expect((await status(api)).autoLink).not.toBeNull();
    expect((await json(await api.delete("/sync/auto-link"))).autoLink).toBeNull();
  });

  test("requires sign-in @negative", async ({ anon }) => {
    expect((await anon.post("/sync/auto-link", {})).status()).toBe(401);
    expect((await anon.post("/sync/phone-code")).status()).toBe(401);
  });

  test("there's no cloud name check any more (names don't have to be unique) @negative", async ({ request }) => {
    expect((await request.get(`${API_URL}/sync/name-available`, { params: { username: "ronin" } })).status()).toBe(404);
    expect((await request.get(`${CLOUD_URL}/sync/name-available`, { params: { username: "ronin" } })).status()).toBe(404);
  });
});

test.describe("A code (and QR) from the PC signs the phone in", () => {
  test("a PC that doesn't sync yet can't make one @negative", async ({ api }) => {
    const res = await api.post("/sync/phone-code");
    expect(res.status()).toBe(409);
    expect((await json(res)).error).toBe("Sync this PC with RoninArc Cloud first.");
  });

  test("the phone trades the code for a session on the same account; the code works once @positive", async ({ api, user, request }) => {
    await api.addGame(byName("Hades"));
    await api.post("/sync/link", { mode: "create" });
    const made = await api.post("/sync/phone-code");
    expect(made.status()).toBe(201);
    const { code, expiresAt } = await json(made);
    expect(code).toMatch(/^\d{6}$/);
    const ttl = Date.parse(expiresAt) - Date.now();
    expect(ttl).toBeGreaterThan(9 * 60_000);
    expect(ttl).toBeLessThanOrEqual(10 * 60_000 + 5000);

    // Scanned QR text works as well as typed digits.
    const res = await claim(request, `roninarc://link/${code}`);
    expect(res.status(), await res.text()).toBe(200);
    const session = (await res.json()).Data;
    expect(session.userdata).toMatchObject({ name: user.username, email: user.email });
    const phone = new Api(request, CLOUD_URL, session.accessToken);
    expect(((await json(await phone.get("/game"))).Data as any[]).map((g) => g.title)).toEqual(["Hades"]);

    const again = await claim(request, code);
    expect(again.status()).toBe(400);

    // The PC learns a phone is in, so it stops offering "get your library on your phone".
    await api.post("/sync/now");
    expect((await status(api)).phoneLinked).toBe(true);
  });

  test("a new code replaces the old one @negative", async ({ api, request }) => {
    await api.post("/sync/link", { mode: "create" });
    const first = (await json(await api.post("/sync/phone-code"))).code;
    const second = (await json(await api.post("/sync/phone-code"))).code;
    if (first !== second) expect((await claim(request, first)).status()).toBe(400);
    expect((await claim(request, second)).status()).toBe(200);
  });

  for (const [label, code] of [
    ["too few digits", "12345"],
    ["letters", "abcdef"],
    ["a code nobody made", "000000"],
  ] as const) {
    test(`a bad code is refused: ${label} @negative`, async ({ request }) => {
      const res = await claim(request, code);
      expect(res.status()).toBe(400);
    });
  }
});

test.describe("Signing in with an email", () => {
  test("the cloud takes the account's email in any case, and refuses its name @positive", async ({ request }) => {
    const u = await registerUser(request, CLOUD_URL);
    const res = await cloudLogin(request, u.email.toUpperCase());
    expect(res.status(), await res.text()).toBe(200);
    expect((await res.json()).Data.userdata.name).toBe(u.username);
    expect((await cloudLogin(request, u.email, "Wr0ngPass!")).status()).toBe(401);
    const byName = await request.post(`${CLOUD_URL}/auth/login`, { data: { username: u.username, password: DEFAULT_PASSWORD } });
    expect(byName.status()).toBe(400);
    expect((await byName.json()).error).toBe("Sign in with your email address and password.");
  });

  test("a PC sign-in with the cloud account's email brings the account down, name and all @positive", async ({ request }) => {
    const u = await registerUser(request, CLOUD_URL, { username: "Phone Person", email: `${uniqueName("down")}@example.com` });
    const res = await request.post(`${API_URL}/auth/login`, { data: { email: u.email, password: DEFAULT_PASSWORD } });
    expect(res.status(), await res.text()).toBe(200);
    expect((await res.json()).Data.userdata).toMatchObject({ name: "Phone Person", email: u.email });
  });

  test("a phone signing in tells the PC a phone uses the account @positive", async ({ api, user, request }) => {
    await api.post("/sync/link", { mode: "create" });
    expect((await status(api)).phoneLinked).toBe(false);
    expect((await cloudLogin(request, user.email, DEFAULT_PASSWORD, { "X-RoninArc-Client": "phone" })).status()).toBe(200);
    await api.post("/sync/now");
    expect((await status(api)).phoneLinked).toBe(true);
  });
});
