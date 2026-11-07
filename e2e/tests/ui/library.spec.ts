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

  test.describe("a game you own but don't have on this PC", () => {
    const seedUninstalledSteamGame = async (api: any) => {
      const scan = { appId: 1145360, name: "Hades", installPath: "C:/Steam/common/Hades" };
      await api.post("/provider/installations/refresh", { installations: { steam: [scan] } });
      await api.post("/provider/installations/refresh", { installations: { steam: [] } });
    };

    // Epic ownership comes from Epic's servers, so its fields are patched onto the library response.
    const asEpicGame = async (page: any, epic: Record<string, unknown>) => {
      await page.route(/\/game(\?.*)?$/, async (route: any) => {
        if (route.request().method() !== "GET") return route.continue();
        const response = await route.fetch();
        const body = await response.json();
        for (const game of body.Data) {
          game.providers = { epic: { providerGameId: "cat123", installed: false, syncedAt: new Date().toISOString(), ...epic } };
        }
        await route.fulfill({ response, json: body });
      });
    };

    const gamePagesFromCard = async (page: any, name: string) => {
      await open(page, "/library/browse");
      await page.getByRole("button", { name }).click();
      return page.evaluate(() => (window as any).__gamePages);
    };

    test("Open in Steam goes to the game's page there and stays on this page @positive", async ({ authedPage: page, api }) => {
      await seedUninstalledSteamGame(api);
      await emulateDesktop(page);
      expect(await gamePagesFromCard(page, "Open in Steam")).toEqual([{ provider: "steam", gameId: "1145360" }]);
      await expectToast(page, "Opening Steam", "Once it's installed, use Rescan PC Games to launch it from here.");
      await expect(page).toHaveURL(/#\/library\/browse$/);
      expect(await page.evaluate(() => (window as any).__launched)).toEqual([]);
    });

    test("the game's own page offers it too @positive", async ({ authedPage: page, api }) => {
      await seedUninstalledSteamGame(api);
      await emulateDesktop(page);
      await open(page, "/library/browse");
      await page.getByText("Hades", { exact: true }).click();
      await page.getByRole("button", { name: "Open in Steam" }).click();
      expect(await page.evaluate(() => (window as any).__gamePages)).toEqual([{ provider: "steam", gameId: "1145360" }]);
    });

    test("list view offers it too @positive", async ({ authedPage: page, api }) => {
      await seedUninstalledSteamGame(api);
      await emulateDesktop(page);
      await open(page, "/library/browse");
      await page.getByRole("button", { name: "List View" }).click();
      await page.getByRole("button", { name: "Open in Steam" }).click();
      expect(await page.evaluate(() => (window as any).__gamePages)).toEqual([{ provider: "steam", gameId: "1145360" }]);
      await expect(page).toHaveURL(/#\/library\/browse$/);
    });

    test("says so when the launcher can't be opened @negative", async ({ authedPage: page, api }) => {
      await seedUninstalledSteamGame(api);
      await emulateDesktop(page, { gamePageOpens: false });
      await gamePagesFromCard(page, "Open in Steam");
      await expectToast(page, "Couldn't open Steam", "Check that Steam is installed on this PC.");
    });

    test("a game that's installed offers Launch instead @negative", async ({ authedPage: page, api }) => {
      await api.post("/provider/installations/refresh", {
        installations: { steam: [{ appId: 1145360, name: "Hades", installPath: "C:/Steam/common/Hades" }] },
      });
      await emulateDesktop(page);
      await open(page, "/library/browse");
      await expect(page.getByRole("button", { name: "Launch" })).toBeVisible();
      await expect(page.getByRole("button", { name: /^Open in/ })).toHaveCount(0);
    });

    test("a game you added by hand has no launcher to install from @negative", async ({ authedPage: page, api }) => {
      await api.addGame(byName("Celeste"));
      await emulateDesktop(page);
      await open(page, "/library/browse");
      await expect(page.getByRole("button", { name: "Launch" })).toBeVisible();
      await expect(page.getByRole("button", { name: /^Open in/ })).toHaveCount(0);
    });

    test("in a plain browser there's no install button @negative", async ({ authedPage: page, api }) => {
      await seedUninstalledSteamGame(api);
      await open(page, "/library/browse");
      await expect(page.getByText("Hades", { exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: /^Open in/ })).toHaveCount(0);
    });

    test("Epic: asks for the game's page using its catalog ids @positive", async ({ authedPage: page, api }) => {
      await api.addGame(byName("Celeste"));
      await emulateDesktop(page);
      await asEpicGame(page, { namespace: "ns1" });
      expect(await gamePagesFromCard(page, "Open in Epic Games")).toEqual([{ provider: "epic", gameId: "cat123", namespace: "ns1" }]);
    });

    test("rescanning leaves the account cards alone @negative", async ({ authedPage: page, api }) => {
      await api.addGame(byName("Celeste"));
      await emulateDesktop(page);
      let release = () => {};
      const held = new Promise<void>((resolve) => (release = resolve));
      await page.route(/\/provider\/installations\/refresh$/, async (route: any) => {
        await held;
        await route.continue();
      });
      await page.route(/\/provider\/(epic|steam)\/status$/, (route: any) =>
        route.fulfill({ json: { Data: { connected: true, displayName: "Tarnished", importedGames: 3, lastSync: null } } }),
      );
      await open(page, "/");
      await page.getByRole("button", { name: "Rescan PC Games" }).click();
      // While the rescan is still running, on the page with the cards.
      await page.evaluate(() => (location.hash = "#/settings"));
      await expect(page.getByRole("heading", { name: "Account connections" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Resync Library" })).toHaveCount(2);
      await expect(page.getByText("Syncing", { exact: true })).toHaveCount(0);
      release();
    });
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
