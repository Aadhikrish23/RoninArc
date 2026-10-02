import { test, expect } from "../../fixtures/test";
import { byName } from "../../fixtures/catalog.mjs";
import { open } from "../../helpers/ui";

const titles = (page: any) =>
  page.getByRole("paragraph").filter({ hasText: /^(Hades|Celeste|Elden Ring|Stardew Valley)$/ }).allInnerTexts();

test.describe("Browse all games page", () => {
  test.beforeEach(async ({ api }) => {
    await api.addGame(byName("Hades"), { progressStatus: "playing" });
    await api.addGame(byName("Celeste"), { progressStatus: "completed" });
    await api.addGame(byName("Elden Ring"));
  });

  test("lists every game, sorted A-Z by default @positive", async ({ authedPage: page }) => {
    await open(page, "/library/browse");
    await expect(page.getByRole("heading", { name: "All Games" })).toBeVisible();
    await expect.poll(() => titles(page)).toEqual(["Celeste", "Elden Ring", "Hades"]);
  });

  test("sorts Z-A @positive", async ({ authedPage: page }) => {
    await open(page, "/library/browse");
    await page.getByRole("combobox").nth(3).selectOption({ label: "Title (Z-A)" });
    await expect.poll(() => titles(page)).toEqual(["Hades", "Elden Ring", "Celeste"]);
  });

  test("filters by progress status @positive", async ({ authedPage: page }) => {
    await open(page, "/library/browse");
    await page.getByRole("combobox").first().selectOption({ label: "Completed" });
    await expect.poll(() => titles(page)).toEqual(["Celeste"]);
  });

  test("searches by title @positive", async ({ authedPage: page }) => {
    await open(page, "/library/browse");
    await page.getByPlaceholder("Search library...").fill("eld");
    await expect.poll(() => titles(page)).toEqual(["Elden Ring"]);
  });

  test("a search with no matches shows no games @negative", async ({ authedPage: page }) => {
    await open(page, "/library/browse");
    await page.getByPlaceholder("Search library...").fill("zzzz");
    await expect.poll(() => titles(page)).toEqual([]);
  });

  test("a filter with no matches shows no games @negative", async ({ authedPage: page }) => {
    await open(page, "/library/browse");
    await page.getByRole("combobox").first().selectOption({ label: "Dropped" });
    await expect.poll(() => titles(page)).toEqual([]);
  });

  test("'Installed' only shows provider-installed games (none for manual adds) @negative", async ({ authedPage: page }) => {
    await open(page, "/library/browse");
    await page.getByRole("combobox").nth(2).selectOption({ label: "Installed" });
    await expect.poll(() => titles(page)).toEqual([]);
    await page.getByRole("combobox").nth(2).selectOption({ label: "Not Installed" });
    await expect.poll(() => titles(page)).toEqual(["Celeste", "Elden Ring", "Hades"]);
  });

  test("switches between grid and list views @positive", async ({ authedPage: page }) => {
    await open(page, "/library/browse");
    await page.getByRole("button", { name: "List View" }).click();
    await expect.poll(() => titles(page)).toEqual(["Celeste", "Elden Ring", "Hades"]);
    await page.getByRole("button", { name: "Grid View" }).click();
    await expect.poll(() => titles(page)).toEqual(["Celeste", "Elden Ring", "Hades"]);
  });

  test("'Back to Library' returns home @positive", async ({ authedPage: page }) => {
    await open(page, "/library/browse");
    await page.getByRole("button", { name: "Back to Library" }).click();
    await expect(page).toHaveURL(/#\/$/);
  });
});
