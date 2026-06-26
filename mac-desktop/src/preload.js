// Bridges the sandboxed renderer to the main-process MovieBox client.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  search: (keyword) => ipcRenderer.invoke('moviebox:search', keyword),
  play: (subjectId, isSeries) => ipcRenderer.invoke('moviebox:play', { subjectId, isSeries }),
});
