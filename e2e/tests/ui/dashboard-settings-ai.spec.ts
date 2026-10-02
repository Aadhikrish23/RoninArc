import { test, expect } from "../../fixtures/test";
import { json } from "../../helpers/api";
import { byName } from "../../fixtures/catalog.mjs";
import { expectToast, navbar, open } from "../../helpers/ui";

const stat = (page: any, term: string) => page.getByRole("term").filter({ hasText: term }).locator("xpath=following-sibling::dd[1]");

test.describe("Dashboard", () => {
  test("reflects the library's statuses and recent games @positive", async ({ authedPage: page, api }) => {
    await api.addGame(byName("Hades"), { progressStatus: "playing" });
    await api.addGame(byName("Celeste"), { progressStatus: "completed" });
    await open(page, "/dashboard");
    await expect(page.getByRole("heading", { name: "RoninArc Dashboard" })).toBeVisible();
    await expect(stat(page, "Currently Playing")).toHaveText("1");
    await expect(stat(page, "Completed")).toHaveText("1");
    await expect(page.getByRole("heading", { name: "Recently Added" })).toBeVisible();
  });

  test("a new user sees zeroed stats @negative", async ({ authedPage: page }) => {
    await open(page, "/dashboard");
    for (const term of ["Owned Games", "Currently Playing", "Completed"]) await expect(stat(page, term)).toHaveText("0");
  });
});

test.describe("Navigation", () => {
  test("navbar buttons route to each page @positive", async ({ authedPage: page }) => {
    await open(page, "/");
    for (const [name, url] of [["Dashboard", /#\/dashboard$/], ["Settings", /#\/settings$/], ["AI Assistant", /#\/ai$/], ["Library", /#\/$/]] as const) {
      await navbar(page).getByRole("button", { name }).click();
      await expect(page).toHaveURL(url);
    }
  });

  test("an unknown route shows the 404 page @negative", async ({ authedPage: page }) => {
    await open(page, "/no/such/page");
    await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
  });
});

test.describe("Settings", () => {
  test("toggles dark mode and keeps it after reload @positive", async ({ authedPage: page }) => {
    await open(page, "/settings");
    await page.getByRole("button", { name: /Dark Mode|Light Mode/ }).click();
    const theme = await page.locator("strong").first().innerText();
    await page.reload();
    await expect(page.locator("strong").first()).toHaveText(theme);
  });

  test("both providers show as disconnected for a new user @positive", async ({ authedPage: page }) => {
    await open(page, "/settings");
    await expect(page.getByText("Disconnected")).toHaveCount(2);
  });

  test("changes the password and signs out @positive", async ({ authedPage: page, anon, user }) => {
    await open(page, "/settings");
    await page.getByRole("button", { name: "Change Password" }).click();
    const d = page.getByRole("dialog", { name: "Change Password" });
    await d.getByRole("textbox", { name: "Current Password" }).fill(user.password);
    await d.getByRole("textbox", { name: "New Password" }).fill("Another-Pass-77");
    await d.getByRole("textbox", { name: "Confirm Password" }).fill("Another-Pass-77");
    await d.getByRole("button", { name: "Update Password" }).click();
    await expect(page).toHaveURL(/#\/login$/);
    expect((await anon.post("/auth/login", { username: user.username, password: "Another-Pass-77" })).status()).toBe(200);
  });

  test("mismatched new passwords are refused @negative", async ({ authedPage: page }) => {
    await open(page, "/settings");
    await page.getByRole("button", { name: "Change Password" }).click();
    const d = page.getByRole("dialog", { name: "Change Password" });
    await d.getByRole("textbox", { name: "Current Password" }).fill("whatever1");
    await d.getByRole("textbox", { name: "New Password" }).fill("Another-Pass-77");
    await d.getByRole("textbox", { name: "Confirm Password" }).fill("Different-77");
    await d.getByRole("button", { name: "Update Password" }).click();
    await expectToast(page, "Failed", "Passwords do not match");
  });

  test("a wrong current password shows the server error @negative", async ({ authedPage: page }) => {
    await open(page, "/settings");
    await page.getByRole("button", { name: "Change Password" }).click();
    const d = page.getByRole("dialog", { name: "Change Password" });
    await d.getByRole("textbox", { name: "Current Password" }).fill("wrong-pass-1");
    await d.getByRole("textbox", { name: "New Password" }).fill("Another-Pass-77");
    await d.getByRole("textbox", { name: "Confirm Password" }).fill("Another-Pass-77");
    await d.getByRole("button", { name: "Update Password" }).click();
    await expectToast(page, "Failed", "Current password incorrect");
  });

  test("logout everywhere returns to login @positive", async ({ authedPage: page }) => {
    await open(page, "/settings");
    await page.getByRole("button", { name: "Logout All Devices" }).click();
    await page.getByRole("dialog", { name: "Logout All Devices" }).getByRole("button", { name: "Logout Everywhere" }).click();
    await expect(page).toHaveURL(/#\/login$/);
  });

  test("deleting the account with the wrong password is refused @negative", async ({ authedPage: page, anon, user }) => {
    await open(page, "/settings");
    await page.getByRole("button", { name: "Delete Account" }).click();
    const d = page.getByRole("dialog", { name: "Delete Account" });
    await d.getByRole("textbox", { name: "Confirm Password" }).fill("WrongPass123");
    await d.getByRole("button", { name: "Delete Account" }).click();
    await expectToast(page, "Delete failed");
    expect((await anon.post("/auth/login", { username: user.username, password: user.password })).status()).toBe(200);
  });

  test("deletes the account with the right password @positive", async ({ authedPage: page, anon, user }) => {
    await open(page, "/settings");
    await page.getByRole("button", { name: "Delete Account" }).click();
    const d = page.getByRole("dialog", { name: "Delete Account" });
    await d.getByRole("textbox", { name: "Confirm Password" }).fill(user.password);
    await d.getByRole("button", { name: "Delete Account" }).click();
    await expect(page).toHaveURL(/#\/login$/);
    expect((await anon.post("/auth/login", { username: user.username, password: user.password })).status()).toBe(401);
  });
});

test.describe("AI assistant page", () => {
  test("sends a message and shows the assistant's reply @positive", async ({ authedPage: page, api }) => {
    const g = await api.addGame(byName("Fallout Shelter"));
    await open(page, "/ai");
    await page.getByPlaceholder("Type a message...").fill("rate fallout shelter 9");
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByText("I've posted your 9-star review for Fallout Shelter.")).toBeVisible();
    expect((await json(await api.get(`/review/${g._id}`))).Data.rating).toBe(9);
  });

  test("Send is disabled for an empty message @negative", async ({ authedPage: page }) => {
    await open(page, "/ai");
    await expect(page.getByRole("button", { name: "Send message" })).toBeDisabled();
    await page.getByPlaceholder("Type a message...").fill("   ");
    await expect(page.getByRole("button", { name: "Send message" })).toBeDisabled();
  });

  test("an AI failure shows an error with a retry option @negative", async ({ authedPage: page }) => {
    await open(page, "/ai");
    await page.getByPlaceholder("Type a message...").fill("zxqv blorp");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "Execution Failed" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Retry Action" })).toBeVisible();
  });

  test("Clear empties the conversation @positive", async ({ authedPage: page, api }) => {
    await api.addGame(byName("Fallout Shelter"));
    await open(page, "/ai");
    await page.getByPlaceholder("Type a message...").fill("rate fallout shelter 9");
    await page.keyboard.press("Enter");
    await expect(page.getByText("2 messages")).toBeVisible();
    await page.getByRole("button", { name: "Clear" }).click();
    await expect(page.getByRole("heading", { name: "Start a new conversation" })).toBeVisible();
  });
});
