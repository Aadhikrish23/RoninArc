// desktop/preload.js
const { contextBridge, ipcRenderer } = require("electron");

console.log("🔌 preload.js loaded in", process.type); // debug log

contextBridge.exposeInMainWorld("electronAPI", {
  selectExePath: async () => {
    return await ipcRenderer.invoke("select-exe-path");
  },
  launchGame: async (gameId, exePath) => {
    return await ipcRenderer.invoke("launch-game", gameId, exePath);
  },

  onGameExited: (callback) => {
    const listener = (_event, gameId) => callback(gameId);

    ipcRenderer.on("game-exited", listener);

    return () => {
      ipcRenderer.removeListener("game-exited", listener);
    };
  },

  scanEpicGames: async () => {
    return await ipcRenderer.invoke("epic:scan");
  },

  scanSteamGames: async () => {
    return await ipcRenderer.invoke("steam:scan");
  },

  /**
   * Opens a child BrowserWindow for Epic OAuth.
   * Returns:
   *   string  → authorization code (success)
   *   null    → user cancelled / closed the window
   *   "ERROR:<message>" → failure during the flow
   */
  epicLogin: async (loginUrl) => {
    return await ipcRenderer.invoke("epic:login", loginUrl);
  },
});
