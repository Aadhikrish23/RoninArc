// desktop/preload.js
const { contextBridge, ipcRenderer } = require("electron");

console.log("🔌 preload.js loaded in", process.type); // debug log

contextBridge.exposeInMainWorld("electronAPI", {
  selectExePath: async () => {
    return await ipcRenderer.invoke("select-exe-path");
  },
  launchGame: async (exePath) => {
    return await ipcRenderer.invoke("launch-game", exePath);
  },
});
