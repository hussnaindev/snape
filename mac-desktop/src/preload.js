// Bridges the sandboxed renderer to the main-process MovieBox client.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  search: (keyword) => ipcRenderer.invoke('moviebox:search', keyword),
  play: (subjectId, isSeries) => ipcRenderer.invoke('moviebox:play', { subjectId, isSeries }),
  captions: (subjectId, se, ep) => ipcRenderer.invoke('moviebox:captions', { subjectId, se, ep }),
  captionVtt: (url) => ipcRenderer.invoke('moviebox:captionVtt', url),
});
