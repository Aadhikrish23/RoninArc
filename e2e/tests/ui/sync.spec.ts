import { test, expect } from "../../fixtures/test";
import { byName } from "../../fixtures/catalog.mjs";
import { expectToast, open } from "../../helpers/ui";
import { CLOUD_URL, RESEND_URL } from "../../env";

const card = (page: any) =>
  page.locator("div").filter({ has: page.getByRole("heading", { name: "RoninArc Cloud", exact: true }) }).filter({ has: page.getByRole("button") }).last();

test.describe("RoninArc Cloud in Settings", () => {
  test("create a cloud account from this PC, then see it syncing @positive", async ({ authedPage: page, api, user, request }) => {
    await api.addGame(byName("Hades"));
    await open(page, "/settings");
    await card(page).getByRole("button", { name: "Create a cloud account" }).click();
    await card(page).getByLabel("Email").fill(user.email);
    await card(page).getByLabel("Choose a password").fill(user.password);
    await card(page).getByRole("button", { name: "Create and sync" }).click();

    await expectToast(page, "Cloud account created");
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
    await expect(card(page).getByRole("button", { name: "Create a cloud account" })).toBeVisible();
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
