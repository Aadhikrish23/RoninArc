// desktop/main.js
const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("node:path");
const { spawn, exec } = require("node:child_process");
const activeGames = new Map();

/*
{
  gameId: {
    exeName: "eldenring.exe"
  }
}
*/

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
