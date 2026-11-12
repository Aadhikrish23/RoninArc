// desktop/services/ipcGuards.js
//
// Checks for everything the renderer can ask the main process to do. Pure functions with no
// Electron import, so they can be unit tested (e2e/tests/api/desktop-ipc-guards.spec.ts).
//
// The renderer is web content. If it were ever compromised (an XSS bug, a bad dependency), the
// IPC handlers in main.js are the only way it could reach the PC, so each one checks who is
// asking (isTrustedSender) and what it is asking for (the validate* functions below).

const fs = require("node:fs");
const path = require("node:path");
const { URL } = require("node:url");

const win = path.win32;

// ── Who is asking ────────────────────────────────────────────────────────

const normalizeFilePath = (p) => win.normalize(p).replace(/\//g, "\\").toLowerCase();

/** Whether a URL is one of the app's own pages (the packaged index.html, or the dev server). */
function isAppUrl(urlString, { devOrigin, indexHtmlPath } = {}) {
  let u;
  try {
    u = new URL(urlString);
  } catch {
    return false;
  }
  if (devOrigin && u.protocol === "http:") {
    try {
      if (u.origin === new URL(devOrigin).origin) return true;
    } catch {
      /* bad devOrigin: not trusted */
    }
  }
  if (indexHtmlPath && u.protocol === "file:") {
    // file://server/share/... is a network path, never ours.
    if (u.host !== "") return false;
    try {
      const decoded = decodeURIComponent(u.pathname);
      const asWindows = decoded.replace(/^\/([A-Za-z]:)/, "$1");
      return normalizeFilePath(asWindows) === normalizeFilePath(indexHtmlPath);
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * An IPC call is trusted when it comes from the main frame of the app's own page. A page that
 * navigated elsewhere, an iframe, another window and a missing frame are all refused.
 */
function isTrustedSender(event, policy = {}) {
  const frame = event && event.senderFrame;
  if (!frame || typeof frame.url !== "string") return false;
  if (frame.parent) return false;
  return isAppUrl(frame.url, policy);
}

/** Whether the main window may navigate to this URL itself (anything else is refused). */
const isAppNavigation = (urlString, policy) => isAppUrl(urlString, policy);

/** Web links the app may open in the user's own browser (game websites, the IGDB credit). Nothing else is opened. */
function isExternalLinkAllowed(urlString) {
  try {
    const u = new URL(urlString);
    return (u.protocol === "https:" || u.protocol === "http:") && !u.username && !u.password;
  } catch {
    return false;
  }
}

// ── What is being asked: game ids and game objects ───────────────────────

const ID_PATTERN = /^[\w.~:@-]{1,200}$/;

/** A game id as the library gives it (a Mongo id, or a store's own id). */
const validateGameId = (value) => typeof value === "string" && ID_PATTERN.test(value);

/** { provider, gameId?, namespace? } for "open this game's store page". */
function validateGamePageRequest(game) {
  if (!game || typeof game !== "object" || Array.isArray(game)) return null;
  const { provider, gameId, namespace } = game;
  if (provider !== "steam" && provider !== "epic") return null;
  for (const v of [gameId, namespace]) {
    if (v !== undefined && v !== null && (typeof v !== "string" || v.length > 200)) return null;
  }
  return { provider, gameId: gameId ?? undefined, namespace: namespace ?? undefined };
}

// ── What is being asked: launching a game ────────────────────────────────

const MAX_PATH_LENGTH = 1024;
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;
/** Cannot be in a Windows file name, so a path holding one is not a real file. */
const NOT_A_FILE_NAME_CHAR = /["<>|*?]/;
/** Special to cmd.exe even inside quotes ("%" expands, "^" and "!" escape), or to a shell generally. */
const SHELL_SPECIAL = /["%^&|<>`!]/;

const STEAM_LINK = /^steam:\/\/(?:rungameid|run)\/\d{1,20}$/;
const EPIC_LINK = /^com\.epicgames\.launcher:\/\/apps\/[A-Za-z0-9._~-]{1,200}(?:\?[A-Za-z0-9=&._~-]{0,200})?$/;

/** exe: started directly. shell: .lnk/.url need Windows' shell to open them. */
const EXTENSIONS = { ".exe": "exe", ".lnk": "shell", ".url": "shell" };

const defaultIsFile = (p) => {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
};

const refuse = (reason) => ({ ok: false, reason });

/** True when the path can go inside `cmd /c start "" "<path>"` without cmd treating any of it as syntax. */
const isSafeForShell = (p) => typeof p === "string" && !SHELL_SPECIAL.test(p) && !CONTROL_CHARS.test(p);

/**
 * What a launch request may start: a Steam or Epic launcher link of the exact shape the app
 * builds, or an existing file at a plain Windows drive path ending in .exe, .lnk or .url.
 * Returns { ok: true, kind: "uri" | "exe" | "shell", target, shellSafe } or { ok: false, reason }.
 */
function validateLaunchTarget(value, { isFile = defaultIsFile } = {}) {
  if (typeof value !== "string") return refuse("not a string");
  if (value.length === 0 || value.length > MAX_PATH_LENGTH) return refuse("empty or too long");
  if (CONTROL_CHARS.test(value)) return refuse("control characters");
  if (value !== value.trim()) return refuse("leading or trailing whitespace");

  // A link: only the two launchers the app knows, in the shapes it builds.
  if (/^[A-Za-z][A-Za-z0-9+.-]*:\/\//.test(value)) {
    if (STEAM_LINK.test(value) || EPIC_LINK.test(value)) return { ok: true, kind: "uri", target: value, shellSafe: false };
    return refuse("link not allowed");
  }

  // A file: a drive path ("D:\Games\x\game.exe"), not a network path, device path or relative path.
  if (!/^[A-Za-z]:[\\/]/.test(value)) return refuse("not an absolute drive path");
  if (NOT_A_FILE_NAME_CHAR.test(value)) return refuse("characters that can't be in a file name");
  if (value.indexOf(":", 2) !== -1) return refuse("stream or device syntax");
  if (value.split(/[\\/]+/).includes("..")) return refuse("parent folder segment");
  const kind = EXTENSIONS[win.extname(value).toLowerCase()];
  if (!kind) return refuse("file type not allowed");
  if (!isFile(value)) return refuse("no such file");

  const shellSafe = isSafeForShell(value);
  // .lnk and .url can only be opened through the shell, so they can't carry its special characters.
  if (kind === "shell" && !shellSafe) return refuse("shell characters in path");
  return { ok: true, kind, target: value, shellSafe };
}

// ── What is being asked: opening a sign-in page ──────────────────────────

const MAX_URL_LENGTH = 2048;
const EPIC_LOGIN_HOSTS = new Set(["www.epicgames.com", "epicgames.com", "accounts.epicgames.com"]);
const STEAM_LOGIN_HOST = "steamcommunity.com";
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);

function parseHttps(urlString) {
  if (typeof urlString !== "string" || urlString.length === 0 || urlString.length > MAX_URL_LENGTH) return null;
  let u;
  try {
    u = new URL(urlString);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" || u.username || u.password) return null;
  if (u.port && u.port !== "443") return null;
  return u;
}

/**
 * The page a provider login window may open. It has to be the provider's own https page, and
 * the address the result comes back to has to be the one the app listens for, or the
 * sign-in could be pointed at someone else's page.
 */
function validateLoginUrl(provider, urlString) {
  const u = parseHttps(urlString);
  if (!u) return refuse("not an https address");
  const host = u.hostname.toLowerCase();

  if (provider === "epic") {
    if (!EPIC_LOGIN_HOSTS.has(host) || !u.pathname.startsWith("/id/")) return refuse("not Epic's sign-in page");
    const back = parseHttps(u.searchParams.get("redirectUrl"));
    if (!back || back.hostname.toLowerCase() !== "www.epicgames.com" || !back.pathname.startsWith("/id/api/redirect")) {
      return refuse("sign-in doesn't return to Epic's redirect page");
    }
    return { ok: true };
  }

  if (provider === "steam") {
    if (host !== STEAM_LOGIN_HOST || u.pathname !== "/openid/login") return refuse("not Steam's sign-in page");
    let back;
    try {
      back = new URL(u.searchParams.get("openid.return_to") ?? "");
    } catch {
      return refuse("no return address");
    }
    if (back.protocol !== "http:" || !LOCAL_HOSTS.has(back.hostname) || back.pathname !== "/provider/steam/oauth/return") {
      return refuse("sign-in doesn't return to this app");
    }
    return { ok: true };
  }

  return refuse("unknown provider");
}

module.exports = {
  isAppUrl,
  isAppNavigation,
  isTrustedSender,
  isExternalLinkAllowed,
  validateGameId,
  validateGamePageRequest,
  validateLaunchTarget,
  isSafeForShell,
  validateLoginUrl,
};
