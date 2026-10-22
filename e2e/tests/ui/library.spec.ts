import { test, expect } from "../../fixtures/test";
import { json } from "../../helpers/api";
import { byName } from "../../fixtures/catalog.mjs";
import { emulateDesktop, expectToast, open } from "../../helpers/ui";

const section = (page: any, title: string) =>
  page.locator("div").filter({ has: page.getByRole("heading", { name: title, exact: true }) }).last();

test.describe("Library home page", () => {
  test("an empty library shows the welcome state, which links to Settings @positive", async ({ authedPage: page }) => {
    await open(page, "/");
    await expect(page.getByRole("heading", { name: "Your library is empty" })).toBeVisible();
    await page.getByRole("button", { name: "Connect Steam or Epic" }).click();
    await expect(page).toHaveURL(/#\/settings$/);
  });

  test("groups games into Continue playing, Favorites, Recently added and Completed @positive", async ({ authedPage: page, api }) => {
    const hades = await api.addGame(byName("Hades"), { progressStatus: "playing" });
    await api.addGame(byName("Elden Ring"), { progressStatus: "completed" });
    await api.addGame(byName("Celeste"));
    await api.put(`/review/${hades._id}`, { rating: 9 });

    await open(page, "/");
    await expect(section(page, "Continue playing").getByText("Hades")).toBeVisible();
    await expect(section(page, "Favorites (rated 8+)").getByText("Hades")).toBeVisible();
    await expect(section(page, "Completed games").getByText("Elden Ring")).toBeVisible();
    await expect(section(page, "Recently added").getByText("Celeste")).toBeVisible();
  });

  test("paused games are in Continue playing, after the ones being played @positive", async ({ authedPage: page, api }) => {
    await api.addGame(byName("Celeste"), { progressStatus: "paused" });
    await api.addGame(byName("Hades"), { progressStatus: "playing" });
    await open(page, "/");
    const row = section(page, "Continue playing");
    await expect(row.getByText("Celeste")).toBeVisible();
    await expect(row.getByText("Hades")).toBeVisible();
  });

  test("a favourite that's completed isn't shown again under Completed games @negative", async ({ authedPage: page, api }) => {
    const elden = await api.addGame(byName("Elden Ring"), { progressStatus: "completed" });
    await api.addGame(byName("Celeste"), { progressStatus: "completed" });
    await api.put(`/review/${elden._id}`, { rating: 9 });
    await open(page, "/");
    await expect(section(page, "Favorites (rated 8+)").getByText("Elden Ring")).toBeVisible();
    await expect(section(page, "Completed games").getByText("Celeste")).toBeVisible();
    await expect(section(page, "Completed games").getByText("Elden Ring")).toHaveCount(0);
  });

  test("sections with nothing in them are hidden @negative", async ({ authedPage: page, api }) => {
    await api.addGame(byName("Celeste"));
    await open(page, "/");
    await expect(page.getByRole("heading", { name: "Recently added" })).toBeVisible();
    for (const title of ["Continue playing", "Favorites (rated 8+)", "Completed games"]) {
      await expect(page.getByRole("heading", { name: title, exact: true })).toHaveCount(0);
    }
  });

  test("a low rating does not make a game a favorite @negative", async ({ authedPage: page, api }) => {
    const g = await api.addGame(byName("Celeste"));
    await api.put(`/review/${g._id}`, { rating: 3 });
    await open(page, "/");
    await expect(page.getByRole("heading", { name: "Recently added" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Favorites (rated 8+)" })).toHaveCount(0);
  });

  test("changing status from a card's menu persists and moves the card @positive", async ({ authedPage: page, api }) => {
    const g = await api.addGame(byName("Celeste"));
    await open(page, "/");
    await section(page, "Recently added").getByRole("button", { name: "Plan to Play" }).click();
    await page.getByRole("menuitem", { name: "Playing" }).click();

    await expect(section(page, "Continue playing").getByText("Celeste")).toBeVisible();
    await expect.poll(async () => (await json(await api.get(`/game/${g._id}`))).Data.progressStatus).toBe("playing");
  });

  test("clicking a card opens the game's detail page @positive", async ({ authedPage: page, api }) => {
    await api.addGame(byName("Celeste"));
    await open(page, "/");
    await section(page, "Recently added").getByRole("paragraph").filter({ hasText: /^Celeste$/ }).click();
    await expect(page).toHaveURL(new RegExp(`#/library/game/${byName("Celeste").id}$`));
    await expect(page.getByRole("heading", { name: "Celeste", level: 2 })).toBeVisible();
  });

  test("in a plain browser there is nothing to launch or rescan @negative", async ({ authedPage: page, api }) => {
    await api.addGame(byName("Celeste"), { progressStatus: "playing" });
    await open(page, "/");
    await expect(section(page, "Continue playing").getByText("Celeste")).toBeVisible();
    await expect(page.getByRole("button", { name: /^(Launch|Running|Not installed)$/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Rescan PC Games" })).toHaveCount(0);
    await open(page, `/library/game/${byName("Celeste").id}`);
    await expect(page.getByRole("heading", { name: "Celeste", level: 2 })).toBeVisible();
    await expect(page.getByRole("button", { name: /^(Launch|Running|Not installed)$/ })).toHaveCount(0);
  });

  test("desktop: Launch on a game with no executable asks for one and won't launch yet @negative", async ({ authedPage: page, api }) => {
    await api.addGame(byName("Celeste"));
    await emulateDesktop(page);
    await open(page, "/");
    await section(page, "Recently added").getByRole("button", { name: "Launch" }).click();
    const dialog = page.getByRole("dialog", { name: "Launch Celeste" });
    await expect(dialog).toContainText("Choose the executable file for this game.");
    await expect(dialog.getByRole("button", { name: "Launch" })).toBeDisabled();
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
  });

  test("desktop: picking an executable and launching marks the game Running @positive", async ({ authedPage: page, api }) => {
    const g = await api.addGame(byName("Celeste"));
    await emulateDesktop(page, { exePath: "C:\\Games\\Celeste\\Celeste.exe" });
    await open(page, "/");
    await section(page, "Recently added").getByRole("button", { name: "Launch" }).click();
    const dialog = page.getByRole("dialog", { name: "Launch Celeste" });
    await dialog.getByRole("button", { name: "Edit" }).click();
    await dialog.getByRole("button", { name: "Launch" }).click();
    await expect(section(page, "Recently added").getByRole("button", { name: "Running" })).toBeDisabled();
    expect(await page.evaluate(() => (window as any).__launched)).toEqual([{ gameId: g._id, path: "C:\\Games\\Celeste\\Celeste.exe" }]);
  });

  test("desktop: 'Rescan PC Games' reports an empty scan when nothing is installed @negative", async ({ authedPage: page, api }) => {
    await api.addGame(byName("Celeste"));
    await emulateDesktop(page);
    await open(page, "/");
    await page.getByRole("button", { name: "Rescan PC Games" }).click();
    await expectToast(page, "Rescan complete", "Steam: Scanned 0, Installed 0, Removed 0. Epic: Scanned 0, Installed 0, Removed 0.");
  });

  test("'View all games' opens the browse page @positive", async ({ authedPage: page, api }) => {
    await api.addGame(byName("Celeste"));
    await open(page, "/");
    await page.getByRole("button", { name: "View all games" }).click();
    await expect(page).toHaveURL(/#\/library\/browse$/);
    await expect(page.getByRole("heading", { name: "All Games" })).toBeVisible();
  });

  test("a failing library API shows an error state @negative", async ({ authedPage: page }) => {
    await page.route("**/game", (route) =>
      route.request().method() === "GET" ? route.fulfill({ status: 500, json: { Status: "Fail", error: "Internal Server Error" } }) : route.continue(),
    );
    await open(page, "/");
    await expect(page.getByRole("alert").filter({ hasText: "Couldn't load your library" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  });
});

test.describe("RAWG search from the library", () => {
  test("typing shows discover suggestions @positive", async ({ authedPage: page }) => {
    await open(page, "/");
    await page.getByPlaceholder("Search games...").fill("Hollow");
    await expect(page.getByText("Discover games")).toBeVisible();
    await expect(page.getByRole("img", { name: "Hollow Knight" })).toBeVisible();
  });

  test("Enter opens full results; 'Add' puts the game in the library @positive", async ({ authedPage: page, api }) => {
    await open(page, "/");
    const search = page.getByPlaceholder("Search games...");
    await search.fill("Hollow");
    await search.press("Enter");
    await expect(page.getByRole("heading", { name: "Discover games (1)" })).toBeVisible();

    await page.getByRole("button", { name: "Add" }).click();
    // A toast, not a blocking dialog; the result moves to "In your library" in place.
    await expectToast(page, "Added Hollow Knight to your library");
    await expect(page.getByRole("dialog")).toHaveCount(0);

    const library = (await json(await api.get("/game"))).Data;
    expect(library.map((g: any) => g.title)).toEqual(["Hollow Knight"]);
    expect(library[0]).toMatchObject({ rawgId: byName("Hollow Knight").id, progressStatus: "plan" });
  });

  test("games already owned are listed as owned, not discoverable @positive", async ({ authedPage: page, api }) => {
    await api.addGame(byName("Hades"));
    await open(page, "/");
    const search = page.getByPlaceholder("Search games...");
    await search.fill("Hades");
    await search.press("Enter");
    await expect(page.getByRole("heading", { name: /Discover Games/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Add" })).toHaveCount(0);
    await expect(page.getByText("Hades").first()).toBeVisible();
  });

  test("'← Back to library' leaves the results view @positive", async ({ authedPage: page }) => {
    await open(page, "/");
    const search = page.getByPlaceholder("Search games...");
    await search.fill("Celeste");
    await search.press("Enter");
    await page.getByRole("button", { name: "← Back to library" }).click();
    await expect(page.getByRole("heading", { name: "My Library" })).toBeVisible();
  });

  test("a blank search does nothing @negative", async ({ authedPage: page }) => {
    await open(page, "/");
    await page.getByPlaceholder("Search games...").press("Enter");
    await expect(page.getByText("Search results")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "My Library" })).toBeVisible();
  });

  test("a search with no matches shows no results to add @negative", async ({ authedPage: page }) => {
    await open(page, "/");
    const search = page.getByPlaceholder("Search games...");
    await search.fill("qqqq no such game");
    await search.press("Enter");
    await expect(page.getByText("Search results")).toBeVisible();
    await expect(page.getByRole("button", { name: "Add" })).toHaveCount(0);
  });
});
