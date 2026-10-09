import { Page, expect } from "@playwright/test";

/** The app uses HashRouter (for Electron's file://), so routes live after "#". */
export const route = (path: string) => `/#${path.startsWith("/") ? path : `/${path}`}`;

export async function open(page: Page, path: string) {
  await page.goto(route(path));
}

export const toast = (page: Page, title: string | RegExp) =>
  page.getByRole("status").filter({ hasText: title }).first();

export async function expectToast(page: Page, title: string | RegExp, description?: string | RegExp) {
  const t = toast(page, title);
  await expect(t).toBeVisible();
  if (description) await expect(t).toContainText(description);
}

export async function fillLogin(page: Page, username: string, password: string, rememberMe = false) {
  await page.getByRole("textbox", { name: "Username" }).fill(username);
  await page.getByRole("textbox", { name: "Password" }).fill(password);
  if (rememberMe) await page.getByText("Remember me").click();
  await page.getByRole("button", { name: "Login" }).click();
}

/** A library card: scoped by the card's visible title. */
export const card = (page: Page, title: string) =>
  page.locator("div").filter({ has: page.getByRole("paragraph").filter({ hasText: new RegExp(`^${title}$`) }) }).filter({ has: page.getByRole("button", { name: "Launch" }) }).last();

/** The top navigation bar (a modal header is also a "banner", so scope by content). */
export const navbar = (page: Page) =>
  page.getByRole("banner").filter({ has: page.getByRole("button", { name: "Dashboard" }) });

/** The floating quick-access button that opens the AI assistant modal. */
export const assistantButton = (page: Page) => page.getByRole("button", { name: "Open AI Assistant" });

/** The AI assistant modal. */
export const assistant = (page: Page) => page.getByRole("dialog", { name: "AI Assistant" });

/**
 * Make the next page load behave like the Electron desktop app: a stand-in
 * `window.electronAPI` that records launches instead of starting processes.
 * Launch, Running and Rescan controls only exist in the desktop shell.
 */
export async function emulateDesktop(page: Page, opts: { exePath?: string | null } = {}) {
  const exePath = opts.exePath === undefined ? "C:\\Games\\Game.exe" : opts.exePath;
  await page.addInitScript((picked) => {
    const w = window as any;
    w.__launched = [];
    w.electronAPI = {
      selectExePath: async () => picked,
      launchGame: async (gameId: string, path: string) => {
        w.__launched.push({ gameId, path });
        return true;
      },
      scanEpicGames: async () => [],
      scanSteamGames: async () => [],
      onGameExited: (cb: (gameId: string) => void) => {
        w.__exitGame = cb;
        return () => {};
      },
      epicLogin: async () => null,
      steamLogin: async () => null,
    };
  }, exePath);
}
