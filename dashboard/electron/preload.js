const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopEnv', {
  isDesktop: true,
  platform: process.platform,
  version: process.versions.electron,
  selectFolder: () => ipcRenderer.invoke('dialog:selectFolder'),
  getCustomDataDir: () => ipcRenderer.invoke('config:getDataDir'),
  setCustomDataDir: (newPath) => ipcRenderer.invoke('config:setDataDir', newPath)
});

