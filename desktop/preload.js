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
    ipcRenderer.on("game-exited", (_event, gameId) => {
      callback(gameId);
    });
  },
  scanEpicGames: async () => {
    return await ipcRenderer.invoke("epic:scan");
  },
  scanSteamGames: async () => {
    return await ipcRenderer.invoke("steam:scan");
  },
});
