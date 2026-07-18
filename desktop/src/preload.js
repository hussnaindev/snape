// Bridges the sandboxed renderer to the main-process MovieBox client.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  search: (keyword) => ipcRenderer.invoke('moviebox:search', keyword),
  home: () => ipcRenderer.invoke('moviebox:home'),
  seasons: (subjectId) => ipcRenderer.invoke('moviebox:seasons', subjectId),
  play: (subjectId, se, ep) => ipcRenderer.invoke('moviebox:play', { subjectId, se, ep }),
  captions: (subjectId, se, ep) => ipcRenderer.invoke('moviebox:captions', { subjectId, se, ep }),
  captionVtt: (url) => ipcRenderer.invoke('moviebox:captionVtt', url),
});
