import { test, expect } from "../../fixtures/test";
import { json } from "../../helpers/api";
import { byName } from "../../fixtures/catalog.mjs";
import { assistant, assistantButton, emulateDesktop, expectToast, navbar, open } from "../../helpers/ui";

const panel = (page: any, name: string) => page.getByRole("region", { name });

test.describe("Dashboard", () => {
  test("shows what you're playing, backlog progress and recent activity @positive", async ({ authedPage: page, api }) => {
    const hades = await api.addGame(byName("Hades"));
    await api.patch(`/game/${hades._id}`, { progressStatus: "playing" });
    const celeste = await api.addGame(byName("Celeste"));
    await api.patch(`/game/${celeste._id}`, { progressStatus: "completed" });
    await api.addGame(byName("Hitman"), { progressStatus: "plan" });
    await open(page, "/dashboard");
    await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();

    const pickUp = panel(page, "Pick up where you left off");
    await expect(pickUp.getByRole("article", { name: "Hades" })).toContainText("In progress · no play sessions recorded yet");

    const backlog = panel(page, "Backlog progress");
    // Hades (playing) + Hitman (planned) are the backlog; Celeste is finished.
    await expect(backlog).toContainText("2 games in your backlog");
    await expect(backlog).toContainText("1 of 3 finished");
    await expect(backlog).toContainText("1 finished this year");
    await expect(backlog).toContainText("Hitman");
    await expect(backlog).not.toContainText("No Status");

    const activity = panel(page, "Recent activity");
    await expect(activity).toContainText("Celeste marked as Completed");
    await expect(activity).toContainText("Hades marked as Playing");

    await pickUp.getByRole("article", { name: "Hades" }).click();
    await expect(page).toHaveURL(new RegExp(`#/library/game/${byName("Hades").id}$`));
  });

  test("a new user gets empty states, and the web build explains where playtime comes from @negative", async ({ authedPage: page }) => {
    await open(page, "/dashboard");
    await expect(panel(page, "Pick up where you left off")).toContainText("Nothing in progress.");
    await expect(panel(page, "Playtime")).toContainText("Playtime is tracked when you launch games from the RoninArc desktop app.");
    await expect(panel(page, "Backlog progress")).toContainText("0 games in your backlog");
    await expect(panel(page, "Backlog progress")).toContainText("Nothing planned yet.");
    await expect(panel(page, "Recent activity")).toContainText("No activity yet.");
  });

  test("a failing overview shows an error with a retry @negative", async ({ authedPage: page }) => {
    let fail = true;
    await page.route("**/dashboard/overview", (route) =>
      fail ? route.fulfill({ status: 500, json: { Status: "Fail", error: "Internal Server Error" } }) : route.continue(),
    );
    await open(page, "/dashboard");
    await expect(page.getByRole("alert")).toContainText("Couldn't load your dashboard.");
    fail = false;
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByRole("region", { name: "Playtime" })).toBeVisible();
  });
});

test.describe("Navigation", () => {
  test("navbar buttons route to each page @positive", async ({ authedPage: page }) => {
    await open(page, "/");
    for (const [name, url] of [["Dashboard", /#\/dashboard$/], ["Settings", /#\/settings$/], ["Library", /#\/$/]] as const) {
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

test.describe("AI assistant (quick-access modal)", () => {
  test("a floating button opens it on every page, and closing keeps the conversation @positive", async ({ authedPage: page }) => {
    for (const path of ["/", "/dashboard", "/settings", "/library/browse"]) {
      await open(page, path);
      await expect(assistantButton(page)).toBeVisible();
    }
    await assistantButton(page).click();
    await assistant(page).getByPlaceholder("Type a message...").fill("hi");
    await page.keyboard.press("Enter");
    await expect(assistant(page).getByText("Hello! I am your RoninArc AI assistant.", { exact: false })).toBeVisible();
    await assistant(page).getByRole("button", { name: "Close assistant" }).click();
    await expect(assistant(page)).toBeHidden();
    await assistantButton(page).click();
    await expect(assistant(page).getByText("Hello! I am your RoninArc AI assistant.", { exact: false })).toBeVisible();
  });

  test("desktop: 'launch <game>' starts it through the app and shows it Running @positive", async ({ authedPage: page, api }) => {
    const g = await api.addGame(byName("Fallout Shelter"), { exePath: "C:\\Games\\FalloutShelter\\FalloutShelter.exe" });
    await emulateDesktop(page);
    await open(page, "/");
    await assistantButton(page).click();
    await assistant(page).getByPlaceholder("Type a message...").fill("launch fallout shelter");
    await page.keyboard.press("Enter");
    await expect(assistant(page).getByText("Launching Fallout Shelter on your PC.")).toBeVisible();
    await expect.poll(() => page.evaluate(() => (window as any).__launched)).toEqual([{ gameId: g._id, path: "C:\\Games\\FalloutShelter\\FalloutShelter.exe" }]);
    await assistant(page).getByRole("button", { name: "Close assistant" }).click();
    await expect(page.getByRole("button", { name: "Running" }).first()).toBeDisabled();
    // The app (not the server) started the play session, and the exit event ends it.
    expect((await json(await api.get("/play-session/recent"))).Data[0]).toMatchObject({ gameId: { _id: g._id }, endedAt: null });
    await page.evaluate((id) => (window as any).__exitGame(id), g._id);
    await expect(page.getByRole("button", { name: "Launch" }).first()).toBeEnabled();
    await expect.poll(async () => (await json(await api.get("/play-session/recent"))).Data[0].endedAt).not.toBeNull();
  });

  test("desktop: 'launch <game>' without a known executable opens the launch dialog @negative", async ({ authedPage: page, api }) => {
    await api.addGame(byName("Fallout Shelter"));
    await emulateDesktop(page);
    await open(page, "/");
    await assistantButton(page).click();
    await assistant(page).getByPlaceholder("Type a message...").fill("launch fallout shelter");
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Launch Fallout Shelter" });
    await expect(dialog).toContainText("Choose the executable file for this game.");
    expect(await page.evaluate(() => (window as any).__launched)).toEqual([]);
  });

  test("web: 'launch <game>' explains it needs the desktop app and starts nothing @negative", async ({ authedPage: page, api }) => {
    await api.addGame(byName("Fallout Shelter"), { exePath: "C:\\Games\\FalloutShelter\\FalloutShelter.exe" });
    await open(page, "/");
    await assistantButton(page).click();
    await assistant(page).getByPlaceholder("Type a message...").fill("launch fallout shelter");
    await page.keyboard.press("Enter");
    await expect(
      assistant(page).getByText("Launching games only works in the RoninArc desktop app, so I can't start Fallout Shelter from here."),
    ).toBeVisible();
    expect((await json(await api.get("/play-session/recent"))).Data).toEqual([]);
  });

  test("the navbar has no AI tab, and old #/ai links open the modal @negative", async ({ authedPage: page }) => {
    await open(page, "/");
    await expect(navbar(page).getByRole("button", { name: "AI Assistant" })).toHaveCount(0);
    await open(page, "/ai");
    await expect(page).toHaveURL(/#\/$/);
    await expect(assistant(page)).toBeVisible();
  });

  test("greets back even when the model is offline @positive", async ({ authedPage: page }) => {
    await open(page, "/ai");
    await page.getByPlaceholder("Type a message...").fill("hi");
    await page.keyboard.press("Enter");
    await expect(page.getByText("Hello! I am your RoninArc AI assistant.", { exact: false })).toBeVisible();
  });

  test("sends a message and shows the assistant's reply @positive", async ({ authedPage: page, api }) => {
    const g = await api.addGame(byName("Fallout Shelter"));
    await open(page, "/ai");
    await page.getByPlaceholder("Type a message...").fill("rate fallout shelter 9");
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByText("I've rated Fallout Shelter 9/10.")).toBeVisible();
    expect((await json(await api.get(`/review/${g._id}`))).Data.rating).toBe(9);
  });

  test("Send is disabled for an empty message @negative", async ({ authedPage: page }) => {
    await open(page, "/ai");
    await expect(page.getByRole("button", { name: "Send message" })).toBeDisabled();
    await page.getByPlaceholder("Type a message...").fill("   ");
    await expect(page.getByRole("button", { name: "Send message" })).toBeDisabled();
  });

  test("an offline AI explains itself and offers a retry @negative", async ({ authedPage: page }) => {
    await open(page, "/ai");
    await page.getByPlaceholder("Type a message...").fill("zxqv blorp");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "Couldn't do that" })).toBeVisible();
    await expect(page.getByText(/The AI assistant is offline right now/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  });

  test("Clear empties the conversation @positive", async ({ authedPage: page, api }) => {
    await api.addGame(byName("Fallout Shelter"));
    await open(page, "/ai");
    await page.getByPlaceholder("Type a message...").fill("rate fallout shelter 9");
    await page.keyboard.press("Enter");
    await expect(page.getByText("2 messages")).toBeVisible();
    // Clearing asks for a second click.
    await page.getByRole("button", { name: "Clear" }).click();
    await expect(page.getByText("2 messages")).toBeVisible();
    await page.getByRole("button", { name: "Clear chat?" }).click();
    await expect(page.getByRole("heading", { name: "Start a new conversation" })).toBeVisible();
  });
});
