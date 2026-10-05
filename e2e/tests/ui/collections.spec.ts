import { test, expect } from "../../fixtures/test";
import { json } from "../../helpers/api";
import { byName } from "../../fixtures/catalog.mjs";
import { expectToast, open } from "../../helpers/ui";

test.describe("Collections", () => {
  test("creates a collection from the library page @positive", async ({ authedPage: page, api }) => {
    await api.addGame(byName("Celeste"));
    await open(page, "/");
    await page.getByRole("button", { name: "+ New Collection" }).click();
    const dialog = page.getByRole("dialog", { name: "Create Collection" });
    await dialog.getByRole("textbox", { name: "Name" }).fill("Soulslikes");
    await dialog.getByRole("textbox", { name: "Description" }).fill("Games that punish me");
    await dialog.getByRole("button", { name: "Create" }).click();

    await expect(dialog).toBeHidden();
    await expect(page.getByRole("heading", { name: "Soulslikes" })).toBeVisible();
    expect((await json(await api.get("/collection"))).Data.map((c: any) => c.name)).toEqual(["Soulslikes"]);
  });

  test("a blank name does not create a collection @negative", async ({ authedPage: page, api }) => {
    await api.addGame(byName("Celeste"));
    await open(page, "/");
    await page.getByRole("button", { name: "+ New Collection" }).click();
    const dialog = page.getByRole("dialog", { name: "Create Collection" });
    await dialog.getByRole("textbox", { name: "Name" }).fill("   ");
    await dialog.getByRole("button", { name: "Create" }).click();
    await page.waitForTimeout(500);
    expect((await json(await api.get("/collection"))).Data).toEqual([]);
  });

  test("cancelling the dialog creates nothing @negative", async ({ authedPage: page, api }) => {
    await api.addGame(byName("Celeste"));
    await open(page, "/");
    await page.getByRole("button", { name: "+ New Collection" }).click();
    const dialog = page.getByRole("dialog", { name: "Create Collection" });
    await dialog.getByRole("textbox", { name: "Name" }).fill("Never mind");
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
    expect((await json(await api.get("/collection"))).Data).toEqual([]);
  });

  test.describe("collection page", () => {
    test("opens from the library and shows its games and stats @positive", async ({ authedPage: page, api }) => {
      const g = await api.addGame(byName("Hades"), { progressStatus: "playing" });
      const c = await api.createCollection("Roguelikes");
      await api.post(`/collection/${c._id}/games`, { gameId: g._id });

      await open(page, "/");
      await page.getByRole("heading", { name: "Roguelikes" }).click();
      await expect(page).toHaveURL(new RegExp(`#/collections/${c._id}$`));
      const header = page.locator("div").filter({ has: page.getByRole("heading", { name: "Roguelikes" }) }).filter({ hasText: "Installed" }).last();
      await expect(header).toContainText(/1\s*Games\s*0\s*Completed\s*1\s*Playing\s*0\s*Installed/);
      await expect(page.getByRole("img", { name: "Hades" })).toBeVisible();
    });

    test("renames a collection @positive", async ({ authedPage: page, api }) => {
      const c = await api.createCollection("Old name");
      await open(page, `/collections/${c._id}`);
      await page.getByRole("button", { name: "Edit", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "Edit Collection" });
      await dialog.getByRole("textbox", { name: "Name" }).fill("New name");
      await dialog.getByRole("textbox", { name: "Description" }).fill("Updated");
      await dialog.getByRole("button", { name: "Save Changes" }).click();
      await expect(page.getByRole("heading", { name: "New name" })).toBeVisible();
      expect((await json(await api.get(`/collection/${c._id}`))).Data).toMatchObject({ name: "New name", description: "Updated" });
    });

    test("renaming to an existing collection's name is refused @negative", async ({ authedPage: page, api }) => {
      await api.createCollection("Taken");
      const c = await api.createCollection("Mine");
      await open(page, `/collections/${c._id}`);
      await page.getByRole("button", { name: "Edit", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "Edit Collection" });
      await dialog.getByRole("textbox", { name: "Name" }).fill("Taken");
      await dialog.getByRole("button", { name: "Save Changes" }).click();
      await expect(dialog).toBeVisible();
      await page.waitForTimeout(500);
      expect((await json(await api.get(`/collection/${c._id}`))).Data.name).toBe("Mine");
    });

    test("a refused rename tells the user why @negative", async ({ authedPage: page, api }) => {
      await api.createCollection("Taken");
      const c = await api.createCollection("Mine");
      await open(page, `/collections/${c._id}`);
      await page.getByRole("button", { name: "Edit", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "Edit Collection" });
      await dialog.getByRole("textbox", { name: "Name" }).fill("Taken");
      await dialog.getByRole("button", { name: "Save Changes" }).click();
      await expectToast(page, "Couldn't update collection", "Collection with this name already exists");
      await expect(dialog).toBeVisible();
    });

    test("removes a game from the collection but keeps it in the library @positive", async ({ authedPage: page, api }) => {
      const g = await api.addGame(byName("Hades"));
      const c = await api.createCollection("Roguelikes");
      await api.post(`/collection/${c._id}/games`, { gameId: g._id });
      await open(page, `/collections/${c._id}`);
      await page.getByRole("button", { name: "Remove From Collection" }).click();
      await expect(page.getByRole("img", { name: "Hades" })).toHaveCount(0);
      await expect.poll(async () => (await json(await api.get(`/collection/${c._id}`))).Data.gameIds).toEqual([]);
      expect((await api.get(`/game/${g._id}`)).status()).toBe(200);
    });

    test("filters the collection's games @positive", async ({ authedPage: page, api }) => {
      const a = await api.addGame(byName("Hades"), { progressStatus: "playing" });
      const b = await api.addGame(byName("Celeste"), { progressStatus: "completed" });
      const c = await api.createCollection("Mixed");
      await api.post(`/collection/${c._id}/games`, { gameId: a._id });
      await api.post(`/collection/${c._id}/games`, { gameId: b._id });
      await open(page, `/collections/${c._id}`);
      await page.getByRole("combobox").selectOption({ label: "Completed" });
      await expect(page.getByRole("img", { name: "Celeste" })).toBeVisible();
      await expect(page.getByRole("img", { name: "Hades" })).toHaveCount(0);
    });

    test("deletes the collection after confirmation @positive", async ({ authedPage: page, api }) => {
      const c = await api.createCollection("Doomed");
      await open(page, `/collections/${c._id}`);
      await page.getByRole("button", { name: "Delete", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "Delete Collection" });
      await expect(dialog).toContainText('Are you sure you want to delete "Doomed"?');
      await dialog.getByRole("button", { name: "Delete Collection" }).click();
      await expect(page).toHaveURL(/#\/$/);
      expect((await api.get(`/collection/${c._id}`)).status()).toBe(404);
    });

    test("cancelling deletion keeps the collection @negative", async ({ authedPage: page, api }) => {
      const c = await api.createCollection("Safe");
      await open(page, `/collections/${c._id}`);
      await page.getByRole("button", { name: "Delete", exact: true }).click();
      await page.getByRole("dialog", { name: "Delete Collection" }).getByRole("button", { name: "Cancel" }).click();
      await expect(page.getByRole("heading", { name: "Safe" })).toBeVisible();
      expect((await api.get(`/collection/${c._id}`)).status()).toBe(200);
    });

    test("a missing collection id does not render a collection @negative", async ({ authedPage: page }) => {
      await open(page, "/collections/64b000000000000000000000");
      await expect(page.getByRole("button", { name: "Edit", exact: true })).toHaveCount(0);
    });
  });
});
