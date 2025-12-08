// desktop/main.js

const { app, BrowserWindow } = require("electron");
const path = require("node:path");

// 🔹 Change this if your Vite dev server runs on another port
const DEV_SERVER_URL = "http://localhost:5173";

// app.isPackaged = false in dev, true when you build your Electron app
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
      // Keep these relatively strict for now (no Node in renderer)
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    // 👉 DEV MODE: load Vite dev server
    win.loadURL(DEV_SERVER_URL);
    // Optional: open DevTools in dev mode
    // win.webContents.openDevTools();
  } else {
    // 👉 PROD MODE: load built React app from frontend/dist
    const indexHtml = path.join(
      __dirname,
      "..",
      "frontend",
      "dist",
      "index.html"
    );

    win.loadFile(indexHtml);
  }
}

// Called when Electron has finished initialization
app.whenReady().then(() => {
  createMainWindow();

  app.on("activate", () => {
    // On macOS it's common to recreate a window when dock icon is clicked
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

// Quit when all windows are closed.
app.on("window-all-closed", () => {
  // On macOS, apps usually stay active until Cmd+Q
  if (process.platform !== "darwin") {
    app.quit();
  }
});
