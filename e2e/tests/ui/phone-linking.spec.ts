import { test, expect } from "../../fixtures/test";
import { DEFAULT_PASSWORD, json, registerUser, uniqueName } from "../../helpers/api";
import { expectToast, fillLogin, open } from "../../helpers/ui";
import { byName } from "../../fixtures/catalog.mjs";
import { CLOUD_URL } from "../../env";

// Getting the library onto a phone: the "Sync with my other devices" box at sign-in, the cloud
// name check while signing up, Connect your phone (QR + code) and the dashboard banner.

test.describe("Sync with my other devices", () => {
  test("ticked by default: signing in links this PC to RoninArc Cloud @positive", async ({ page, user, api }) => {
    await open(page, "/login");
    await expect(page.getByRole("checkbox", { name: "Sync with my other devices" })).toBeChecked();
    await fillLogin(page, user.username, user.password);
    await expectToast(page, "Syncing with your other devices");
    expect(await json(await api.get("/sync/status"))).toMatchObject({ linked: true, cloudUsername: user.username });
  });

  test("unticked: signing in changes nothing about syncing, and it stays unticked next time @negative", async ({ page, user, api }) => {
    await open(page, "/login");
    await page.getByText("Sync with my other devices").click();
    await fillLogin(page, user.username, user.password);
    await expect(page).toHaveURL(/#\/$/);
    expect((await json(await api.get("/sync/status"))).linked).toBe(false);
    await page.evaluate(() => sessionStorage.clear());
    await open(page, "/login");
    await expect(page.getByRole("checkbox", { name: "Sync with my other devices" })).not.toBeChecked();
  });

  test("the name is someone else's in the cloud: the sign-in works, Settings offers free names @negative", async ({ page, user, api, request }) => {
    await registerUser(request, CLOUD_URL, { username: user.username, password: "Someone3lse!", email: `other-${user.username}@example.com` });
    await open(page, "/login");
    await fillLogin(page, user.username, user.password);
    await expectToast(page, "Sync needs your attention");
    await expect(page).toHaveURL(/#\/$/);
    await page.getByRole("button", { name: "Skip" }).click().catch(() => {});

    await open(page, "/settings");
    const row = page.locator("#cloud").getByText("Sync needs your attention");
    await expect(row).toBeVisible();
    const pick = page.getByRole("button", { name: /^Sync as / }).first();
    const name = (await pick.textContent())!.replace(/^Sync as /, "");
    await pick.click();
    await expect(page.getByText(`Syncing as ${name}`)).toBeVisible();
    expect((await json(await api.get("/sync/status"))).cloudUsername).toBe(name);
  });
});

test.describe("Sign-up checks the name in RoninArc Cloud", () => {
  test("a taken name says so and offers free ones; picking one fills it in @negative", async ({ page, request }) => {
    const taken = await registerUser(request, CLOUD_URL);
    await open(page, "/signup");
    await page.getByRole("textbox", { name: "Username" }).fill(taken.username);
    await expect(page.getByText("That name is taken in RoninArc Cloud")).toBeVisible();
    const suggestion = page.getByRole("button").filter({ hasText: new RegExp(`^${taken.username.slice(0, 5)}`) }).first();
    const name = (await suggestion.textContent())!;
    await suggestion.click();
    await expect(page.getByRole("textbox", { name: "Username" })).toHaveValue(name);
    await expect(page.getByText("That name is taken in RoninArc Cloud")).toBeHidden();
  });

  test("no email: the sign-up still works, and Settings asks for what syncing needs @negative", async ({ page }) => {
    await open(page, "/signup");
    await page.getByRole("textbox", { name: "Username" }).fill(uniqueName("noemail"));
    await page.getByRole("textbox", { name: "Password", exact: true }).fill(DEFAULT_PASSWORD);
    await page.getByRole("textbox", { name: "Confirm password" }).fill(DEFAULT_PASSWORD);
    await page.getByRole("button", { name: "Sign up" }).click();
    await expectToast(page, "Signup successful");
    await expectToast(page, "Sync needs your attention");
    await page.getByRole("button", { name: "Skip" }).click().catch(() => {});
    await open(page, "/settings");
    await expect(page.locator("#cloud").getByText("Sync needs your attention")).toBeVisible();
    await page.getByRole("button", { name: "Sync to cloud" }).click();
    await expect(page.getByRole("textbox", { name: "Email" })).toBeVisible();
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
