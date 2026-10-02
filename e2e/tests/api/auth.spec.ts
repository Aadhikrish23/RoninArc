import jwt from "jsonwebtoken";
import { test, expect } from "../../fixtures/test";
import { DEFAULT_PASSWORD, MISSING_ID, json, registerUser, uniqueName } from "../../helpers/api";
import { API_URL } from "../../env";
import { byName } from "../../fixtures/catalog.mjs";

test.describe("Auth API", () => {
  test.describe("register", () => {
    test("creates an account and returns tokens @positive", async ({ anon }) => {
      const username = uniqueName("reg");
      const res = await anon.post("/auth/register", { username, password: DEFAULT_PASSWORD, email: `${username}@example.com` });
      expect(res.status()).toBe(201);
      const body = await json(res);
      expect(body.Status).toBe("Success");
      expect(body.Data.userdata).toMatchObject({ name: username, email: `${username}@example.com` });
      expect(body.Data.accessToken).toEqual(expect.any(String));
      expect(body.Data.refreshToken).toMatch(/^[0-9a-f]{128}$/);
    });

    test("normalises the username to lowercase and trims input @positive", async ({ anon }) => {
      const base = uniqueName("case");
      const res = await anon.post("/auth/register", { username: `  ${base.toUpperCase()}  `, password: `  ${DEFAULT_PASSWORD}  ` });
      expect(res.status()).toBe(201);
      expect((await json(res)).Data.userdata.name).toBe(base);

      const login = await anon.post("/auth/login", { username: base, password: DEFAULT_PASSWORD });
      expect(login.status()).toBe(200);
    });

    test("email is optional @positive", async ({ anon }) => {
      const res = await anon.post("/auth/register", { username: uniqueName("noemail"), password: DEFAULT_PASSWORD });
      expect(res.status()).toBe(201);
    });

    for (const [label, payload] of [
      ["missing username", { password: DEFAULT_PASSWORD }],
      ["missing password", { username: "someone" }],
      ["blank username", { username: "   ", password: DEFAULT_PASSWORD }],
      ["non-string password", { username: "someone", password: 123456 }],
      ["empty body", {}],
    ] as const) {
      test(`rejects ${label} with 400 @negative`, async ({ anon }) => {
        const res = await anon.post("/auth/register", payload);
        expect(res.status()).toBe(400);
        expect(await json(res)).toMatchObject({ error: "Username and password are required" });
      });
    }

    test("rejects a username shorter than 3 characters @negative", async ({ anon }) => {
      const res = await anon.post("/auth/register", { username: "ab", password: DEFAULT_PASSWORD });
      expect(res.status()).toBe(400);
      expect((await json(res)).error).toBe("Invalid input");
    });

    test("rejects a password shorter than 6 characters @negative", async ({ anon }) => {
      const res = await anon.post("/auth/register", { username: uniqueName("short"), password: "12345" });
      expect(res.status()).toBe(400);
      expect((await json(res)).error).toBe("Invalid input");
    });

    test("rejects a duplicate username, case-insensitively, with 409 @negative", async ({ anon, user }) => {
      const res = await anon.post("/auth/register", { username: user.username.toUpperCase(), password: DEFAULT_PASSWORD });
      expect(res.status()).toBe(409);
      expect((await json(res)).error).toBe("Username is already taken");
    });
  });

  test.describe("login", () => {
    test("returns fresh tokens for valid credentials @positive", async ({ anon, user }) => {
      const res = await anon.post("/auth/login", { username: user.username, password: user.password });
      expect(res.status()).toBe(200);
      const body = await json(res);
      expect(body.Data.userdata.name).toBe(user.username);
      expect(body.Data.accessToken).toEqual(expect.any(String));
      expect(body.Data.refreshToken).not.toBe(user.refreshToken);
    });

    test("rejects a wrong password with 401 @negative", async ({ anon, user }) => {
      const res = await anon.post("/auth/login", { username: user.username, password: "WrongPass123" });
      expect(res.status()).toBe(401);
      expect((await json(res)).error).toBe("Invalid credentials");
    });

    test("rejects an unknown user with the same 401 (no user enumeration) @negative", async ({ anon }) => {
      const res = await anon.post("/auth/login", { username: uniqueName("ghost"), password: DEFAULT_PASSWORD });
      expect(res.status()).toBe(401);
      expect((await json(res)).error).toBe("Invalid credentials");
    });

    test("rejects missing credentials with 400 @negative", async ({ anon }) => {
      const res = await anon.post("/auth/login", { username: "" });
      expect(res.status()).toBe(400);
    });
  });

  test.describe("current user (/auth/me)", () => {
    test("returns the profile for a valid token @positive", async ({ api, user }) => {
      const res = await api.get("/auth/me");
      expect(res.status()).toBe(200);
      const { Data } = await json(res);
      expect(Data).toMatchObject({ username: user.username, email: user.email });
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
      const second = await json(await anon.post("/auth/login", { username: user.username, password: user.password }));
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

      expect((await anon.post("/auth/login", { username: user.username, password: user.password })).status()).toBe(401);
      expect((await anon.post("/auth/login", { username: user.username, password: NEW_PASSWORD })).status()).toBe(200);
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

      expect((await anon.post("/auth/login", { username: user.username, password: user.password })).status()).toBe(401);
      // The old access token is still a validly-signed JWT, but the user is gone.
      expect((await api.get("/auth/me")).status()).toBe(404);

      // The username is free again and the new account starts empty.
      const again = await registerUser(request, API_URL, { username: user.username });
      const lib = await request.get(`${API_URL}/game`, { headers: { Authorization: `Bearer ${again.accessToken}` } });
      expect((await json(lib)).Data).toEqual([]);
    });

    test("rejects a wrong password and keeps the account @negative", async ({ api, anon, user }) => {
      const res = await api.delete("/auth/account", { password: "WrongPass123" });
      expect(res.status()).toBe(401);
      expect((await json(res)).error).toBe("Invalid password");
      expect((await anon.post("/auth/login", { username: user.username, password: user.password })).status()).toBe(200);
    });

    test("rejects a missing password @negative", async ({ api }) => {
      const res = await api.delete("/auth/account", {});
      expect(res.status()).toBe(400);
      expect((await json(res)).error).toBe("Password is required");
    });
  });
});
