// desktop/services/gamePage.js
const { app, net, shell } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const { spawn, exec } = require("node:child_process");

const EPIC_LIBRARY_LINK = "com.epicgames.launcher://library";
const EPIC_STORE_GRAPHQL = "https://store.epicgames.com/graphql";
const EPIC_SLUG_QUERY = 'query($ns:String!){Catalog{catalogNs(namespace:$ns){mappings(pageType:"productHome"){pageSlug}}}}';
const EPIC_SLUG_TIMEOUT_MS = 8000;
const SAFE_ID = /^[\w.~-]+$/;
const epicSlugs = new Map();

// Epic's catalog doesn't give a game's store address, and it can't be guessed ("pubg-59c1d9").
// Through Electron's network stack: Epic's bot protection refuses plain Node requests.
async function findEpicSlug(namespace) {
  if (epicSlugs.has(namespace)) return epicSlugs.get(namespace);
  try {
    const response = await net.fetch(EPIC_STORE_GRAPHQL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: EPIC_SLUG_QUERY, variables: { ns: namespace } }),
      signal: AbortSignal.timeout(EPIC_SLUG_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = await response.json();
    const slug = body?.data?.Catalog?.catalogNs?.mappings?.[0]?.pageSlug;
    if (typeof slug !== "string" || !SAFE_ID.test(slug)) return null;
    epicSlugs.set(namespace, slug);
    return slug;
  } catch (err) {
    console.warn("[open-game-page] Couldn't find the store page:", namespace, err.message);
    return null;
  }
}

// Built here from checked ids, because openExternal will run whatever it's given.
async function gamePageLink(game) {
  const { provider, gameId, namespace } = game ?? {};
  if (provider === "steam") {
    return typeof gameId === "string" && /^\d+$/.test(gameId) ? `steam://nav/games/details/${gameId}` : null;
  }
  if (provider === "epic") {
    const slug = typeof namespace === "string" && SAFE_ID.test(namespace) ? await findEpicSlug(namespace) : null;
    return slug ? `com.epicgames.launcher://store/p/${slug}` : EPIC_LIBRARY_LINK;
  }
  return null;
}

const EPIC_PROCESS = "epicgameslauncher.exe";
const EPIC_SIGN_IN_WAIT_SECONDS = 60;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function getEpicLauncherPath() {
  return new Promise((resolve) => {
    exec('reg query "HKCR\\com.epicgames.launcher\\shell\\open\\command" /ve', (error, stdout) => {
      resolve(error ? null : stdout.match(/"([^"]+EpicGamesLauncher\.exe)"/i)?.[1] ?? null);
    });
  });
}

// A link sent before Epic has signed in is dropped. A log from before this start doesn't count;
// if the line never comes (say, signed out), Epic gets the link anyway and we've lost nothing.
async function waitForEpicSignIn(startedAt) {
  const log = path.join(process.env.LOCALAPPDATA || "", "EpicGamesLauncher", "Saved", "Logs", "EpicGamesLauncher.log");
  for (let waited = 0; waited < EPIC_SIGN_IN_WAIT_SECONDS; waited++) {
    await sleep(1000);
    try {
      const { mtimeMs } = await fs.promises.stat(log);
      if (mtimeMs > startedAt && (await fs.promises.readFile(log, "latin1")).includes("OnSignIn")) {
        await sleep(2000);
        return;
      }
    } catch {
      // No log yet.
    }
  }
}

// Epic links do nothing while its launcher is closed, so start it and send the link once it's ready.
// False if it was already running, or can't be started here.
async function openEpicLinkOnceStarted(uri, getProcessList) {
  if ((await getProcessList()).includes(EPIC_PROCESS)) return false;
  const exe = await getEpicLauncherPath();
  if (!exe) return false;

  const startedAt = Date.now();
  const launcher = spawn(exe, [], { detached: true, stdio: "ignore" });
  launcher.on("error", (err) => console.warn("[open-game-page] Epic didn't start:", err.message));
  launcher.unref();

  waitForEpicSignIn(startedAt)
    .then(() => shell.openExternal(uri))
    .catch((err) => console.warn("[open-game-page] Failed:", uri, err.message));
  return true;
}

// Separate from launching, which starts tracking a play session.
async function openGamePage(game, getProcessList) {
  const uri = await gamePageLink(game);
  if (!uri) {
    console.warn("[open-game-page] Refused:", game);
    return false;
  }
  // With no launcher to handle the link, Windows asks "which app?" and openExternal still succeeds.
  if (!app.getApplicationNameForProtocol(uri)) {
    console.warn("[open-game-page] No app handles:", uri);
    return false;
  }
  try {
    if (uri.startsWith("com.epicgames.launcher://") && (await openEpicLinkOnceStarted(uri, getProcessList))) return true;
    await shell.openExternal(uri);
    return true;
  } catch (err) {
    console.warn("[open-game-page] Failed:", uri, err.message);
    return false;
  }
}

module.exports = { openGamePage };
