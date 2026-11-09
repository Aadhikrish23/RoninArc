import jwt from "jsonwebtoken";
import { test, expect } from "../../fixtures/test";
import { Api, DEFAULT_PASSWORD, MISSING_ID, json, registerUser, uniqueName } from "../../helpers/api";
import { makeLegacyPcAccount } from "../../helpers/db";
import { API_URL } from "../../env";
import { byName } from "../../fixtures/catalog.mjs";

test.describe("Auth API", () => {
  test.describe("register", () => {
    test("creates an account and returns tokens @positive", async ({ anon }) => {
      const name = uniqueName("reg");
      const res = await anon.post("/auth/register", { displayName: "Ronin Reg", password: DEFAULT_PASSWORD, email: `${name}@example.com` });
      expect(res.status()).toBe(201);
      const body = await json(res);
      expect(body.Status).toBe("Success");
      expect(body.Data.userdata).toMatchObject({ name: "Ronin Reg", displayName: "Ronin Reg", email: `${name}@example.com` });
      expect(body.Data.accessToken).toEqual(expect.any(String));
      expect(body.Data.refreshToken).toMatch(/^[0-9a-f]{128}$/);
    });

    test("lower-cases and trims the email; it signs in whatever its case @positive", async ({ anon }) => {
      const base = uniqueName("case");
      const res = await anon.post("/auth/register", { displayName: "Case", email: `  ${base.toUpperCase()}@Example.COM  `, password: `  ${DEFAULT_PASSWORD}  ` });
      expect(res.status()).toBe(201);
      expect((await json(res)).Data.userdata.email).toBe(`${base}@example.com`);

      const login = await anon.post("/auth/login", { email: `${base.toUpperCase()}@EXAMPLE.com`, password: DEFAULT_PASSWORD });
      expect(login.status()).toBe(200);
    });

    test("display names don't have to be unique @positive", async ({ anon }) => {
      for (let i = 0; i < 2; i++) {
        const res = await anon.post("/auth/register", { displayName: "Ronin", email: `${uniqueName("same")}@example.com`, password: DEFAULT_PASSWORD });
        expect(res.status(), `account ${i + 1}`).toBe(201);
        expect((await json(res)).Data.userdata.name).toBe("Ronin");
      }
    });

    test("with no name, the part of the email before @ is the name @positive", async ({ anon }) => {
      const base = uniqueName("noname");
      const res = await anon.post("/auth/register", { email: `${base}@example.com`, password: DEFAULT_PASSWORD });
      expect(res.status()).toBe(201);
      expect((await json(res)).Data.userdata.name).toBe(base);
    });

    test("an app before 1.0.3 sending `username` still signs up (it's the name) @positive", async ({ anon }) => {
      const base = uniqueName("old");
      const res = await anon.post("/auth/register", { username: "OldApp Ronin", email: `${base}@example.com`, password: DEFAULT_PASSWORD });
      expect(res.status()).toBe(201);
      expect((await json(res)).Data.userdata.name).toBe("OldApp Ronin");
    });

    for (const [label, payload] of [
      ["missing email", { displayName: "someone", password: DEFAULT_PASSWORD }],
      ["missing password", { displayName: "someone", email: "someone@example.com" }],
      ["blank email", { email: "   ", password: DEFAULT_PASSWORD }],
      ["non-string password", { email: "someone@example.com", password: 123456 }],
      ["empty body", {}],
    ] as const) {
      test(`rejects ${label} with 400 @negative`, async ({ anon }) => {
        const res = await anon.post("/auth/register", payload);
        expect(res.status()).toBe(400);
        expect(await json(res)).toMatchObject({ error: "Email and password are required" });
      });
    }

    test("rejects something that isn't an email @negative", async ({ anon }) => {
      const res = await anon.post("/auth/register", { displayName: "x", email: "just-a-name", password: DEFAULT_PASSWORD });
      expect(res.status()).toBe(400);
      expect((await json(res)).error).toMatch(/valid email/);
    });

    test("rejects a password shorter than 6 characters @negative", async ({ anon }) => {
      const res = await anon.post("/auth/register", { email: `${uniqueName("short")}@example.com`, password: "12345" });
      expect(res.status()).toBe(400);
      expect((await json(res)).error).toBe("Use a password of at least 6 characters.");
    });

    test("rejects a duplicate email, case-insensitively, with 409 @negative", async ({ anon, user }) => {
      const res = await anon.post("/auth/register", { displayName: "Someone Else", email: user.email.toUpperCase(), password: `${DEFAULT_PASSWORD}-someone-else` });
      expect(res.status()).toBe(409);
      expect((await json(res)).error).toBe("An account with this email already exists. Sign in, or reset its password.");
    });

    test("repeating a sign-up that just succeeded signs you in instead of 'already exists' @positive", async ({ anon, user }) => {
      // A double click or a retry after a slow reply sends the same sign-up twice.
      const res = await anon.post("/auth/register", { displayName: user.username, email: user.email, password: DEFAULT_PASSWORD });
      expect(res.status()).toBe(201);
      expect((await json(res)).Data.accessToken).toBeTruthy();
    });
  });

  test.describe("login", () => {
    test("returns fresh tokens for a valid email and password @positive", async ({ anon, user }) => {
      const res = await anon.post("/auth/login", { email: user.email, password: user.password });
      expect(res.status()).toBe(200);
      const body = await json(res);
      expect(body.Data.userdata).toMatchObject({ name: user.username, email: user.email });
      expect(body.Data.accessToken).toEqual(expect.any(String));
      expect(body.Data.refreshToken).not.toBe(user.refreshToken);
    });

    test("an app before 1.0.3 sending the email as `username` still signs in @positive", async ({ anon, user }) => {
      expect((await anon.post("/auth/login", { username: user.email, password: user.password })).status()).toBe(200);
    });

    test("signing in with a name instead of the email is refused with a clear message @negative", async ({ anon, user }) => {
      for (const body of [{ username: user.username, password: user.password }, { email: user.username, password: user.password }]) {
        const res = await anon.post("/auth/login", body);
        expect(res.status()).toBe(400);
        expect((await json(res)).error).toBe("Sign in with your email address and password.");
      }
    });

    test("rejects a wrong password with 401 @negative", async ({ anon, user }) => {
      const res = await anon.post("/auth/login", { email: user.email, password: "WrongPass123" });
      expect(res.status()).toBe(401);
      expect((await json(res)).error).toBe("Wrong email or password.");
    });

    test("rejects an unknown email with the same 401 (no account enumeration) @negative", async ({ anon }) => {
      const res = await anon.post("/auth/login", { email: `${uniqueName("ghost")}@example.com`, password: DEFAULT_PASSWORD });
      expect(res.status()).toBe(401);
      expect((await json(res)).error).toBe("Wrong email or password.");
    });

    test("rejects missing credentials with 400 @negative", async ({ anon }) => {
      const res = await anon.post("/auth/login", { email: "" });
      expect(res.status()).toBe(400);
    });
  });

  test.describe("accounts made before email sign-in (PC)", () => {
    test("one with no email still signs in with its old name, and is asked for an email @positive", async ({ anon, request }) => {
      const user = await registerUser(request, API_URL);
      const oldName = await makeLegacyPcAccount(user.email);
      const res = await anon.post("/auth/login", { username: oldName, password: user.password });
      expect(res.status()).toBe(200);
      const body = await json(res);
      expect(body.Data.userdata).toMatchObject({ name: oldName, email: null });
      const me = await json(await new Api(request, API_URL, body.Data.accessToken).get("/auth/me"));
      expect(me.Data).toMatchObject({ needsEmail: true, email: null, displayName: oldName });
    });

    test("adding an email (password-confirmed) makes it sign in by email only @positive", async ({ anon, request }) => {
      const user = await registerUser(request, API_URL);
      const oldName = await makeLegacyPcAccount(user.email);
      const session = await json(await anon.post("/auth/login", { username: oldName, password: user.password }));
      const api = new Api(request, API_URL, session.Data.accessToken);
      const newEmail = `${uniqueName("added")}@example.com`;

      const res = await api.patch("/auth/email", { email: newEmail.toUpperCase(), password: user.password });
      expect(res.status()).toBe(200);
      expect((await json(res)).Data).toMatchObject({ email: newEmail });
      expect((await json(await api.get("/auth/me"))).Data.needsEmail).toBe(false);

      expect((await anon.post("/auth/login", { email: newEmail, password: user.password })).status()).toBe(200);
      // The old name is for accounts without an email only.
      expect((await anon.post("/auth/login", { username: oldName, password: user.password })).status()).toBe(400);
    });

    test("adding an email needs the right password, a real email, and one no one else uses @negative", async ({ anon, request }) => {
      const other = await registerUser(request, API_URL);
      const user = await registerUser(request, API_URL);
      const oldName = await makeLegacyPcAccount(user.email);
      const api = new Api(request, API_URL, (await json(await anon.post("/auth/login", { username: oldName, password: user.password }))).Data.accessToken);

      const wrong = await api.patch("/auth/email", { email: `${uniqueName("x")}@example.com`, password: "not-it" });
      expect(wrong.status()).toBe(401);
      expect((await json(wrong)).error).toBe("Wrong password.");

      const notEmail = await api.patch("/auth/email", { email: "nope", password: user.password });
      expect(notEmail.status()).toBe(400);

      const taken = await api.patch("/auth/email", { email: other.email, password: user.password });
      expect(taken.status()).toBe(409);
      expect((await json(taken)).error).toBe("Another account already uses this email.");

      expect((await json(await api.get("/auth/me"))).Data.needsEmail).toBe(true);
    });

    test("adding an email requires being signed in @negative", async ({ anon }) => {
      expect((await anon.patch("/auth/email", { email: "a@example.com", password: "x" })).status()).toBe(401);
    });
  });

  test.describe("current user (/auth/me)", () => {
    test("returns the profile for a valid token @positive", async ({ api, user }) => {
      const res = await api.get("/auth/me");
      expect(res.status()).toBe(200);
      const { Data } = await json(res);
      expect(Data).toMatchObject({ displayName: user.username, email: user.email, needsEmail: false });
      expect(Data).not.toHaveProperty("passwordHash");
    });

    test("rejects a request with no token @negative", async ({ anon }) => {
      const res = await anon.get("/auth/me");
      expect(res.status()).toBe(401);
      expect((await json(res)).error).toBe("Not authenticated");
    });

    test("rejects a malformed token @negative", async ({ request }) => {
      const res = await request.get(`${API_URL}/auth/me`, { headers: { Authorization: "Bearer not.a.jwt" } });
      expect(res.status()).toBe(401);
      expect((await json(res)).error).toBe("Invalid or expired token");
    });

    test("rejects a non-Bearer authorization scheme @negative", async ({ request, user }) => {
      const res = await request.get(`${API_URL}/auth/me`, { headers: { Authorization: `Basic ${user.accessToken}` } });
      expect(res.status()).toBe(401);
    });

    test("rejects a token signed with a different secret @negative", async ({ request }) => {
      const forged = jwt.sign({ id: MISSING_ID, name: "attacker" }, "not-the-server-secret", { expiresIn: "15m" });
      const res = await request.get(`${API_URL}/auth/me`, { headers: { Authorization: `Bearer ${forged}` } });
      expect(res.status()).toBe(401);
    });

    test("rejects an expired token @negative", async ({ request }) => {
      const expired = jwt.sign({ id: MISSING_ID, name: "x", exp: Math.floor(Date.now() / 1000) - 60 }, "roninarc-e2e-secret");
      const res = await request.get(`${API_URL}/auth/me`, { headers: { Authorization: `Bearer ${expired}` } });
      expect(res.status()).toBe(401);
    });
  });

  test.describe("refresh & logout", () => {
    test("refresh rotates the token pair and revokes the old refresh token @positive", async ({ anon, user }) => {
      const res = await anon.post("/auth/refresh", { refreshToken: user.refreshToken });
      expect(res.status()).toBe(200);
      const { Data } = await json(res);
      expect(Data.accessToken).toEqual(expect.any(String));
      expect(Data.refreshToken).not.toBe(user.refreshToken);

      const reuse = await anon.post("/auth/refresh", { refreshToken: user.refreshToken });
      expect(reuse.status()).toBe(401);
      expect((await json(reuse)).error).toBe("Refresh token revoked");
    });

    test("refresh rejects a missing token with 400 @negative", async ({ anon }) => {
      const res = await anon.post("/auth/refresh", {});
      expect(res.status()).toBe(400);
      expect((await json(res)).error).toBe("Refresh token is required");
    });

    test("refresh rejects an unknown token with 401 @negative", async ({ anon }) => {
      const res = await anon.post("/auth/refresh", { refreshToken: "f".repeat(128) });
      expect(res.status()).toBe(401);
    });

    test("logout revokes the refresh token @positive", async ({ anon, user }) => {
      const res = await anon.post("/auth/logout", { refreshToken: user.refreshToken });
      expect(res.status()).toBe(200);
      expect((await json(res)).Message).toBe("Logged out successfully");

      const refresh = await anon.post("/auth/refresh", { refreshToken: user.refreshToken });
      expect(refresh.status()).toBe(401);
    });

    test("logout rejects a missing token with 400 @negative", async ({ anon }) => {
      const res = await anon.post("/auth/logout", {});
      expect(res.status()).toBe(400);
    });

    test("logout-all revokes every session of the user @positive", async ({ api, anon, user }) => {
      const second = await json(await anon.post("/auth/login", { email: user.email, password: user.password }));
      const res = await api.post("/auth/logout-all");
      expect(res.status()).toBe(200);

      for (const token of [user.refreshToken, second.Data.refreshToken]) {
        const refresh = await anon.post("/auth/refresh", { refreshToken: token });
        expect(refresh.status()).toBe(401);
      }
    });

    test("logout-all requires authentication @negative", async ({ anon }) => {
      expect((await anon.post("/auth/logout-all")).status()).toBe(401);
    });
  });

  test.describe("change password", () => {
    const NEW_PASSWORD = "Brand-New-Pass-42";

    test("changes the password and revokes existing sessions @positive", async ({ api, anon, user }) => {
      const res = await api.patch("/auth/change-password", { currentPassword: user.password, newPassword: NEW_PASSWORD });
      expect(res.status()).toBe(200);

      expect((await anon.post("/auth/login", { email: user.email, password: user.password })).status()).toBe(401);
      expect((await anon.post("/auth/login", { email: user.email, password: NEW_PASSWORD })).status()).toBe(200);
      expect((await anon.post("/auth/refresh", { refreshToken: user.refreshToken })).status()).toBe(401);
    });

    test("rejects a wrong current password @negative", async ({ api }) => {
      const res = await api.patch("/auth/change-password", { currentPassword: "nope-nope", newPassword: NEW_PASSWORD });
      expect(res.status()).toBe(401);
      expect((await json(res)).error).toBe("Current password incorrect");
    });

    test("rejects a new password shorter than 6 characters @negative", async ({ api, user }) => {
      const res = await api.patch("/auth/change-password", { currentPassword: user.password, newPassword: "12345" });
      expect(res.status()).toBe(400);
      expect((await json(res)).error).toBe("New password must be at least 6 characters");
    });

    test("rejects reusing the current password @negative", async ({ api, user }) => {
      const res = await api.patch("/auth/change-password", { currentPassword: user.password, newPassword: user.password });
      expect(res.status()).toBe(400);
      expect((await json(res)).error).toBe("New password must be different");
    });

    test("rejects missing fields @negative", async ({ api }) => {
      const res = await api.patch("/auth/change-password", { currentPassword: "x" });
      expect(res.status()).toBe(400);
    });

    test("requires authentication @negative", async ({ anon }) => {
      expect((await anon.patch("/auth/change-password", { currentPassword: "a", newPassword: "b" })).status()).toBe(401);
    });
  });

  test.describe("delete account", () => {
    test("deletes the account and all of its library data @positive", async ({ api, anon, user, request }) => {
      await api.addGame(byName("Hades"));
      const res = await api.delete("/auth/account", { password: user.password });
      expect(res.status()).toBe(200);
      expect((await json(res)).Message).toBe("Account deleted successfully");

      expect((await anon.post("/auth/login", { email: user.email, password: user.password })).status()).toBe(401);
      // The old access token is still a validly-signed JWT, but the user is gone.
      expect((await api.get("/auth/me")).status()).toBe(404);

      // The email is free again and the new account starts empty.
      const again = await registerUser(request, API_URL, { username: user.username });
      const lib = await request.get(`${API_URL}/game`, { headers: { Authorization: `Bearer ${again.accessToken}` } });
      expect((await json(lib)).Data).toEqual([]);
    });

    test("rejects a wrong password and keeps the account @negative", async ({ api, anon, user }) => {
      const res = await api.delete("/auth/account", { password: "WrongPass123" });
      expect(res.status()).toBe(401);
      expect((await json(res)).error).toBe("Invalid password");
      expect((await anon.post("/auth/login", { email: user.email, password: user.password })).status()).toBe(200);
    });

    test("rejects a missing password @negative", async ({ api }) => {
      const res = await api.delete("/auth/account", {});
      expect(res.status()).toBe(400);
      expect((await json(res)).error).toBe("Password is required");
    });
  });
});
