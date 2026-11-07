import { test, expect } from "../../fixtures/test";
import { byName } from "../../fixtures/catalog.mjs";
import { expectToast, open } from "../../helpers/ui";
import { CLOUD_URL, RESEND_URL } from "../../env";
import { registerUser, uniqueName } from "../../helpers/api";

const card = (page: any) =>
  page.locator("div").filter({ has: page.getByRole("heading", { name: "RoninArc Cloud", exact: true }) }).filter({ has: page.getByRole("button") }).last();

test.describe("RoninArc Cloud in Settings", () => {
  test("one button syncs to the cloud, asking for nothing, and the same password works there @positive", async ({ authedPage: page, api, user, request }) => {
    await api.addGame(byName("Hades"));
    await open(page, "/settings");
    await expect(card(page).getByRole("textbox")).toHaveCount(0);
    await card(page).getByRole("button", { name: "Sync to cloud" }).click();

    await expectToast(page, "Your library is in the cloud");
    await expect(card(page).getByRole("textbox")).toHaveCount(0);
    await expect(card(page).getByText(`Syncing as ${user.username}`)).toBeVisible();
    await expect(card(page).getByText(/Last synced just now/)).toBeVisible();

    const login = await request.post(`${CLOUD_URL}/auth/login`, { data: { username: user.username, password: user.password } });
    const token = (await login.json()).Data.accessToken;
    const games = await (await request.get(`${CLOUD_URL}/game`, { headers: { Authorization: `Bearer ${token}` } })).json();
    expect(games.Data.map((g: any) => g.title)).toEqual(["Hades"]);
  });

  test("stop syncing asks first and keeps the library @negative", async ({ authedPage: page, api, user }) => {
    await api.post("/sync/link", { mode: "create", username: user.username, email: user.email, password: user.password });
    await open(page, "/settings");
    await card(page).getByRole("button", { name: "Stop syncing" }).click();
    await expect(card(page).getByText(/Stop syncing this PC\?/)).toBeVisible();
    await card(page).getByRole("button", { name: "Keep syncing" }).click();
    await expect(card(page).getByText(`Syncing as ${user.username}`)).toBeVisible();

    await card(page).getByRole("button", { name: "Stop syncing" }).click();
    await card(page).getByRole("button", { name: "Stop syncing" }).click();
    await expectToast(page, "Stopped syncing");
    await expect(card(page).getByRole("button", { name: "Sync to cloud" })).toBeVisible();
  });

  test("stopping and syncing again straight away just works @positive", async ({ authedPage: page, api, user }) => {
    await api.post("/sync/link", { mode: "create" });
    await api.post("/sync/unlink");
    await open(page, "/settings");
    await card(page).getByRole("button", { name: "Sync to cloud" }).click();
    await expectToast(page, "Your library is in the cloud");
    await expect(card(page).getByText(`Syncing as ${user.username}`)).toBeVisible();
  });

  test("a name that's already yours in the cloud: sign in to it and the library merges @positive", async ({ authedPage: page, request }) => {
    const mine = await registerUser(request, CLOUD_URL, { username: uniqueName("mine") });
    await page.route(/\/sync\/link$/, async (route: any) => {
      const body = route.request().postDataJSON();
      await route.continue({ postData: JSON.stringify({ ...body, username: body.username ?? mine.username }) });
    });
    await open(page, "/settings");
    await card(page).getByRole("button", { name: "Sync to cloud" }).click();
    await expect(card(page).getByText("Username is already taken")).toBeVisible();
    await card(page).getByLabel("Cloud username").fill(mine.username);
    await card(page).getByLabel("Password").fill(mine.password);
    await card(page).getByRole("button", { name: "Sign in and sync" }).click();
    await expectToast(page, "Signed in to RoninArc Cloud");
    await expect(card(page).getByText(`Syncing as ${mine.username}`)).toBeVisible();
  });

  test("a name someone else has: pick another and keep the same password @negative", async ({ authedPage: page, request }) => {
    const taken = await registerUser(request, CLOUD_URL, { username: uniqueName("taken") });
    await page.route(/\/sync\/link$/, async (route: any) => {
      // This account's own name is free, so ask for the taken one on the first try.
      const body = route.request().postDataJSON();
      await route.continue({ postData: JSON.stringify({ ...body, username: body.username ?? taken.username }) });
    });
    await open(page, "/settings");
    await card(page).getByRole("button", { name: "Sync to cloud" }).click();
    await expect(card(page).getByText("Username is already taken")).toBeVisible();

    await card(page).getByRole("button", { name: "Use a different name" }).click();
    await expect(card(page).getByLabel("Password")).toHaveCount(0);
    await card(page).getByLabel("Cloud username").fill(uniqueName("other"));
    await card(page).getByRole("button", { name: "Sync to cloud" }).click();
    await expectToast(page, "Your library is in the cloud");
    await expect(card(page).getByText(/Syncing as other/)).toBeVisible();
  });

  test("while Epic's first import runs: one progress button and no fake account details @positive", async ({ authedPage: page }) => {
    await page.addInitScript(() => {
      (window as any).electronAPI = {
        epicLogin: async () => "a-long-enough-authorization-code",
        steamLogin: async () => null,
        scanEpicGames: async () => [],
        scanSteamGames: async () => [],
        launchGame: async () => true,
        selectExePath: async () => null,
      };
    });
    await page.route(/\/provider\/epic\/oauth\/start$/, (route: any) => route.fulfill({ json: { Data: { loginUrl: "https://example.com/login" } } }));
    let finish = () => {};
    const held = new Promise<void>((resolve) => (finish = resolve));
    await page.route(/\/provider\/epic\/connect$/, async (route: any) => {
      await held;
      await route.fulfill({ json: { Data: { provider: "epic", connected: true, displayName: "Tarnished", importedGames: 265, lastSync: new Date().toISOString() } } });
    });
    await open(page, "/settings");
    await page.getByRole("button", { name: "Connect Epic Games" }).click();

    await expect(page.getByText(/Importing your games\. A big library can take a minute or two/)).toBeVisible();
    const importing = page.locator("#epic-connect-button");
    await expect(importing).toBeDisabled();
    await expect(importing).toContainText("Importing...");
    await expect(page.getByText("Connected as")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Disconnect/ })).toHaveCount(0);
    finish();
    await expect(page.getByText(/Importing your games/)).toHaveCount(0);
  });

  test("offline: says so and keeps the one button @negative", async ({ authedPage: page }) => {
    await page.route(/\/sync\/link$/, (route: any) =>
      route.fulfill({ status: 503, json: { error: "Couldn't reach RoninArc Cloud. Check your internet connection and try again." } }),
    );
    await open(page, "/settings");
    await card(page).getByRole("button", { name: "Sync to cloud" }).click();
    await expectToast(page, "Couldn't sync to the cloud", "Couldn't reach RoninArc Cloud. Check your internet connection and try again.");
    await expect(card(page).getByRole("textbox")).toHaveCount(0);
  });
});

test.describe("Forgot password on the sign-in page", () => {
  test("emails a link for an account that syncs @positive", async ({ page, api, user, request }) => {
    await api.post("/sync/link", { mode: "create", username: user.username, email: user.email, password: user.password });
    await open(page, "/login");
    await page.getByRole("button", { name: "Forgot password?" }).click();
    await page.getByLabel("Email or username").fill(user.email);
    await page.getByRole("button", { name: "Email me a link" }).click();
    await expect(page.getByText(/If an account matches, we've emailed a link/)).toBeVisible();

    const emails = await (await request.get(`${RESEND_URL}/__emails?to=${encodeURIComponent(user.email)}`)).json();
    expect(emails).toHaveLength(1);
  });
});
