const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("packsAPI", {
  request: () => ipcRenderer.send("packs:request"),
  openFolder: () => ipcRenderer.send("packs:open"),
  onUpdate: (cb) => ipcRenderer.on("packs:update", (event, data) => cb(data))
});
