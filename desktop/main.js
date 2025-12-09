// desktop/main.js
const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("node:path");
const { spawn } = require("node:child_process");

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
    icon: path.join(__dirname, "assets", "logo.jpg"),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  if (isDev) {
    win.loadURL(DEV_SERVER_URL);
    // win.webContents.openDevTools();
  } else {
    const indexHtml = path.join(__dirname, "..", "frontend", "dist", "index.html");
    win.loadFile(indexHtml);
  }
}

// IPC: select exe path
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

// IPC: launch exe (only THIS handler for "launch-game")
ipcMain.handle("launch-game", async (_event, exePath) => {
  console.log("[launch-game] Requested exePath:", exePath);

  return new Promise((resolve) => {
    try {
      const exeDir = path.dirname(exePath);
      console.log("[launch-game] Using cwd:", exeDir);

      const child = spawn(
        "cmd.exe",
        [
          "/c",
          "start",
          '""',
          `"${exePath}"`,
        ],
        {
          cwd: exeDir,
          windowsVerbatimArguments: true,
          detached: true,
        }
      );

      child.on("error", (err) => {
        console.error("[launch-game] child process error:", err);
        resolve(false);
      });

      child.unref();
      console.log("[launch-game] spawn() called successfully");
      resolve(true);
    } catch (err) {
      console.error("[launch-game] top-level error:", err);
      resolve(false);
    }
  });
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
