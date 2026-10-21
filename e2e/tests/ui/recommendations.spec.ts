import { test, expect } from "../../fixtures/test";
import { json } from "../../helpers/api";
import { byName } from "../../fixtures/catalog.mjs";
import { open, navbar } from "../../helpers/ui";

const section = (page: any, name: string) => page.getByRole("region", { name });
const cardIn = (page: any, sectionName: string, title: string) =>
  section(page, sectionName).getByRole("article", { name: title });

test.describe("For You (recommendations) page", () => {
  test("lives under the library: no navbar tab, reached via 'See all' @positive", async ({ authedPage: page, api }) => {
    await api.addGame(byName("Celeste"));
    await open(page, "/");
    await expect(navbar(page).getByRole("button", { name: "For You" })).toHaveCount(0);
    await section(page, "Recommended For You").getByRole("button", { name: "See all" }).click();
    await expect(page).toHaveURL(/#\/recommendations$/);
    await expect(page.getByRole("heading", { name: "For You", level: 2 })).toBeVisible();
  });

  test("a new user sees popular discoveries and a hint to personalise @positive", async ({ authedPage: page }) => {
    await open(page, "/recommendations");
    await expect(page.getByText("Rate or finish a few games and these picks will get more personal.")).toBeVisible();
    await expect(section(page, "Play Next")).toContainText("Nothing waiting in your backlog.");
    await expect(section(page, "Discover").getByRole("article")).not.toHaveCount(0);
  });

  test("shows taste-based picks with reasons in both sections @positive", async ({ authedPage: page, api }) => {
    const hk = await api.addGame(byName("Hollow Knight"), { progressStatus: "completed" });
    await api.put(`/review/${hk._id}`, { rating: 9 });
    await api.addGame(byName("Stardew Valley"));

    await open(page, "/recommendations");
    await expect(page.getByLabel("Your taste")).toContainText("You seem to love:");
    const backlogCard = cardIn(page, "Play Next", "Stardew Valley");
    // A game you own has no "% match": that badge is for discoveries.
    await expect(backlogCard).not.toContainText("% match");
    // Stardew shares only "Indie" with Hollow Knight: too little to call it similar.
    await expect(backlogCard).toContainText("Matches your taste for Indie");
    await expect(cardIn(page, "Discover", "Celeste")).toBeVisible();
    await expect(section(page, "Discover").getByRole("article", { name: "Hollow Knight" })).toHaveCount(0);
  });

  test("'Add to Library' moves a discovery into the backlog @positive", async ({ authedPage: page, api }) => {
    await open(page, "/recommendations");
    const card = cardIn(page, "Discover", "Celeste");
    await card.getByRole("button", { name: "Add to Library" }).click();

    await expect(cardIn(page, "Play Next", "Celeste")).toBeVisible();
    await expect(cardIn(page, "Discover", "Celeste")).toHaveCount(0);
    const library = (await json(await api.get("/game"))).Data;
    expect(library.map((g: any) => g.title)).toEqual(["Celeste"]);
  });

  test("'Start Playing' moves a backlog pick to Continue Playing @positive", async ({ authedPage: page, api }) => {
    const g = await api.addGame(byName("Celeste"));
    await open(page, "/recommendations");
    await cardIn(page, "Play Next", "Celeste").getByRole("button", { name: "Start Playing" }).click();
    await expect(page.getByText("Marked Celeste as Playing")).toBeVisible();
    await expect.poll(async () => (await json(await api.get(`/game/${g._id}`))).Data.progressStatus).toBe("playing");
  });

  test("'Not interested' hides a discovery, and Undo brings it back @positive", async ({ authedPage: page }) => {
    await open(page, "/recommendations");
    await cardIn(page, "Discover", "Celeste").getByRole("button", { name: "Not interested" }).click();
    await expect(cardIn(page, "Discover", "Celeste")).toHaveCount(0);

    await page.reload();
    await expect(section(page, "Discover").getByRole("article")).not.toHaveCount(0);
    await expect(cardIn(page, "Discover", "Celeste")).toHaveCount(0);
  });

  test("Undo restores a dismissed game @positive", async ({ authedPage: page }) => {
    await open(page, "/recommendations");
    await cardIn(page, "Discover", "Celeste").getByRole("button", { name: "Not interested" }).click();
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(cardIn(page, "Discover", "Celeste")).toBeVisible();
  });

  test("a mood hint focuses the picks @positive", async ({ authedPage: page, api }) => {
    await api.addGame(byName("Celeste"));
    await api.addGame(byName("Elden Ring"));
    await open(page, "/recommendations");
    await page.getByLabel("What are you in the mood for?").fill("a platformer");
    await expect(page.getByLabel("Your taste")).toContainText("Focusing on:");
    await expect(cardIn(page, "Play Next", "Celeste")).toBeVisible();
    await expect(cardIn(page, "Play Next", "Elden Ring")).toHaveCount(0);
  });

  test("when the game database is offline it still shows backlog picks, with a notice @negative", async ({ authedPage: page, api }) => {
    await api.addGame(byName("Celeste"));
    await page.route("**/recommendations?*", async (route) => {
      const res = await route.fetch();
      const body = await res.json();
      body.Data.discover = [];
      body.Data.discoverError = "Couldn't reach the game database right now, so only picks from your own library are shown.";
      await route.fulfill({ response: res, json: body });
    });
    await open(page, "/recommendations");
    await expect(page.getByText(/Couldn't reach the game database/)).toBeVisible();
    await expect(cardIn(page, "Play Next", "Celeste")).toBeVisible();
    await expect(section(page, "Discover")).toContainText("No new games to suggest right now.");
  });

  test("an API failure shows an error instead of a blank page @negative", async ({ authedPage: page }) => {
    await page.route("**/recommendations?*", (route) =>
      route.fulfill({ status: 500, json: { Status: "Error", error: "Internal Server Error" } }),
    );
    await open(page, "/recommendations");
    await expect(page.getByRole("alert")).toContainText("Internal Server Error");
  });
});

test.describe("Recommended For You strip (library home)", () => {
  test("shows picks and links to the full page @positive", async ({ authedPage: page, api }) => {
    await api.addGame(byName("Celeste"));
    await open(page, "/");
    const strip = section(page, "Recommended For You");
    await expect(strip.getByRole("article").first()).toBeVisible();
    await strip.getByRole("button", { name: "See all" }).click();
    await expect(page).toHaveURL(/#\/recommendations$/);
  });

  test("is hidden when there is nothing to recommend @negative", async ({ authedPage: page, api }) => {
    await api.addGame(byName("Celeste"), { progressStatus: "completed" });
    await page.route("**/recommendations?*", async (route) => {
      const res = await route.fetch();
      const body = await res.json();
      body.Data.backlog = [];
      body.Data.discover = [];
      await route.fulfill({ response: res, json: body });
    });
    await open(page, "/");
    await expect(page.getByRole("heading", { name: "Recently Added" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Recommended For You" })).toHaveCount(0);
  });
});
