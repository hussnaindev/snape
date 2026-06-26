// Electron main process. Owns the window, runs all MovieBox BFF calls (search,
// play-info) here in Node — no CORS, residential IP — and injects the CloudFront
// signCookie + mobile User-Agent onto every CDN request the renderer's Shaka
// player makes (the desktop equivalent of ExoPlayer's default request headers).

const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('node:path');
const moviebox = require('./moviebox');

// Many MovieBox titles stream HEVC/H.265 only (no H.264 fallback) — Android's
// ExoPlayer hardware-decodes them. Chromium plays HEVC only via the OS hardware
// decoder; enable it explicitly so it's on regardless of Electron version. Works
// on Apple Silicon and Intel Macs with an HEVC-capable GPU (≈2016+); very old
// Intel Macs without HEVC hardware can't decode these (Chromium has no software
// HEVC path).
app.commandLine.appendSwitch('enable-features', 'PlatformHEVCDecoderSupport');

// The stream the renderer is currently playing. CDN requests (manifest +
// segments) for this origin get the signed cookie + UA injected below.
let activeStream = { origin: null, cookie: '' };

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 720,
    minHeight: 480,
    backgroundColor: '#000000',
    title: 'Snape',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // Test/MVP: the MovieBox CDN doesn't send CORS headers (the native apps
      // don't need them). Disabling web security lets Shaka's XHR read the
      // manifest/segments cross-origin, matching ExoPlayer's native fetch.
      webSecurity: false,
    },
  });

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  return win;
}

/** Inject Cookie + mobile UA onto requests to the active stream's CDN origin. */
function installHeaderInjector() {
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    if (activeStream.origin && details.url.startsWith(activeStream.origin)) {
      const headers = { ...details.requestHeaders };
      if (activeStream.cookie) headers.Cookie = activeStream.cookie;
      headers['User-Agent'] = moviebox.USER_AGENT;
      callback({ requestHeaders: headers });
      return;
    }
    callback({ requestHeaders: details.requestHeaders });
  });
}

// --- IPC --------------------------------------------------------------------

ipcMain.handle('moviebox:search', async (_e, keyword) => {
  if (!keyword || !keyword.trim()) return [];
  return moviebox.search(keyword);
});

ipcMain.handle('moviebox:play', async (_e, { subjectId, isSeries }) => {
  const stream = await moviebox.playInfo(subjectId, isSeries);
  if (!stream) {
    activeStream = { origin: null, cookie: '' };
    return null;
  }
  // Register the cookie/origin BEFORE the renderer asks Shaka to load the URL,
  // so the very first manifest request already carries the signed cookie.
  activeStream = { origin: new URL(stream.url).origin, cookie: stream.signCookie };
  return stream;
});

app.whenReady().then(() => {
  installHeaderInjector();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
