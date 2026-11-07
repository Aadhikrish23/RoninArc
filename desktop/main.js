// desktop/main.js
const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const { spawn, exec } = require("node:child_process");
const activeGames = new Map();
const { scanEpicGames } = require("./services/epicScanner");
const { scanSteamGames } = require("./services/steamScanner");
const keygate = require("./services/keygate");
const diagnostics = require("./services/diagnostics");
const { setupUpdates, loadCloudUrl } = require("./services/updates");

const DEV_SERVER_URL = "http://localhost:5173";
const isDev = !app.isPackaged;

// ── Single instance lock ──────────────────────────────────────────────────
// Two RoninArc processes both spawning their own embedded mongod against the
// same data directory would corrupt it, so a second launch must never reach
// app.whenReady() at all -- it hands off to the already-running instance
// and quits immediately instead.
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
}

// ── Embedded backend + local database (packaged builds only) ─────────────
// In dev, the backend and its MongoDB are started separately (npm run dev /
// .claude/launch.json) exactly as they always have been -- none of this
// runs unless the app is actually packaged.
const EMBEDDED_MONGO_PORT = 27018;
const BACKEND_PORT = 5000;
// A warm start takes about 3s, but a cold one (first launch after installing, or after a reboot)
// took over 30s reading the backend's 9,000 files: a 20s limit reported that as a failure.
// A process that really dies is reported at once by its exit handler, so this can be generous.
const STARTUP_TIMEOUT_MS = 3 * 60 * 1000;
let mongodProcess = null;
let backendProcess = null;

function resourcePath(...segments) {
  const base = isDev ? __dirname : process.resourcesPath;
  return path.join(base, ...segments);
}

// Packaged GUI-subsystem apps have no visible console, so this is the only
// way to diagnose a "won't start" report from a real installed copy -- kept
// as permanent, minimal startup logging, not a temporary dev hack. Capped
// so it can't grow unbounded across the life of an install.
const DEBUG_LOG_PATH = path.join(app.getPath("userData"), "startup.log");
const MAX_LOG_SIZE_BYTES = 1024 * 1024; // 1MB
function debugLog(...args) {
  const line = `[${new Date().toISOString()}] ${args.join(" ")}\n`;
  try {
    if (fs.existsSync(DEBUG_LOG_PATH) && fs.statSync(DEBUG_LOG_PATH).size > MAX_LOG_SIZE_BYTES) {
      fs.writeFileSync(DEBUG_LOG_PATH, "");
    }
    fs.mkdirSync(path.dirname(DEBUG_LOG_PATH), { recursive: true });
    fs.appendFileSync(DEBUG_LOG_PATH, line);
  } catch {
    // ignore
  }
}

function startEmbeddedMongo() {
  return new Promise((resolve, reject) => {
    const dataDir = path.join(app.getPath("userData"), "mongodb-data");
    fs.mkdirSync(dataDir, { recursive: true });

    const mongodPath = resourcePath("mongodb-bin", "mongod.exe");
    debugLog("startEmbeddedMongo: dataDir=", dataDir, "mongodPath=", mongodPath, "exists=", fs.existsSync(mongodPath));
    mongodProcess = spawn(mongodPath, [
      "--dbpath", dataDir,
      "--port", String(EMBEDDED_MONGO_PORT),
      "--bind_ip", "127.0.0.1",
    ]);
    debugLog("startEmbeddedMongo: spawned, pid=", mongodProcess.pid);

    let settled = false;
    mongodProcess.stdout.on("data", (chunk) => {
      debugLog("[mongod stdout]", chunk.toString().slice(0, 300));
      if (!settled && chunk.toString().includes("Waiting for connections")) {
        settled = true;
        resolve();
      }
    });
    mongodProcess.stderr.on("data", (chunk) => debugLog("[mongod stderr]", chunk.toString().slice(0, 300)));
    mongodProcess.on("error", (err) => {
      debugLog("startEmbeddedMongo: process error", err.message || String(err));
      if (!settled) {
        settled = true;
        reject(err);
      }
    });
    mongodProcess.on("exit", (code) => {
      debugLog("[mongod] exited with code", code);
      mongodProcess = null;
      if (!settled) {
        settled = true;
        reject(new Error(`The database stopped while starting (exit code ${code}).`));
      }
    });

    setTimeout(() => {
      if (!settled) {
        settled = true;
        debugLog(`startEmbeddedMongo: TIMED OUT after ${STARTUP_TIMEOUT_MS / 1000}s`);
        reject(new Error(`The database didn't start within ${STARTUP_TIMEOUT_MS / 60000} minutes.`));
      }
    }, STARTUP_TIMEOUT_MS);
  });
}

// Every packaged install needs its own JWT signing secret -- shipping one
// hardcoded value baked into the installer would let anyone who extracts it
// forge auth tokens for every other install of the app. Generated once on
// first launch and persisted in the OS's per-user app data folder, not in
// the (world-readable, reinstallable) app directory itself.
function getOrCreateJwtSecret() {
  const secretPath = path.join(app.getPath("userData"), "jwt-secret");
  if (fs.existsSync(secretPath)) {
    return fs.readFileSync(secretPath, "utf8").trim();
  }
  const secret = require("node:crypto").randomBytes(48).toString("hex");
  fs.writeFileSync(secretPath, secret, "utf8");
  return secret;
}

/** Online features (search, AI, Steam) go through keygate with this install's own token. */
async function keygateBackendEnv() {
  const config = keygate.loadBuildConfig(__dirname);
  if (!config) {
    debugLog("keygate: no keygate.json in this build; search, AI and Steam sync stay off");
    return {};
  }
  const token = await keygate.ensureToken(app.getPath("userData"), config, { log: debugLog });
  if (!token) debugLog("keygate: no token this launch; search, AI and Steam sync stay off until the next launch");
  return keygate.backendEnv(config, token);
}

function startBackend(extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const backendEntry = resourcePath("backend", "dist", "server.js");
    debugLog("startBackend: backendEntry=", backendEntry, "exists=", fs.existsSync(backendEntry), "execPath=", process.execPath);

    // ELECTRON_RUN_AS_NODE makes Electron's own bundled binary behave as a
    // plain Node runtime for this one child process -- the end user never
    // needs Node.js installed separately.
    backendProcess = spawn(process.execPath, [backendEntry], {
      env: {
        ...process.env,
        ...extraEnv,
        ELECTRON_RUN_AS_NODE: "1",
        ELECTRON_EMBEDDED: "1",
        MONGO_URI: `mongodb://127.0.0.1:${EMBEDDED_MONGO_PORT}/RoninArc`,
        PORT: String(BACKEND_PORT),
        JWT_SECRET: getOrCreateJwtSecret(),
        // Structured JSON logs (offline record) live next to the app data.
        LOG_DIR: path.join(app.getPath("userData"), "logs"),
        NODE_ENV: "production",
      },
    });
    debugLog("startBackend: spawned, pid=", backendProcess.pid);

    let settled = false;
    backendProcess.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      debugLog("[backend stdout]", text.slice(0, 300));
      if (!settled && text.includes("Server is up and running")) {
        settled = true;
        resolve();
      }
    });
    backendProcess.stderr.on("data", (chunk) => debugLog("[backend stderr]", chunk.toString().slice(0, 300)));
    backendProcess.on("error", (err) => {
      debugLog("startBackend: process error", err.message || String(err));
      if (!settled) {
        settled = true;
        reject(err);
      }
    });
    backendProcess.on("exit", (code) => {
      debugLog("[backend] exited with code", code);
      backendProcess = null;
      if (!settled) {
        settled = true;
        reject(new Error(`The backend stopped while starting (exit code ${code}).`));
      }
    });

    setTimeout(() => {
      if (!settled) {
        settled = true;
        debugLog(`startBackend: TIMED OUT after ${STARTUP_TIMEOUT_MS / 1000}s`);
        reject(new Error(`The backend didn't start within ${STARTUP_TIMEOUT_MS / 60000} minutes.`));
      }
    }, STARTUP_TIMEOUT_MS);
  });
}

// Shown from the moment the app opens until the main window has loaded, so a slow cold start
// doesn't look like nothing happened.
function createSplashWindow() {
  const splash = new BrowserWindow({
    width: 420,
    height: 220,
    frame: false,
    resizable: false,
    title: "Starting RoninArc",
    backgroundColor: "#1A202C",
    icon: path.join(__dirname, "build", "icon.ico"),
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Starting RoninArc</title><style>
    html,body{margin:0;height:100%;background:#1A202C;color:#fff;font-family:"Segoe UI",system-ui,sans-serif;-webkit-app-region:drag;user-select:none}
    body{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;border-bottom:4px solid #ff004d;box-sizing:border-box}
    h1{margin:0;font-size:24px;font-weight:700}
    p{margin:0;font-size:13px;color:#A0AEC0;text-align:center;padding:0 28px}
    i{width:26px;height:26px;border-radius:50%;border:3px solid #2D3748;border-top-color:#805AD5;animation:s 1s linear infinite}
    @keyframes s{to{transform:rotate(360deg)}}
    @media (prefers-reduced-motion:reduce){i{animation-duration:4s}}
  </style></head><body><h1>RoninArc</h1><i></i><p>Starting up. The first launch can take up to a minute.</p></body></html>`;
  splash.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  return splash;
}

function stopChildProcesses() {
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
  }
  if (mongodProcess) {
    // mongod handles SIGTERM as a clean shutdown request (flushes to disk,
    // closes its journal) -- do not force-kill it under normal shutdown.
    mongodProcess.kill();
    mongodProcess = null;
  }
}

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
  return win;
}

// ── Settings: version, updates, problem reports ──────────────────────────
let updates = null;

ipcMain.handle("app:info", async () => ({ version: app.getVersion(), packaged: app.isPackaged }));
ipcMain.handle("updates:status", async () => (updates ? updates.status() : { state: "disabled", current: app.getVersion() }));
ipcMain.handle("updates:check", async () => (updates ? updates.check() : { state: "disabled", current: app.getVersion() }));
ipcMain.handle("updates:install", async () => (updates ? updates.install() : false));

ipcMain.handle("diagnostics:create", async () => {
  try {
    const savedToken = (() => {
      try {
        return JSON.parse(fs.readFileSync(path.join(app.getPath("userData"), keygate.TOKEN_FILE), "utf8"));
      } catch {
        return undefined;
      }
    })();
    const zipPath = await diagnostics.createReport({
      userDataDir: app.getPath("userData"),
      outputDir: app.getPath("desktop"),
      info: {
        appVersion: app.getVersion(),
        electron: process.versions.electron,
        packaged: app.isPackaged,
        // The token's public id identifies this install in keygate; the token itself never goes in.
        keygate: { configured: !!keygate.loadBuildConfig(__dirname), tokenId: savedToken?.id ?? null, enrolledAt: savedToken?.enrolledAt ?? null },
        updates: updates ? await updates.status() : { state: "disabled" },
      },
    });
    shell.showItemInFolder(zipPath);
    return { ok: true, path: zipPath };
  } catch (err) {
    debugLog("diagnostics: failed", err && err.message ? err.message : String(err));
    return { ok: false, message: `Couldn't create the report. Please send ${DEBUG_LOG_PATH} instead.` };
  }
});

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
// Only the exact link shapes the library builds: openExternal will run whatever it's given.
const INSTALL_LINKS = [
  /^steam:\/\/install\/\d+$/,
  /^com\.epicgames\.launcher:\/\/apps\/[\w%.~-]+\?action=install$/,
  /^com\.epicgames\.launcher:\/\/store\/p\/[\w%.~/-]+$/,
  /^com\.epicgames\.launcher:\/\/library$/,
];

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
async function openEpicLinkOnceStarted(uri) {
  if ((await getProcessList()).includes(EPIC_PROCESS)) return false;
  const exe = await getEpicLauncherPath();
  if (!exe) return false;

  const startedAt = Date.now();
  const launcher = spawn(exe, [], { detached: true, stdio: "ignore" });
  launcher.on("error", (err) => console.warn("[open-install-page] Epic didn't start:", err.message));
  launcher.unref();

  waitForEpicSignIn(startedAt)
    .then(() => shell.openExternal(uri))
    .catch((err) => console.warn("[open-install-page] Failed:", uri, err.message));
  return true;
}

// Separate from launch-game, which starts tracking a play session.
ipcMain.handle("open-install-page", async (_event, uri) => {
  if (typeof uri !== "string" || !INSTALL_LINKS.some((link) => link.test(uri))) {
    console.warn("[open-install-page] Refused:", uri);
    return false;
  }
  // With no launcher to handle the link, Windows asks "which app?" and openExternal still succeeds.
  if (!app.getApplicationNameForProtocol(uri)) {
    console.warn("[open-install-page] No app handles:", uri);
    return false;
  }
  try {
    if (uri.startsWith("com.epicgames.launcher://") && (await openEpicLinkOnceStarted(uri))) return true;
    await shell.openExternal(uri);
    return true;
  } catch (err) {
    console.warn("[open-install-page] Failed:", uri, err.message);
    return false;
  }
});

ipcMain.handle("launch-game", async (event, gameId, exePath) => {
  try {
    console.log("[launch-game] Requested exePath:", exePath);

    const isUri = exePath.includes("://");
    const exeDir = isUri ? process.cwd() : path.dirname(exePath);
    const exeName = isUri ? "" : path.basename(exePath);

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

app.whenReady().then(async () => {
  debugLog("app.whenReady: isDev=", isDev, "resourcesPath=", process.resourcesPath, "__dirname=", __dirname);
  let splash = null;
  if (!isDev) {
    splash = createSplashWindow();
    try {
      debugLog("app.whenReady: starting embedded mongo...");
      await startEmbeddedMongo();
      debugLog("app.whenReady: embedded mongo ready, starting backend...");
      // Never blocks startup: offline, the library still works and enrollment is retried next launch.
      const onlineEnv = await keygateBackendEnv();
      // RoninArc Cloud: this PC's library can sync with the phone app (Settings -> RoninArc Cloud).
      const cloudUrl = loadCloudUrl(__dirname);
      if (cloudUrl) onlineEnv.CLOUD_API_URL = cloudUrl;
      await startBackend(onlineEnv);
      debugLog("app.whenReady: backend ready");
    } catch (err) {
      debugLog("app.whenReady: FAILED", err.message || String(err));
      console.error("[startup] Failed to start embedded backend/database:", err);
      splash.destroy();
      dialog.showErrorBox(
        "RoninArc failed to start",
        `RoninArc's local backend or database could not be started.\n\n${err.message || err}\n\nDetails are in ${DEBUG_LOG_PATH}`,
      );
      app.quit();
      return;
    }
  }

  const mainWindow = createMainWindow();
  if (splash) mainWindow.webContents.once("did-finish-load", () => splash.destroy());

  updates = setupUpdates({
    app,
    dir: __dirname,
    log: debugLog,
    askToRestart: async (version) => {
      const win = BrowserWindow.getAllWindows()[0];
      const { response } = await dialog.showMessageBox(win, {
        type: "info",
        buttons: ["Restart now", "Later"],
        defaultId: 0,
        cancelId: 1,
        title: "Update ready",
        message: `RoninArc ${version} is ready to install.`,
        detail: "Restart now to update, or it will update the next time you close RoninArc. Your library is kept either way.",
      });
      return response === 0;
    },
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  stopChildProcesses();
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  stopChildProcesses();
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

// ── Steam OpenID: BrowserWindow-based redirect capture ───────────────────
//
// Steam's "Sign in through Steam" flow:
//   1. User visits the OpenID login URL (steamProvider.getLoginUrl()).
//   2. After successful login, Steam redirects to OUR OWN backend relay
//      route (http://localhost:<port>/provider/steam/oauth/return) with the
//      full signed OpenID response in the query string.
// Unlike Epic's redirect target, we control this URL, so a single
// interception layer (URL query params) is enough -- no JSON body scrape
// needed. Verification of the captured params happens server-side, inside
// the authenticated /connect call (see steamOpenIdService.verifyAssertion).

ipcMain.handle("steam:login", async (_event, loginUrl) => {
  return new Promise((resolve) => {
    const TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

    function isReturnPage(urlString) {
      try {
        const u = new URL(urlString);
        return (
          (u.hostname === "localhost" || u.hostname === "127.0.0.1") &&
          u.pathname === "/provider/steam/oauth/return"
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

    const hardTimeout = setTimeout(() => {
      settle(null); // null → renderer treats as cancellation
    }, TIMEOUT_MS);

    const authWindow = new BrowserWindow({
      width: 560,
      height: 700,
      title: "Steam — Sign In",
      show: true,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        // Do NOT attach a preload — this is an external OpenID window.
      },
    });

    authWindow.setParentWindow(BrowserWindow.getAllWindows()[0] ?? null);

    authWindow.loadURL(loginUrl);

    function handleNavigation(url) {
      if (!url || settled) return;
      if (isReturnPage(url)) {
        // Preserve the query string exactly as Steam sent it (no
        // re-encoding) since it's part of a signature the backend verifies.
        const queryIndex = url.indexOf("?");
        const params = queryIndex >= 0 ? url.slice(queryIndex + 1) : null;
        if (params) {
          settle(params);
        }
      }
    }

    authWindow.webContents.on("will-navigate", (_e, url) => handleNavigation(url));
    authWindow.webContents.on("will-redirect", (_e, url) => handleNavigation(url));
    authWindow.webContents.on("did-navigate", (_e, url) => handleNavigation(url));

    authWindow.on("closed", () => {
      settle(null);
    });
  });
});

