// desktop/services/updates.js
//
// Automatic updates, so a fix reaches friends without sending a new installer.
//
//   release.json (next to main.js, written at build time, never committed), either:
//     { "github": { "owner": "Aadhikrish23", "repo": "RoninArc" } }   GitHub releases (1.0.2 on)
//     { "updateUrl": "https://<where the release files are hosted>/" }  any static host
//
// Each release has latest.yml, RoninArc-Setup-<version>.exe and its .blockmap (see
// docs/beta/RELEASING.md). With GitHub releases, an update downloads only the parts of the
// installer that changed: electron-updater finds the installed version's blockmap in that
// version's own release (download/v<old>/RoninArc-Setup-<old>.exe.blockmap) and compares it with
// the installer copy NSIS keeps in %LOCALAPPDATA%\desktop-updater. A generic "latest/download"
// URL can't do that, because only the newest release's files are reachable there.
// The app checks a little after launch and every few hours, downloads a newer version in the
// background, and asks before restarting into it.

const fs = require("node:fs");
const path = require("node:path");

const FIRST_CHECK_MS = 15_000;
const CHECK_EVERY_MS = 4 * 60 * 60 * 1000;

function readRelease(dir) {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, "release.json"), "utf8"));
  } catch {
    return {};
  }
}

const isUrl = (v) => typeof v === "string" && /^https?:\/\//.test(v);

const isName = (v) => typeof v === "string" && /^[A-Za-z0-9_.-]+$/.test(v);

/** Where updates come from: a GitHub repository's releases, or a generic URL. */
function loadReleaseConfig(dir) {
  const config = readRelease(dir);
  const gh = config.github;
  if (gh && isName(gh.owner) && isName(gh.repo)) return { github: { owner: gh.owner, repo: gh.repo } };
  return isUrl(config.updateUrl) ? { updateUrl: config.updateUrl } : undefined;
}

/** electron-updater's feed for a release config. */
function feedFor(config) {
  return config.github
    ? { provider: "github", owner: config.github.owner, repo: config.github.repo }
    : { provider: "generic", url: config.updateUrl };
}

/** RoninArc Cloud's address (release.json "cloudUrl"): where this PC's library syncs. */
function loadCloudUrl(dir) {
  const config = readRelease(dir);
  return isUrl(config.cloudUrl) ? config.cloudUrl.replace(/\/+$/, "") : undefined;
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
  updater.setFeedURL(feedFor(config));
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

module.exports = { setupUpdates, loadReleaseConfig, loadCloudUrl, feedFor };
