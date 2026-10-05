import { test, expect } from "../../fixtures/test";
import { json } from "../../helpers/api";
import { byName } from "../../fixtures/catalog.mjs";
import { expectToast, open } from "../../helpers/ui";

const hades = byName("Hades");

test.describe("Game details page", () => {
  test("shows RAWG metadata and the user's library stats @positive", async ({ authedPage: page, api }) => {
    await api.addGame(hades, { progressStatus: "playing" });
    await open(page, `/library/game/${hades.id}`);
    await expect(page.getByRole("heading", { name: "Hades", level: 2 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Your Library" })).toBeVisible();
    await expect(page.getByText("Supergiant Games").first()).toBeVisible();
    await expect(page.getByText(hades.description)).toBeVisible();
    await expect(page.getByRole("button", { name: "Playing" })).toBeVisible();
    await expect(page.getByText("Never")).toBeVisible();
  });

  test("a game not in the library can be added from its page @positive", async ({ authedPage: page, api }) => {
    const elden = byName("Elden Ring");
    await open(page, `/library/game/${elden.id}`);
    await expect(page.getByRole("heading", { name: "Not In Library" })).toBeVisible();
    await page.getByRole("button", { name: "Add To Library" }).click();
    await expect(page.getByRole("heading", { name: "Your Library" })).toBeVisible();
    expect((await json(await api.get("/game"))).Data.map((g: any) => g.title)).toEqual(["Elden Ring"]);
  });

  test("an unknown RAWG id does not render a game @negative", async ({ authedPage: page }) => {
    await open(page, "/library/game/987654321");
    await expect(page.getByRole("heading", { name: "Your Library" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Add To Library" })).toHaveCount(0);
  });

  test("changes the play status @positive", async ({ authedPage: page, api }) => {
    const g = await api.addGame(hades, { progressStatus: "playing" });
    await open(page, `/library/game/${hades.id}`);
    await page.getByRole("button", { name: "Playing" }).click();
    await page.getByRole("menuitem", { name: "Completed" }).click();
    await expect.poll(async () => (await json(await api.get(`/game/${g._id}`))).Data.progressStatus).toBe("completed");
  });

  test.describe("review", () => {
    test("writes a review @positive", async ({ authedPage: page, api }) => {
      const g = await api.addGame(hades);
      await open(page, `/library/game/${hades.id}`);
      await page.getByRole("button", { name: /Write Review|Add Review|Rate/ }).first().click();
      const dialog = page.getByRole("dialog", { name: "Review Hades" });
      await dialog.getByRole("spinbutton", { name: "Rating" }).fill("8");
      await dialog.getByRole("textbox", { name: "Review" }).fill("Tight combat");
      await dialog.getByRole("button", { name: "Save" }).click();

      await expect(page.getByText("⭐ 8/10")).toBeVisible();
      await expect(page.getByText('"Tight combat"')).toBeVisible();
      expect((await json(await api.get(`/review/${g._id}`))).Data).toMatchObject({ rating: 8, reviewText: "Tight combat" });
    });

    test("edits an existing review @positive", async ({ authedPage: page, api }) => {
      const g = await api.addGame(hades);
      await api.put(`/review/${g._id}`, { rating: 6, reviewText: "Okay" });
      await open(page, `/library/game/${hades.id}`);
      await page.getByRole("button", { name: "Edit Review" }).click();
      const dialog = page.getByRole("dialog", { name: "Review Hades" });
      await expect(dialog.getByRole("spinbutton", { name: "Rating" })).toHaveValue("6");
      await dialog.getByRole("spinbutton", { name: "Rating" }).fill("10");
      await dialog.getByRole("button", { name: "Save" }).click();
      await expect(page.getByText("⭐ 10/10")).toBeVisible();
    });

    test("deletes a review @positive", async ({ authedPage: page, api }) => {
      const g = await api.addGame(hades);
      await api.put(`/review/${g._id}`, { rating: 6, reviewText: "Okay" });
      await open(page, `/library/game/${hades.id}`);
      await page.getByRole("button", { name: "Delete Review" }).click();
      const confirm = page.getByRole("alertdialog", { name: "Delete Review?" });
      await expect(confirm).toContainText("This action cannot be undone.");
      await confirm.getByRole("button", { name: "Delete", exact: true }).click();
      await expect(page.getByText("⭐ 6/10")).toHaveCount(0);
      await expect(page.getByText("No review yet.")).toBeVisible();
      await expect.poll(async () => (await json(await api.get(`/review/${g._id}`))).Data).toBeNull();
    });

    test("cancelling review deletion keeps the review @negative", async ({ authedPage: page, api }) => {
      const g = await api.addGame(hades);
      await api.put(`/review/${g._id}`, { rating: 6, reviewText: "Okay" });
      await open(page, `/library/game/${hades.id}`);
      await page.getByRole("button", { name: "Delete Review" }).click();
      await page.getByRole("alertdialog", { name: "Delete Review?" }).getByRole("button", { name: "Cancel" }).click();
      await expect(page.getByText("⭐ 6/10")).toBeVisible();
      expect((await json(await api.get(`/review/${g._id}`))).Data.rating).toBe(6);
    });

    test("cancelling the review dialog saves nothing @negative", async ({ authedPage: page, api }) => {
      const g = await api.addGame(hades);
      await api.put(`/review/${g._id}`, { rating: 6, reviewText: "Okay" });
      await open(page, `/library/game/${hades.id}`);
      await page.getByRole("button", { name: "Edit Review" }).click();
      const dialog = page.getByRole("dialog", { name: "Review Hades" });
      await dialog.getByRole("spinbutton", { name: "Rating" }).fill("1");
      await dialog.getByRole("button", { name: "Cancel" }).click();
      await expect(dialog).toBeHidden();
      expect((await json(await api.get(`/review/${g._id}`))).Data.rating).toBe(6);
    });
  });

  test.describe("collections", () => {
    test("adds the game to a collection and removes it via the tag @positive", async ({ authedPage: page, api }) => {
      await api.addGame(hades);
      const c = await api.createCollection("Roguelikes");
      // Collections are loaded by the Library page (shared context), so arrive the way a user does.
      await open(page, "/");
      await page.getByRole("paragraph").filter({ hasText: /^Hades$/ }).click();
      await expect(page.getByRole("heading", { name: "Your Library" })).toBeVisible();

      await page.getByRole("button", { name: "Add To Collection" }).click();
      await page.getByRole("menuitem", { name: "Roguelikes" }).click();
      await expect(page.getByText("Collections (1)")).toBeVisible();
      await expect.poll(async () => (await json(await api.get(`/collection/${c._id}`))).Data.gameIds.length).toBe(1);

      await page.getByRole("list").filter({ hasText: "Roguelikes" }).getByRole("button", { name: "close" }).click();
      await expect(page.getByText("Collections (0)")).toBeVisible();
      await expect.poll(async () => (await json(await api.get(`/collection/${c._id}`))).Data.gameIds.length).toBe(0);
    });

    test("opening a game directly still offers the user's collections @negative", async ({ authedPage: page, api }) => {
      await api.addGame(hades);
      await api.createCollection("Roguelikes");
      await open(page, `/library/game/${hades.id}`);
      await page.getByRole("button", { name: "Add To Collection" }).click();
      await expect(page.getByRole("menuitem", { name: "Roguelikes" })).toBeVisible({ timeout: 3000 });
    });

    test("offers nothing to add when the game is already in every collection @negative", async ({ authedPage: page, api }) => {
      const g = await api.addGame(hades);
      const c = await api.createCollection("Only one");
      await api.post(`/collection/${c._id}/games`, { gameId: g._id });
      await open(page, "/");
      await page.getByRole("paragraph").filter({ hasText: /^Hades$/ }).first().click();
      await expect(page.getByText("Collections (1)")).toBeVisible();
      await page.getByRole("button", { name: "Add To Collection" }).click();
      await expect(page.getByRole("menuitem", { name: "Already in all collections" })).toBeDisabled();
    });
  });

  test.describe("notes", () => {
    test("adds and deletes a note @positive", async ({ authedPage: page, api }) => {
      const g = await api.addGame(hades);
      await open(page, `/library/game/${hades.id}`);
      const box = page.getByPlaceholder("Jot down a strategy, reminder, or anything else about this game...");
      await box.fill("Dash-strike Theseus");
      await page.getByRole("button", { name: "Add Note" }).click();
      await expect(page.getByText("Dash-strike Theseus")).toBeVisible();
      await expect(box).toHaveValue("");
      expect((await json(await api.get(`/notes/${g._id}`))).Data).toHaveLength(1);

      await page.getByRole("button", { name: "Delete note" }).click();
      await expect(page.getByText("Dash-strike Theseus")).toHaveCount(0);
      await expect.poll(async () => (await json(await api.get(`/notes/${g._id}`))).Data).toEqual([]);
    });

    test("'Add Note' is disabled for blank input @negative", async ({ authedPage: page, api }) => {
      await api.addGame(hades);
      await open(page, `/library/game/${hades.id}`);
      const add = page.getByRole("button", { name: "Add Note" });
      await expect(add).toBeDisabled();
      await page.getByPlaceholder(/Jot down a strategy/).fill("     ");
      await expect(add).toBeDisabled();
    });

    test("the notes section is hidden for games not in the library @negative", async ({ authedPage: page }) => {
      await open(page, `/library/game/${byName("Elden Ring").id}`);
      await expect(page.getByRole("heading", { name: "Not In Library" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Notes" })).toHaveCount(0);
    });
  });

  test("removes the game from the library @positive", async ({ authedPage: page, api }) => {
    await api.addGame(hades);
    await open(page, `/library/game/${hades.id}`);
    await page.getByRole("button", { name: "Remove From Library" }).click();
    await page.getByRole("alertdialog", { name: "Remove Hades from your library?" }).getByRole("button", { name: "Remove" }).click();
    await expectToast(page, "Game Removed", "Game has been removed from library.");
    await expect(page).toHaveURL(/#\/$/);
    expect((await json(await api.get("/game"))).Data).toEqual([]);
  });

  test("asks for confirmation before removing a game @negative", async ({ authedPage: page, api }) => {
    await api.addGame(hades);
    await open(page, `/library/game/${hades.id}`);
    await page.getByRole("button", { name: "Remove From Library" }).click();
    const confirm = page.getByRole("alertdialog", { name: "Remove Hades from your library?" });
    await expect(confirm).toContainText("This action cannot be undone.");
    // Nothing is deleted until the user confirms.
    expect((await json(await api.get("/game"))).Data).toHaveLength(1);
  });

  test("cancelling removal keeps the game @negative", async ({ authedPage: page, api }) => {
    await api.addGame(hades);
    await open(page, `/library/game/${hades.id}`);
    await page.getByRole("button", { name: "Remove From Library" }).click();
    await page.getByRole("alertdialog", { name: "Remove Hades from your library?" }).getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("heading", { name: "Your Library" })).toBeVisible();
    expect((await json(await api.get("/game"))).Data).toHaveLength(1);
  });

  test("'Back' returns to the previous page @positive", async ({ authedPage: page, api }) => {
    await api.addGame(hades);
    await open(page, "/library/browse");
    await open(page, `/library/game/${hades.id}`);
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await expect(page).toHaveURL(/#\/library\/browse$/);
  });
});
