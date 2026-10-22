// desktop/services/updates.js
//
// Automatic updates, so a fix reaches friends without sending a new installer.
//
//   release.json (next to main.js, written at build time, never committed):
//     { "updateUrl": "https://<where the release files are hosted>/" }
//
// Each release uploads three files from desktop/dist to that address: latest.yml,
// "RoninArc Setup <version>.exe" and its .blockmap. Any static host works (Cloudflare R2,
// a GitHub release, ...). The app checks a little after launch and every few hours,
// downloads a newer version in the background, and asks before restarting into it.

const fs = require("node:fs");
const path = require("node:path");

const FIRST_CHECK_MS = 15_000;
const CHECK_EVERY_MS = 4 * 60 * 60 * 1000;

function loadReleaseConfig(dir) {
  try {
    const config = JSON.parse(fs.readFileSync(path.join(dir, "release.json"), "utf8"));
    return typeof config.updateUrl === "string" && /^https?:\/\//.test(config.updateUrl) ? { updateUrl: config.updateUrl } : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Starts update checks for a packaged build with a release.json. Returns `status()` and
 * `check()` for Settings; both report "disabled" when updates aren't set up.
 */
function setupUpdates({ app, dir, log = () => {}, askToRestart, updaterImpl }) {
  const config = loadReleaseConfig(dir);
  if (!app.isPackaged || !config) {
    log("updates: off", !app.isPackaged ? "(not packaged)" : "(no release.json in this build)");
    const off = async () => ({ state: "disabled", current: app.getVersion() });
    return { status: off, check: off, install: () => false };
  }

  const updater = updaterImpl ?? require("electron-updater").autoUpdater;
  updater.setFeedURL({ provider: "generic", url: config.updateUrl });
  updater.autoDownload = true;
  updater.autoInstallOnAppQuit = true;
  updater.logger = { info: (m) => log("updates:", m), warn: (m) => log("updates: warn", m), error: (m) => log("updates: error", m), debug: () => {} };

  let state = { state: "idle", current: app.getVersion() };
  const set = (next) => {
    state = { ...next, current: app.getVersion() };
    log("updates: state", JSON.stringify(state));
  };

  updater.on("checking-for-update", () => set({ state: "checking" }));
  updater.on("update-not-available", () => set({ state: "up-to-date" }));
  updater.on("update-available", (info) => set({ state: "downloading", version: info?.version }));
  updater.on("download-progress", (p) => set({ state: "downloading", version: state.version, percent: Math.round(p?.percent ?? 0) }));
  updater.on("error", (err) => set({ state: "error", message: err?.message ? String(err.message).slice(0, 200) : "Update check failed." }));
  updater.on("update-downloaded", async (info) => {
    set({ state: "ready", version: info?.version });
    // Restart now, or let it install on the next quit (autoInstallOnAppQuit).
    if (askToRestart && (await askToRestart(info?.version))) updater.quitAndInstall();
  });

  const check = async () => {
    if (state.state === "downloading" || state.state === "ready") return state;
    try {
      await updater.checkForUpdates();
    } catch (err) {
      set({ state: "error", message: err?.message ? String(err.message).slice(0, 200) : "Update check failed." });
    }
    return state;
  };

  setTimeout(check, FIRST_CHECK_MS);
  setInterval(check, CHECK_EVERY_MS);
  /** Restart into a downloaded update (Settings, for anyone who chose "Later"). */
  const install = () => {
    if (state.state !== "ready") return false;
    updater.quitAndInstall();
    return true;
  };

  return { status: async () => state, check, install };
}

module.exports = { setupUpdates, loadReleaseConfig };
