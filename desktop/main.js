// desktop/main.js
const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("node:path");
const { spawn, exec } = require("node:child_process");
const activeGames = new Map();
const { scanEpicGames } = require("./services/epicScanner");
const { scanSteamGames } = require("./services/steamScanner");

const DEV_SERVER_URL = "http://localhost:5173";
const isDev = !app.isPackaged;

function createMainWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 1024,
    minHeight: 600,
    title: "RoninArc",
    menuBarVisible: false,
    autoHideMenuBar: true,
    icon: path.join(__dirname, "build", "icon.ico"),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  if (isDev) {
    win.loadURL(DEV_SERVER_URL);
  } else {
    const indexHtml = path.join(__dirname, "frontend", "index.html");
    win.loadFile(indexHtml);
  }
  if (isDev) {
    win.loadURL(DEV_SERVER_URL);
    win.webContents.openDevTools();
  }
}

ipcMain.handle("select-exe-path", async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: "Select game executable",
    properties: ["openFile"],
    filters: [{ name: "Executable", extensions: ["exe"] }],
  });

  if (canceled || !filePaths || filePaths.length === 0) {
    return null;
  }

  return filePaths[0];
});
function getProcessList() {
  return new Promise((resolve) => {
    exec("tasklist /fo csv /nh", (error, stdout) => {
      if (error) {
        resolve([]);
        return;
      }

      const processes = stdout
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const parts = line.replaceAll('"', "").split(",");
          return parts[0]?.toLowerCase();
        });

      resolve(processes);
    });
  });
}

function getNewProcesses(before, after) {
  const beforeSet = new Set(before);

  return after.filter((process) => !beforeSet.has(process));
}
ipcMain.handle("launch-game", async (event, gameId, exePath) => {
  try {
    console.log("[launch-game] Requested exePath:", exePath);

    const exeDir = path.dirname(exePath);
    const exeName = path.basename(exePath);

    console.log("[launch-game] Using cwd:", exeDir);

    const beforeProcesses = await getProcessList();

    const child = spawn("cmd.exe", ["/c", "start", '""', `"${exePath}"`], {
      cwd: exeDir,
      windowsVerbatimArguments: true,
      detached: true,
    });

    console.log("[launch-game] pid:", child.pid);

    activeGames.set(gameId, {
      processes: exeName ? [exeName] : [],
    });

    console.log("[Initial Tracking]", exeName);

    console.log("[Rykard Tracking]", exeName);

    const discoveredProcesses = new Set();

    let checks = 0;

    const discoveryInterval = setInterval(async () => {
      checks++;

      const currentProcesses = await getProcessList();

      const newProcesses = getNewProcesses(beforeProcesses, currentProcesses);

      const gameProcesses = newProcesses.filter(
        (process) =>
          typeof process === "string" &&
          process.endsWith(".exe") &&
          !process.includes("crash") &&
          !process.includes("search") &&
          !process.includes("docker") &&
          !process.includes("overlay") &&
          !process.includes("service") &&
          !process.includes("gamebar") &&
          !process.includes("launcher"),
      );

      gameProcesses.forEach((process) => discoveredProcesses.add(process));

      console.log(`[Rykard Discovery ${checks}/20]`);

      console.log([...discoveredProcesses]);

      if (checks >= 20) {
        clearInterval(discoveryInterval);

        const existing = activeGames.get(gameId);

        if (!existing) {
          return;
        }

        const finalProcesses = [
          ...(existing.processes || []),
          ...discoveredProcesses,
        ];

        activeGames.set(gameId, {
          processes: [...new Set(finalProcesses)],
        });

        console.log("[Rykard Final Tracking]");

        console.log(activeGames.get(gameId));
      }
    }, 1000);

    console.log("[launch-game] spawn() called successfully");

    return true;
  } catch (err) {
    console.error("[launch-game] top-level error:", err);

    return false;
  }
});

app.whenReady().then(() => {
  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

setInterval(() => {
  if (activeGames.size === 0) {
    return;
  }

  exec("tasklist", (error, stdout) => {
    if (error) {
      return;
    }

    activeGames.forEach((game, gameId) => {
      console.log(`[Rykard Check] ${new Date().toLocaleTimeString()}`);

      console.log("[Rykard Tracking]", game.processes);

      const running =
        Array.isArray(game.processes) &&
        game.processes.some(
          (processName) =>
            typeof processName === "string" &&
            processName.length > 0 &&
            stdout.toLowerCase().includes(processName.toLowerCase()),
        );

      console.log(`[Rykard] running = ${running}`);

      const hasRealProcess = game.processes.some((p) => p.endsWith(".exe"));

      if (!running && hasRealProcess) {
        console.log("[Rykard] Game closed");

        activeGames.delete(gameId);

        BrowserWindow.getAllWindows()[0]?.webContents.send(
          "game-exited",
          gameId,
        );
      }
    });
  });
}, 5000);

ipcMain.handle("epic:scan", async () => {
  return scanEpicGames();
});
ipcMain.handle("steam:scan", async () => {
  return scanSteamGames();
});

// ── Epic OAuth: BrowserWindow-based code extraction ──────────────────────
//
// Epic's OAuth flow:
//   1. User visits login URL.
//   2. After successful login, Epic redirects to:
//        https://www.epicgames.com/id/api/redirect?clientId=...&responseType=code
//      This page returns a JSON document of the form:
//        { "redirectUrl": "...", "authorizationCode": "abc123..." }
//      The code may be in the URL as a query param OR only in the JSON body.
//
// Extraction strategy (in priority order):
//   Layer 1 – URL query param ("code" or "authorizationCode") from any navigation/redirect event.
//   Layer 2 – JSON body scrape via executeJavaScript once the page finishes loading.
//   Layer 3 – 10-minute hard timeout → return null (treated as cancellation by renderer).

ipcMain.handle("epic:login", async (_event, loginUrl) => {
  return new Promise((resolve) => {
    const TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

    // ── Helper: extract code from a URL string ─────────────────────────
    function extractCodeFromUrl(urlString) {
      try {
        const u      = new URL(urlString);
        const code   = u.searchParams.get("authorizationCode") || u.searchParams.get("code");
        const sid    = u.searchParams.get("sid"); // Epic sometimes uses "sid" as the code
        return code || sid || null;
      } catch {
        return null;
      }
    }

    // ── Helper: is this URL Epic's redirect endpoint? ──────────────────
    function isRedirectPage(urlString) {
      try {
        const u = new URL(urlString);
        return (
          u.hostname === "www.epicgames.com" &&
          u.pathname.startsWith("/id/api/redirect")
        );
      } catch {
        return false;
      }
    }

    let settled = false;

    function settle(result) {
      if (settled) return;
      settled = true;
      clearTimeout(hardTimeout);
      if (authWindow && !authWindow.isDestroyed()) {
        authWindow.close();
      }
      resolve(result);
    }

    // ── Hard timeout ───────────────────────────────────────────────────
    const hardTimeout = setTimeout(() => {
      settle(null); // null → renderer treats as cancellation
    }, TIMEOUT_MS);

    // ── Child BrowserWindow ────────────────────────────────────────────
    const authWindow = new BrowserWindow({
      width:  560,
      height: 700,
      title:  "Epic Games — Sign In",
      show:   true,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration:  false,
        // Do NOT attach a preload — this is an external OAuth window.
      },
    });

    // Prevent the auth window from being embedded in the main window
    authWindow.setParentWindow(BrowserWindow.getAllWindows()[0] ?? null);

    authWindow.loadURL(loginUrl);

    // ── Layer 1: URL param extraction on any navigation/redirect event ─
    function handleNavigation(url) {
      if (!url || settled) return;

      // Code in the URL of the redirect endpoint
      if (isRedirectPage(url)) {
        const code = extractCodeFromUrl(url);
        if (code) {
          settle(code);
          return;
        }
        // URL is the redirect page but code is not in URL params —
        // fall through to Layer 2 (body scrape) triggered by did-navigate.
      }
    }

    authWindow.webContents.on("will-navigate", (_e, url) => handleNavigation(url));
    authWindow.webContents.on("will-redirect", (_e, url) => handleNavigation(url));
    authWindow.webContents.on("did-navigate",  (_e, url) => {
      handleNavigation(url);

      // ── Layer 2: JSON body scrape ─────────────────────────────────
      // Triggered whenever the page finishes navigation. If we are on
      // the redirect page and Layer 1 didn't fire, scrape the body.
      if (!settled && isRedirectPage(url)) {
        authWindow.webContents
          .executeJavaScript(
            `(function() {
              try {
                var body = document.body && document.body.innerText;
                if (!body) return null;
                var parsed = JSON.parse(body.trim());
                return parsed.authorizationCode || parsed.code || parsed.sid || null;
              } catch(e) { return null; }
            })()`
          )
          .then((code) => {
            if (code && typeof code === "string" && code.length >= 20) {
              settle(code);
            }
          })
          .catch(() => {/* scrape failed, keep waiting */});
      }
    });

    // did-finish-load is an additional scrape trigger (handles SPA-style navigation)
    authWindow.webContents.on("did-finish-load", () => {
      if (settled) return;
      const url = authWindow.webContents.getURL();
      if (isRedirectPage(url)) {
        authWindow.webContents
          .executeJavaScript(
            `(function() {
              try {
                var body = document.body && document.body.innerText;
                if (!body) return null;
                var parsed = JSON.parse(body.trim());
                return parsed.authorizationCode || parsed.code || parsed.sid || null;
              } catch(e) { return null; }
            })()`
          )
          .then((code) => {
            if (code && typeof code === "string" && code.length >= 20) {
              settle(code);
            }
          })
          .catch(() => {});
      }
    });

    // ── User closed the window manually ───────────────────────────────
    authWindow.on("closed", () => {
      settle(null); // null → renderer treats as cancellation
    });
  });
});

