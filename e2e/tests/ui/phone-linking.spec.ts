import { test, expect } from "../../fixtures/test";
import { DEFAULT_PASSWORD, json, registerUser, uniqueName } from "../../helpers/api";
import { expectToast, fillLogin, open } from "../../helpers/ui";
import { byName } from "../../fixtures/catalog.mjs";
import { CLOUD_URL } from "../../env";

// Getting the library onto a phone: the "Sync with my other devices" box at sign-in, email
// sign-up, Connect your phone (QR + code) and the dashboard banner.

test.describe("Sync with my other devices", () => {
  test("ticked by default: signing in links this PC to RoninArc Cloud @positive", async ({ page, user, api }) => {
    await open(page, "/login");
    await expect(page.getByRole("checkbox", { name: "Sync with my other devices" })).toBeChecked();
    await fillLogin(page, user.email, user.password);
    await expectToast(page, "Syncing with your other devices");
    expect(await json(await api.get("/sync/status"))).toMatchObject({ linked: true, cloudEmail: user.email });
  });

  test("unticked: signing in changes nothing about syncing, and it stays unticked next time @negative", async ({ page, user, api }) => {
    await open(page, "/login");
    await page.getByText("Sync with my other devices").click();
    await fillLogin(page, user.email, user.password);
    await expect(page).toHaveURL(/#\/$/);
    expect((await json(await api.get("/sync/status"))).linked).toBe(false);
    await page.evaluate(() => sessionStorage.clear());
    await open(page, "/login");
    await expect(page.getByRole("checkbox", { name: "Sync with my other devices" })).not.toBeChecked();
  });

  test("the email already has a cloud account with another password: the sign-in works, Settings asks for that password @negative", async ({ page, user, request }) => {
    await registerUser(request, CLOUD_URL, { username: "Cloud Me", email: user.email, password: "Someone3lse!" });
    await open(page, "/login");
    await fillLogin(page, user.email, user.password);
    await expectToast(page, "Sync needs your attention");
    await expect(page).toHaveURL(/#\/$/);
    await page.getByRole("button", { name: "Skip" }).click().catch(() => {});

    await open(page, "/settings");
    await expect(page.locator("#cloud").getByText("Sync needs your attention")).toBeVisible();
    await expect(page.locator("#cloud")).toContainText("already has a RoninArc Cloud account");
    await page.getByRole("button", { name: "Enter its password" }).click();
    await expect(page.getByRole("textbox", { name: "Cloud email" })).toHaveValue(user.email);
    await page.getByLabel("Cloud password").fill("Someone3lse!");
    await page.getByRole("button", { name: "Sign in and sync" }).click();
    // Merged into the cloud account (the PC account takes its id); the app carries on as it.
    await expect(page.getByText(`Syncing as ${user.email}`)).toBeVisible();
  });
});

test.describe("Sign-up", () => {
  test("asks for a name, an email and a password; names don't have to be unique @positive", async ({ page, user }) => {
    await open(page, "/signup");
    await expect(page.getByRole("textbox", { name: "Username" })).toHaveCount(0);
    await page.getByRole("textbox", { name: "Name" }).fill(user.username);
    await page.getByRole("textbox", { name: /^Email/ }).fill(`${uniqueName("signup")}@example.com`);
    await page.getByRole("textbox", { name: "Password", exact: true }).fill(DEFAULT_PASSWORD);
    await page.getByRole("textbox", { name: "Confirm password" }).fill(DEFAULT_PASSWORD);
    await page.getByRole("button", { name: "Sign up" }).click();
    await expectToast(page, "Signup successful");
  });

  test("without an email it doesn't sign up @negative", async ({ page }) => {
    let called = false;
    page.on("request", (r) => r.url().includes("/auth/register") && (called = true));
    await open(page, "/signup");
    await page.getByRole("textbox", { name: "Name" }).fill("No Email");
    await page.getByRole("textbox", { name: "Password", exact: true }).fill(DEFAULT_PASSWORD);
    await page.getByRole("textbox", { name: "Confirm password" }).fill(DEFAULT_PASSWORD);
    await page.getByRole("button", { name: "Sign up" }).click();
    await expectToast(page, "Signup failed", "Enter your name, email and a password.");
    expect(called).toBe(false);
  });
});

test.describe("Connect your phone", () => {
  test("Settings shows a QR code and a 6-digit code the phone can use @positive", async ({ authedPage: page, api, request, user }) => {
    await api.addGame(byName("Hades"));
    await open(page, "/settings");
    await page.getByRole("button", { name: "Connect your phone" }).click();
    const dialog = page.getByRole("dialog", { name: "Connect your phone" });
    await expect(dialog.getByRole("img", { name: /QR code/ })).toBeVisible({ timeout: 60_000 });
    const shown = (await dialog.getByText(/^\d{3} \d{3}$/).textContent())!.replace(" ", "");
    await expect(dialog).toContainText("Works once");

    const res = await request.post(`${CLOUD_URL}/sync/link-code/claim`, { data: { code: shown } });
    expect(res.status(), await res.text()).toBe(200);
    expect((await res.json()).Data.userdata.name).toBe(user.username);
  });

  test("the dashboard offers it once there are games, and hiding it is remembered @positive", async ({ authedPage: page, api }) => {
    await open(page, "/dashboard");
    await expect(page.getByText("Get your library on your phone")).toBeHidden();
    await api.addGame(byName("Hades"));
    await page.reload();
    const banner = page.getByRole("region", { name: "Get your library on your phone" });
    await expect(banner).toBeVisible();
    await banner.getByRole("button", { name: "Hide this" }).click();
    await expect(banner).toBeHidden();
    await page.reload();
    await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
    await expect(page.getByRole("region", { name: "Get your library on your phone" })).toBeHidden();
  });
});
