import { test, expect } from "../../fixtures/test";
import { DEFAULT_PASSWORD, uniqueName } from "../../helpers/api";
import { expectToast, fillLogin, navbar, open } from "../../helpers/ui";
import { byName } from "../../fixtures/catalog.mjs";

test.describe("Login page", () => {
  test("logs in with valid credentials and lands on the library @positive", async ({ page, user }) => {
    await open(page, "/login");
    await expect(page.getByRole("heading", { name: /Welcome back, Ronin/ })).toBeVisible();
    await fillLogin(page, user.username, user.password);

    await expectToast(page, "Login successful", "Welcome back to RoninArc.");
    await expect(page).toHaveURL(/#\/$/);
    await page.getByRole("dialog", { name: "Welcome to RoninArc" }).getByRole("button", { name: "Skip" }).click();
    await expect(navbar(page)).toContainText(user.username);
  });

  test("without 'Remember me' the session lives in sessionStorage only @positive", async ({ page, user }) => {
    await open(page, "/login");
    await fillLogin(page, user.username, user.password);
    await expect(page).toHaveURL(/#\/$/);
    const storage = await page.evaluate(() => ({
      local: localStorage.getItem("roninarc_token"),
      session: sessionStorage.getItem("roninarc_token"),
    }));
    expect(storage.local).toBeNull();
    expect(storage.session).toEqual(expect.any(String));
  });

  test("with 'Remember me' the session survives a new tab @positive", async ({ page, user, context }) => {
    await open(page, "/login");
    await fillLogin(page, user.username, user.password, true);
    await expect(page).toHaveURL(/#\/$/);
    expect(await page.evaluate(() => localStorage.getItem("roninarc_token"))).toEqual(expect.any(String));
    await page.getByRole("button", { name: "Skip" }).click();

    const second = await context.newPage();
    await open(second, "/dashboard");
    await expect(second.getByRole("heading", { name: "RoninArc Dashboard" })).toBeVisible();
  });

  test("username is case-insensitive @positive", async ({ page, user }) => {
    await open(page, "/login");
    await fillLogin(page, user.username.toUpperCase(), user.password);
    await expect(page).toHaveURL(/#\/$/);
  });

  test("the password visibility toggle reveals the password @positive", async ({ page }) => {
    await open(page, "/login");
    const password = page.getByRole("textbox", { name: "Password" });
    await password.fill("hunter22");
    await expect(password).toHaveAttribute("type", "password");
    await page.getByRole("group").filter({ hasText: "Password" }).getByRole("button").click();
    await expect(page.getByRole("textbox", { name: "Password" })).toHaveAttribute("type", "text");
  });

  test("a wrong password shows an error and stays on the login page @negative", async ({ page, user }) => {
    await open(page, "/login");
    await fillLogin(page, user.username, "WrongPass123");
    await expectToast(page, "Login failed", "Invalid credentials");
    await expect(page).toHaveURL(/#\/login$/);
  });

  test("an unknown user shows the same error @negative", async ({ page }) => {
    await open(page, "/login");
    await fillLogin(page, uniqueName("ghost"), DEFAULT_PASSWORD);
    await expectToast(page, "Login failed", "Invalid credentials");
  });

  test("empty fields are rejected client-side without calling the API @negative", async ({ page }) => {
    await open(page, "/login");
    let called = false;
    page.on("request", (r) => r.url().includes("/auth/login") && (called = true));
    await page.getByRole("button", { name: "Login" }).click();
    await expectToast(page, "Login failed", "Please enter both username and password");
    expect(called).toBe(false);
  });

  test("whitespace-only credentials are rejected @negative", async ({ page }) => {
    await open(page, "/login");
    await fillLogin(page, "   ", "   ");
    await expectToast(page, "Login failed", "Please enter both username and password");
  });

  test("the SignUp link opens the signup page @positive", async ({ page }) => {
    await open(page, "/login");
    await page.getByRole("link", { name: "SignUp" }).click();
    await expect(page.getByRole("heading", { name: /Welcome Ronin/ })).toBeVisible();
  });
});

test.describe("Signup page", () => {
  const fillSignup = async (page: any, f: { username?: string; email?: string; password?: string; confirm?: string }) => {
    if (f.username !== undefined) await page.getByRole("textbox", { name: "Username" }).fill(f.username);
    if (f.email !== undefined) await page.getByRole("textbox", { name: "Email" }).fill(f.email);
    if (f.password !== undefined) await page.getByRole("textbox", { name: "Password", exact: true }).fill(f.password);
    if (f.confirm !== undefined) await page.getByRole("textbox", { name: "Confirm Password" }).fill(f.confirm);
    await page.getByRole("button", { name: "SignUp" }).click();
  };

  test("creates an account, signs in and shows the onboarding wizard @positive", async ({ page }) => {
    const username = uniqueName("ui");
    await open(page, "/signup");
    await fillSignup(page, { username, email: `${username}@example.com`, password: DEFAULT_PASSWORD, confirm: DEFAULT_PASSWORD });

    await expectToast(page, "Signup successful", "Your RoninArc account has been created.");
    const wizard = page.getByRole("dialog", { name: "Welcome to RoninArc" });
    await expect(wizard).toBeVisible();
    await wizard.getByRole("button", { name: "Skip" }).click();
    await expect(navbar(page)).toContainText(username);
  });

  test("email is optional @positive", async ({ page }) => {
    await open(page, "/signup");
    await fillSignup(page, { username: uniqueName("ui"), password: DEFAULT_PASSWORD, confirm: DEFAULT_PASSWORD });
    await expectToast(page, "Signup successful");
  });

  test("mismatched passwords are rejected @negative", async ({ page }) => {
    await open(page, "/signup");
    await fillSignup(page, { username: uniqueName("ui"), password: DEFAULT_PASSWORD, confirm: "Different123" });
    await expectToast(page, "Signup failed", "Password and Confirm Password must be the same");
    await expect(page).toHaveURL(/#\/signup$/);
  });

  test("an invalid email is flagged on blur and cleared, not sent @negative", async ({ page }) => {
    await open(page, "/signup");
    const email = page.getByRole("textbox", { name: "Email" });
    await email.fill("not-an-email");
    await email.blur();
    await expectToast(page, "Invalid Email", "Please enter a valid email address");
    await expect(email).toHaveValue("");

    const sent = page.waitForRequest((r) => r.url().endsWith("/auth/register"));
    await fillSignup(page, { username: uniqueName("ui"), password: DEFAULT_PASSWORD, confirm: DEFAULT_PASSWORD });
    expect((await sent).postDataJSON().email).toBe("");
  });

  test("missing username/password are rejected @negative", async ({ page }) => {
    await open(page, "/signup");
    await fillSignup(page, {});
    await expectToast(page, "Signup failed", "Username and password are required");
  });

  test("a taken username shows the server error @negative", async ({ page, user }) => {
    await open(page, "/signup");
    await fillSignup(page, { username: user.username, password: DEFAULT_PASSWORD, confirm: DEFAULT_PASSWORD });
    await expectToast(page, "Signup failed", "Username is already taken");
  });

  test("a too-short password shows the server error @negative", async ({ page }) => {
    await open(page, "/signup");
    await fillSignup(page, { username: uniqueName("ui"), password: "123", confirm: "123" });
    await expectToast(page, "Signup failed", "Invalid input");
  });

  test("the Login link goes back to the login page @positive", async ({ page }) => {
    await open(page, "/signup");
    await page.getByRole("link", { name: "Login" }).click();
    await expect(page).toHaveURL(/#\/login$/);
  });
});

test.describe("Onboarding wizard", () => {
  test("'Skip' dismisses it for good @positive", async ({ page, user }) => {
    await open(page, "/login");
    await fillLogin(page, user.username, user.password, true);
    const wizard = page.getByRole("dialog", { name: "Welcome to RoninArc" });
    await expect(wizard).toBeVisible();
    await expect(wizard).toContainText("Steam — available now");
    await wizard.getByRole("button", { name: "Skip" }).click();
    await expect(wizard).toBeHidden();
    await page.reload();
    await expect(page.getByRole("heading", { name: "My Library" })).toBeVisible();
    await expect(wizard).toBeHidden();
  });

  test("'Set Up Connections' goes to Settings @positive", async ({ page, user }) => {
    await open(page, "/login");
    await fillLogin(page, user.username, user.password);
    await page.getByRole("button", { name: "Set Up Connections" }).click();
    await expect(page).toHaveURL(/#\/settings$/);
    await expect(page.getByRole("heading", { name: "🔌 Account Connections" })).toBeVisible();
  });

  test("cannot be dismissed with Escape @negative", async ({ page, user }) => {
    await open(page, "/login");
    await fillLogin(page, user.username, user.password);
    const wizard = page.getByRole("dialog", { name: "Welcome to RoninArc" });
    await expect(wizard).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(wizard).toBeVisible();
  });
});

test.describe("Session & route guard", () => {
  for (const path of ["/", "/dashboard", "/settings", "/ai", "/library/browse"]) {
    test(`unauthenticated visit to ${path} redirects to login @negative`, async ({ page }) => {
      await open(page, path);
      await expect(page).toHaveURL(/#\/login$/);
      await expect(page.getByRole("button", { name: "Login" })).toBeVisible();
    });
  }

  test("Logout (Settings) ends the session and protects pages again @positive", async ({ authedPage: page }) => {
    await open(page, "/settings");
    await page.getByRole("button", { name: "Logout", exact: true }).click();
    await expect(page).toHaveURL(/#\/login$/);
    expect(await page.evaluate(() => localStorage.getItem("roninarc_token") ?? sessionStorage.getItem("roninarc_token"))).toBeNull();
    await open(page, "/dashboard");
    await expect(page).toHaveURL(/#\/login$/);
  });

  const seedSession = (page: any, userdata: object, token: string, refresh: string) =>
    page.addInitScript(
      ({ u, t, r }: { u: object; t: string; r: string }) => {
        if (sessionStorage.getItem("__e2e_seeded")) return;
        sessionStorage.setItem("__e2e_seeded", "1");
        localStorage.setItem("roninarc_user", JSON.stringify(u));
        localStorage.setItem("roninarc_token", t);
        localStorage.setItem("roninarc_refresh_token", r);
        localStorage.setItem("roninarc_import_wizard_seen", "true");
      },
      { u: userdata, t: token, r: refresh },
    );

  test("an expired access token is refreshed transparently @positive", async ({ page, user, api }) => {
    await api.addGame(byName("Hades"));
    await seedSession(page, user.userdata, "expired.or.invalid.token", user.refreshToken);
    const refreshed = page.waitForResponse((r) => r.url().endsWith("/auth/refresh") && r.status() === 200);
    await open(page, "/");
    await refreshed;
    await expect(page.getByRole("heading", { name: "Recently Added" })).toBeVisible();
    await expect(page.getByText("Hades").first()).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem("roninarc_token"))).not.toBe("expired.or.invalid.token");
  });

  test("an invalid token with a revoked refresh token sends the user to login @negative", async ({ page, user }) => {
    await seedSession(page, user.userdata, "tampered.token.value", "f".repeat(128));
    await open(page, "/");
    await expect(page).toHaveURL(/#\/login$/);
    expect(await page.evaluate(() => localStorage.getItem("roninarc_token"))).toBeNull();
  });
});
