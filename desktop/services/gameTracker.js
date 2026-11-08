// desktop/services/gameTracker.js
//
// Decides whether a launched game is still running, so its play session ends when the game does.
//
// The old way tracked the game's exe name plus EVERY program that started in the 20 seconds after
// launch, and kept the session open until all of them had closed. Unrelated programs (an Office
// helper, a browser update) got swept in, so a session ran on long after the game was quit: a 30
// minute God of War session was saved as 43 minutes.
//
// Now a game is "running" while a program from the game's own folder is running:
// - launched from an .exe: that exe's folder (and its subfolders, e.g. Binaries\Win64)
// - launched through Steam/Epic (a URI): the folder of the first new program that starts inside a
//   Steam library (steamapps\common\<game>) or an Epic games folder
// The session ends at the time the game was LAST SEEN, not when a check noticed it was gone.

const path = require("node:path");
const { execFile } = require("node:child_process");

/** Missed checks in a row before a game counts as closed: a game restarting itself isn't a quit. */
const MISSES_TO_CLOSE = 2;
/** A game that never showed up (failed to start, or a store launch we couldn't find) stops being watched. */
const NEVER_SEEN_MS = 10 * 60 * 1000;

const STORE_GAME_FOLDER = [
  /^(.*\\steamapps\\common\\[^\\]+\\)/i,
  /^(.*\\epic games\\(?!launcher\\)[^\\]+\\)/i,
];

const norm = (p) => (p ? path.win32.normalize(p).toLowerCase() : "");
const WINDOWS_DIR = `${norm(process.env.SystemRoot || "C:\\Windows")}\\`;
/**
 * The folder whose programs count as the game. "" for a drive root or the Windows folder: everything
 * there would count as the game (explorer.exe is in C:\Windows), so those match by exe name only.
 */
const folderOf = (p) => {
  const dir = path.win32.dirname(norm(p));
  const withSep = dir.endsWith("\\") ? dir : `${dir}\\`;
  if (/^[a-z]:\\$/.test(withSep) || withSep.startsWith(WINDOWS_DIR)) return "";
  return withSep;
};

/** Every running program as { name, path } (lowercase; path is "" when Windows won't say, e.g. elevated ones). */
function listProcesses() {
  return new Promise((resolve) => {
    execFile(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "Get-CimInstance Win32_Process | ForEach-Object { \"$($_.Name)|$($_.ExecutablePath)\" }",
      ],
      { windowsHide: true, maxBuffer: 16 * 1024 * 1024 },
      (error, stdout) => {
        if (error) return resolve(null); // unknown: never treated as "the game closed"
        resolve(
          stdout
            .split(/\r?\n/)
            .filter(Boolean)
            .map((line) => {
              const [name, exe] = line.split("|");
              return { name: (name || "").trim().toLowerCase(), path: norm((exe || "").trim()) };
            }),
        );
      },
    );
  });
}

/** Tracking state for one launch. `before` is the process list just before launching. */
function createTracking(exePath, before, now = Date.now()) {
  const isUri = exePath.includes("://");
  return {
    isUri,
    exeName: isUri ? "" : path.win32.basename(exePath).toLowerCase(),
    gameDir: isUri ? "" : folderOf(exePath),
    beforePaths: new Set((before || []).map((p) => p.path).filter(Boolean)),
    startedAt: now,
    lastSeen: now,
    seen: false,
    misses: 0,
  };
}

/** For a store launch: the game's folder, from the first new program inside a Steam/Epic game folder. */
function findStoreFolder(tracking, processes) {
  for (const proc of processes) {
    if (!proc.path || tracking.beforePaths.has(proc.path)) continue;
    for (const pattern of STORE_GAME_FOLDER) {
      const match = proc.path.match(pattern);
      if (match) return match[1];
    }
  }
  return "";
}

const belongsToGame = (tracking, proc) =>
  (tracking.gameDir && proc.path && proc.path.startsWith(tracking.gameDir)) ||
  // Windows hides the path of programs running as administrator, and a game with no usable folder
  // (see folderOf) has only its name: the exe name still identifies the game.
  (tracking.exeName && proc.name === tracking.exeName && (!proc.path || !tracking.gameDir));

/**
 * One check. Returns "running", "waiting" (not seen yet, or missed once) or "closed".
 * `processes` null means the list couldn't be read: nothing changes.
 */
function check(tracking, processes, now = Date.now()) {
  if (!processes) return tracking.seen ? "running" : "waiting";
  if (!tracking.gameDir && tracking.isUri) tracking.gameDir = findStoreFolder(tracking, processes);

  if (processes.some((proc) => belongsToGame(tracking, proc))) {
    tracking.seen = true;
    tracking.misses = 0;
    tracking.lastSeen = now;
    return "running";
  }
  if (tracking.seen) {
    tracking.misses += 1;
    return tracking.misses >= MISSES_TO_CLOSE ? "closed" : "waiting";
  }
  return now - tracking.startedAt >= NEVER_SEEN_MS ? "closed" : "waiting";
}

module.exports = { listProcesses, createTracking, check, MISSES_TO_CLOSE, NEVER_SEEN_MS };
