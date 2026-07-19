// Custom player chrome — a 1:1 port of the native Android app's
// ui/player/StreamPlayer.kt (StreamPlayerChrome) + PlayerIcons.kt. Replaces the
// browser's default <video> controls with the same overlay: red YouTube-style
// scrubber, centered play/pause + buffering spinner, the same SVG control
// glyphs, the Settings → Quality/Speed/Audio menu, the Subtitles (CC) menu, a
// fill-screen toggle, fullscreen, and a monospace captions overlay. Streaming is
// Shaka (DASH); only the chrome is custom — same as the app keeps Media3 intact.

/* global shaka */

// --- icons (exact SVG path data from PlayerIcons.kt / the web player) --------

const P = {
  play:
    'M10.89 4.99A2.25 2.25 0 0 0 7.5 6.93v22.13a2.25 2.25 0 0 0 3.39 1.94l19-11.06a2.25 2.25 0 0 0 0-3.89l-19-11.06Z',
  pause:
    'M12.75 4.5h-3A2.25 2.25 0 0 0 7.5 6.75v22.5a2.25 2.25 0 0 0 2.25 2.25h3A2.25 2.25 0 0 0 15 29.25V6.75a2.25 2.25 0 0 0-2.25-2.25Zm13.5 0h-3A2.25 2.25 0 0 0 21 6.75v22.5a2.25 2.25 0 0 0 2.25 2.25h3a2.25 2.25 0 0 0 2.25-2.25V6.75a2.25 2.25 0 0 0-2.25-2.25Z',
  volOnBody:
    'M11.6 2.08 11.48 2.14 3.91 6.68C3.02 7.21 2.28 7.97 1.77 8.87 1.26 9.77 1 10.79 1 11.83V12.16C1.07 13.52 1.37 14.46 1.87 15.29 2.38 16.12 3.08 16.81 3.91 17.31L11.48 21.85C11.63 21.94 11.8 21.99 11.98 21.99 12.16 22 12.33 21.95 12.49 21.87 12.64 21.78 12.77 21.65 12.86 21.5 12.95 21.35 13 21.17 13 21V3C12.99 2.83 12.95 2.67 12.87 2.52 12.8 2.37 12.68 2.25 12.54 2.16 12.41 2.07 12.25 2.01 12.08 2 11.92 1.98 11.75 2.01 11.6 2.08Z',
  volWave1:
    'M15.53 7.05C15.35 7.22 15.25 7.45 15.24 7.7 15.23 7.95 15.31 8.19 15.46 8.38L15.53 8.46 15.7 8.64C16.09 9.06 16.39 9.55 16.61 10.08 16.9 10.85 17 11.42 17 12 16.96 12.73 16.87 13.22 16.7 13.68 16.36 14.51 15.99 15.07 15.53 15.53 15.35 15.72 15.25 15.97 15.26 16.23 15.26 16.49 15.37 16.74 15.55 16.92 15.73 17.11 15.98 17.21 16.24 17.22 16.5 17.22 16.76 17.12 16.95 16.95 17.6 16.29 18.11 15.52 18.46 14.67L18.59 14.35C18.82 13.71 18.95 13.03 18.99 12.34L19 12C18.99 11.19 18.86 10.39 18.59 9.64L18.46 9.32C18.15 8.57 17.72 7.89 17.18 7.3L16.95 7.05 16.87 6.98C16.68 6.82 16.43 6.74 16.19 6.75 15.94 6.77 15.71 6.87 15.53 7.05Z',
  volWave2:
    'M18.36 4.22C18.18 4.39 18.08 4.62 18.07 4.87 18.05 5.12 18.13 5.36 18.29 5.56L18.36 5.63 18.66 5.95C19.36 6.72 19.91 7.6 20.31 8.55L20.47 8.96C20.82 9.94 21 10.96 21 11.99L20.98 12.44C20.94 13.32 20.77 14.19 20.47 15.03L20.31 15.44C19.86 16.53 19.19 17.52 18.36 18.36 18.17 18.55 18.07 18.8 18.07 19.07 18.07 19.33 18.17 19.59 18.36 19.77 18.55 19.96 18.8 20.07 19.07 20.07 19.33 20.07 19.59 19.96 19.77 19.77 20.79 18.75 21.61 17.54 22.16 16.2L22.35 15.7C22.72 14.68 22.93 13.62 22.98 12.54L23 12C22.99 10.73 22.78 9.48 22.35 8.29L22.16 7.79C21.67 6.62 20.99 5.54 20.15 4.61L19.77 4.22 19.7 4.15C19.51 3.99 19.26 3.91 19.02 3.93 18.77 3.94 18.53 4.04 18.36 4.22Z',
  captions:
    'M21.2 3.01 21 3H3L2.79 3.01C2.3 3.06 1.84 3.29 1.51 3.65 1.18 4.02 .99 4.5 1 5V19L1.01 19.2C1.05 19.66 1.26 20.08 1.58 20.41 1.91 20.73 2.33 20.94 2.79 20.99L3 21H21L21.2 20.98C21.66 20.94 22.08 20.73 22.41 20.41 22.73 20.08 22.94 19.66 22.99 19.2L23 19V5C23 4.5 22.81 4.02 22.48 3.65 22.15 3.29 21.69 3.06 21.2 3.01ZM3 19V5H21V19H3ZM6.97 8.34C6.42 8.64 5.96 9.09 5.64 9.63L5.5 9.87C5.16 10.53 4.99 11.26 5 12L5 12.27C5.04 12.92 5.21 13.55 5.5 14.12L5.64 14.36C5.96 14.9 6.42 15.35 6.97 15.65L7.21 15.77C7.79 16.01 8.43 16.06 9.03 15.91L9.29 15.83C9.88 15.61 10.39 15.23 10.77 14.73 10.93 14.53 11 14.27 10.97 14.02 10.94 13.77 10.82 13.53 10.63 13.37 10.44 13.2 10.19 13.11 9.93 13.12 9.68 13.13 9.44 13.24 9.26 13.43L9.19 13.5C9.05 13.7 8.85 13.85 8.62 13.94L8.54 13.97C8.35 14.02 8.16 14 7.99 13.92L7.91 13.88C7.67 13.75 7.48 13.56 7.35 13.32L7.28 13.2C7.11 12.88 7.02 12.52 7 12.16L7 12C6.99 11.58 7.09 11.16 7.28 10.79L7.35 10.67C7.48 10.43 7.67 10.24 7.91 10.11 8.1 10 8.32 9.97 8.54 10.02L8.62 10.05C8.81 10.12 8.98 10.24 9.11 10.39L9.19 10.49 9.26 10.57C9.43 10.74 9.66 10.85 9.91 10.87 10.15 10.89 10.4 10.81 10.59 10.66 10.79 10.51 10.92 10.29 10.96 10.05 11.01 9.8 10.96 9.55 10.83 9.34L10.77 9.26 10.6 9.05C10.24 8.65 9.79 8.35 9.29 8.16L9.03 8.08C8.34 7.91 7.6 8 6.97 8.34ZM14.97 8.34C14.42 8.64 13.96 9.09 13.64 9.63L13.5 9.87C13.16 10.53 12.99 11.26 13 12L13 12.27C13.04 12.92 13.21 13.55 13.5 14.12L13.64 14.36C13.96 14.9 14.42 15.35 14.97 15.65L15.21 15.77C15.79 16.01 16.43 16.06 17.03 15.91L17.29 15.83C17.88 15.61 18.39 15.23 18.77 14.73 18.93 14.53 19 14.27 18.97 14.02 18.94 13.77 18.82 13.53 18.63 13.37 18.44 13.2 18.19 13.11 17.93 13.12 17.68 13.13 17.44 13.24 17.26 13.43L17.19 13.5C17.05 13.7 16.85 13.85 16.62 13.94L16.54 13.97C16.35 14.02 16.16 14 15.99 13.92L15.91 13.88C15.67 13.75 15.48 13.56 15.35 13.32L15.28 13.2C15.11 12.88 15.02 12.52 15 12.16L15 12C14.99 11.58 15.09 11.16 15.28 10.79L15.35 10.67C15.48 10.43 15.67 10.24 15.91 10.11 16.1 10 16.32 9.97 16.54 10.02L16.62 10.05C16.81 10.12 16.98 10.24 17.11 10.39L17.19 10.49 17.26 10.57C17.43 10.74 17.66 10.85 17.91 10.87 18.15 10.89 18.4 10.81 18.59 10.66 18.79 10.51 18.92 10.29 18.96 10.05 19.01 9.8 18.96 9.55 18.83 9.34L18.77 9.26 18.6 9.05C18.24 8.65 17.79 8.35 17.29 8.16L17.03 8.08C16.34 7.91 15.6 8 14.97 8.34Z',
  settings:
    'M12.84 1H11.15C10.72 .99 10.3 1.14 9.95 1.4 9.6 1.66 9.35 2.02 9.23 2.44L9.19 2.61C9.11 3 8.96 3.38 8.73 3.71 8.51 4.04 8.22 4.33 7.89 4.55L7.75 4.64C7.37 4.85 6.96 4.98 6.53 5.02 6.11 5.06 5.68 5.01 5.27 4.87 4.86 4.73 4.42 4.73 4 4.86 3.59 5 3.23 5.26 2.99 5.62L2.89 5.77 2.05 7.23C1.82 7.63 1.73 8.1 1.81 8.55 1.88 9.01 2.12 9.43 2.47 9.73L2.58 9.84C3.15 10.39 3.5 11.15 3.5 12L3.49 12.16C3.47 12.56 3.37 12.95 3.19 13.31 3.01 13.67 2.77 13.99 2.47 14.26 2.12 14.56 1.88 14.98 1.81 15.43 1.73 15.89 1.82 16.36 2.05 16.76L2.89 18.22 2.99 18.37C3.24 18.73 3.59 18.99 4.01 19.13 4.42 19.26 4.86 19.26 5.27 19.12L5.42 19.07C5.81 18.96 6.21 18.93 6.61 18.98 7.01 19.03 7.4 19.15 7.75 19.36L7.89 19.44C8.22 19.66 8.51 19.95 8.73 20.28 8.96 20.61 9.11 20.99 9.19 21.38 9.28 21.84 9.52 22.24 9.88 22.54 10.24 22.83 10.69 23 11.15 23H12.84C13.3 23 13.75 22.83 14.11 22.54 14.47 22.24 14.71 21.84 14.8 21.38 14.89 20.96 15.06 20.56 15.31 20.21 15.55 19.86 15.88 19.57 16.25 19.36L16.39 19.28C16.75 19.1 17.14 18.99 17.54 18.96 17.94 18.94 18.34 18.99 18.72 19.12L18.89 19.17C19.31 19.27 19.75 19.24 20.15 19.07 20.55 18.9 20.88 18.6 21.1 18.23L21.95 16.76C22.18 16.36 22.26 15.89 22.19 15.43 22.11 14.98 21.88 14.56 21.53 14.26 21.23 13.99 20.98 13.67 20.8 13.31 20.63 12.95 20.52 12.56 20.5 12.16L20.5 12C20.5 11.57 20.59 11.14 20.77 10.75 20.94 10.36 21.2 10.01 21.53 9.73 21.88 9.43 22.11 9.01 22.19 8.55 22.26 8.1 22.18 7.63 21.95 7.23L21.1 5.76C20.88 5.39 20.55 5.09 20.15 4.92 19.76 4.75 19.31 4.72 18.89 4.82L18.72 4.87C18.34 5 17.94 5.05 17.54 5.03 17.14 5 16.75 4.89 16.4 4.71L16.25 4.63C15.88 4.42 15.56 4.13 15.31 3.78 15.06 3.43 14.89 3.03 14.8 2.61 14.71 2.15 14.47 1.74 14.11 1.45 13.75 1.16 13.3 .99 12.84 1ZM11.15 3H12.84C12.98 3.7 13.26 4.36 13.68 4.94 14.09 5.52 14.63 6.01 15.25 6.37 15.87 6.72 16.55 6.94 17.26 7.01 17.97 7.08 18.69 6.99 19.37 6.76L20.21 8.23C19.67 8.69 19.24 9.27 18.94 9.92 18.65 10.57 18.5 11.28 18.5 12 18.5 12.71 18.65 13.42 18.95 14.07 19.24 14.72 19.67 15.29 20.21 15.76L19.37 17.23C18.69 16.99 17.97 16.91 17.26 16.98 16.55 17.05 15.86 17.27 15.25 17.63 14.63 17.98 14.09 18.47 13.68 19.05 13.26 19.63 12.98 20.29 12.84 21H11.15C11.01 20.29 10.73 19.63 10.31 19.05 9.9 18.47 9.36 17.98 8.75 17.62 8.13 17.27 7.44 17.05 6.73 16.98 6.02 16.91 5.3 16.99 4.62 17.23L3.78 15.76C4.32 15.29 4.75 14.71 5.05 14.06 5.34 13.41 5.49 12.71 5.5 12 5.5 11.28 5.34 10.57 5.05 9.92 4.75 9.27 4.32 8.69 3.78 8.23L4.62 6.76C5.3 7 6.02 7.08 6.73 7.01 7.44 6.94 8.13 6.72 8.75 6.37 9.36 6.01 9.9 5.52 10.31 4.94 10.73 4.36 11.01 3.7 11.15 3ZM12 8C10.94 8 9.92 8.42 9.17 9.17 8.42 9.92 8 10.93 8 12 8 13.06 8.42 14.07 9.17 14.82 9.92 15.57 10.94 16 12 16 13.06 16 14.08 15.57 14.83 14.82 15.58 14.07 16 13.06 16 12 16 10.93 15.58 9.92 14.83 9.17 14.08 8.42 13.06 8 12 8ZM12 10H12L12.2 10.01C12.69 10.06 13.15 10.29 13.48 10.65 13.81 11.02 14 11.5 14 12L13.99 12.2C13.95 12.58 13.8 12.95 13.55 13.25 13.31 13.55 12.98 13.78 12.62 13.9 12.25 14.02 11.85 14.03 11.48 13.93 11.11 13.83 10.77 13.62 10.51 13.34 10.25 13.05 10.08 12.69 10.02 12.31 9.96 11.93 10.01 11.54 10.17 11.18 10.32 10.83 10.58 10.53 10.91 10.32 11.23 10.11 11.61 10 12 10Z',
  fill:
    'M25,18h-2v3h-3v2h5V18z M13,15h3v-2h-5v5h2V15z M27,9H9c-1.1,0-2,0.9-2,2v14c0,1.1,0.9,2,2,2h18c1.1,0,2-0.9,2-2V11C29,9.9,28.1,9,27,9z M27,25H9V11h18V25z',
  fsEnter:
    'M10 3H3V10C3 10.26 3.1 10.51 3.29 10.7 3.48 10.89 3.73 11 4 11 4.26 11 4.51 10.89 4.7 10.7 4.89 10.51 5 10.26 5 10V6.41L9.29 10.7 9.36 10.77C9.56 10.92 9.8 11 10.04 10.99 10.29 10.98 10.52 10.87 10.7 10.7 10.87 10.52 10.98 10.29 10.99 10.04 11 9.8 10.92 9.56 10.77 9.36L10.7 9.29 6.41 5H10C10.26 5 10.51 4.89 10.7 4.7 10.89 4.51 11 4.26 11 4 11 3.73 10.89 3.48 10.7 3.29 10.51 3.1 10.26 3 10 3ZM20 13C19.73 13 19.48 13.1 19.29 13.29 19.1 13.48 19 13.73 19 14V17.58L14.7 13.29 14.63 13.22C14.43 13.07 14.19 12.99 13.95 13 13.7 13.01 13.47 13.12 13.29 13.29 13.12 13.47 13.01 13.7 13 13.95 12.99 14.19 13.07 14.43 13.22 14.63L13.29 14.7 17.58 19H14C13.73 19 13.48 19.1 13.29 19.29 13.1 19.48 13 19.73 13 20 13 20.26 13.1 20.51 13.29 20.7 13.48 20.89 13.73 21 14 21H21V14C21 13.73 20.89 13.48 20.7 13.29 20.51 13.1 20.26 13 20 13Z',
  fsExit:
    'M3.29 3.29 3.22 3.36C3.07 3.56 2.99 3.8 3 4.05 3.01 4.29 3.12 4.53 3.29 4.7L7.58 9H4C3.73 9 3.48 9.1 3.29 9.29 3.1 9.48 3 9.73 3 10 3 10.26 3.1 10.51 3.29 10.7 3.48 10.89 3.73 11 4 11H11V4C11 3.73 10.89 3.48 10.7 3.29 10.51 3.1 10.26 3 10 3 9.73 3 9.48 3.1 9.29 3.29 9.1 3.48 9 3.73 9 4V7.58L4.7 3.29C4.51 3.1 4.26 3 4 3 3.74 3 3.49 3.1 3.29 3.29ZM13 13V20C13 20.26 13.1 20.51 13.29 20.7 13.48 20.89 13.73 21 14 21 14.26 21 14.51 20.89 14.7 20.7 14.89 20.51 15 20.26 15 20V16.41L19.29 20.7C19.48 20.89 19.73 21 20 21 20.26 21 20.51 20.89 20.7 20.7 20.89 20.51 21 20.26 21 20 21 19.73 20.89 19.48 20.7 19.29L16.41 15H20C20.26 15 20.51 14.89 20.7 14.7 20.89 14.51 21 14.26 21 14 21 13.73 20.89 13.48 20.7 13.29 20.51 13.1 20.26 13 20 13H13Z',
};

const svgFill = (vb, paths) =>
  `<svg viewBox="${vb}" fill="currentColor" xmlns="http://www.w3.org/2000/svg">${paths
    .map((d) => `<path d="${d}"/>`)
    .join('')}</svg>`;
const svgStroke = (vb, paths) =>
  `<svg viewBox="${vb}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">${paths
    .map((d) => `<path d="${d}"/>`)
    .join('')}</svg>`;

const ICON = {
  play: svgFill('0 0 36 36', [P.play]),
  pause: svgFill('0 0 36 36', [P.pause]),
  replay10: svgStroke('0 0 24 24', ['M11 4 4 11l7 7', 'M4 11h11a5 5 0 0 1 0 10h-1']),
  forward10: svgStroke('0 0 24 24', ['m13 4 7 7-7 7', 'M20 11H9a5 5 0 0 0 0 10h1']),
  volumeOn: svgFill('0 0 24 24', [P.volOnBody, P.volWave1, P.volWave2]),
  volumeOff: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="${P.volOnBody}"/><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M16.5 9.5l5 5m0-5l-5 5"/></svg>`,
  captions: svgFill('0 0 24 24', [P.captions]),
  settings: svgFill('0 0 24 24', [P.settings]),
  fill: svgFill('6 6 24 24', [P.fill]),
  fsEnter: svgFill('0 0 24 24', [P.fsEnter]),
  fsExit: svgFill('0 0 24 24', [P.fsExit]),
  episodes: svgStroke('0 0 24 24', ['M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01']),
};

// --- helpers ----------------------------------------------------------------

function fmt(ms) {
  if (!ms || ms <= 0) return '0:00';
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

// --- factory ----------------------------------------------------------------

function createStreamPlayer(video, overlay) {
  // Build the chrome DOM once.
  overlay.insertAdjacentHTML(
    'beforeend',
    `
    <div class="cap-overlay" data-el="cap"></div>
    <div class="tap-layer" data-el="tap"></div>
    <button class="center-btn" data-el="center" aria-label="Play/Pause"></button>
    <div class="buffering" data-el="buffering"><div class="spinner"></div></div>
    <div class="chrome" data-el="chrome">
      <div class="scrubber" data-el="scrubber">
        <div class="scrub-track">
          <div class="scrub-buffered" data-el="buf"></div>
          <div class="scrub-played" data-el="played"></div>
        </div>
        <div class="scrub-knob" data-el="knob"></div>
      </div>
      <div class="controls-row">
        <button class="ctrl" data-el="playpause" aria-label="Play/Pause"></button>
        <button class="ctrl" data-el="back10" aria-label="Back 10s">${ICON.replay10}</button>
        <button class="ctrl" data-el="fwd10" aria-label="Forward 10s">${ICON.forward10}</button>
        <button class="ctrl" data-el="mute" aria-label="Mute"></button>
        <span class="time" data-el="time">0:00  /  0:00</span>
        <span class="spacer"></span>
        <button class="ctrl" data-el="episodes" aria-label="Episodes" hidden>${ICON.episodes}</button>
        <button class="ctrl" data-el="cc" aria-label="Subtitles" hidden>${ICON.captions}</button>
        <button class="ctrl" data-el="settings" aria-label="Settings">${ICON.settings}</button>
        <button class="ctrl" data-el="fill" aria-label="Fill screen">${ICON.fill}</button>
        <button class="ctrl" data-el="fs" aria-label="Fullscreen">${ICON.fsEnter}</button>
      </div>
    </div>
    <div class="ep-overlay" data-el="epov" hidden></div>
    <div class="menu-popup" data-el="menu" hidden></div>
  `,
  );

  const el = {};
  overlay.querySelectorAll('[data-el]').forEach((n) => {
    el[n.dataset.el] = n;
  });

  let shakaPlayer = null;
  let raf = null;
  let hideTimer = null;
  let controlsShown = true;
  let menu = 'none'; // none | settings | quality | speed | subtitles | audio
  let fillScreen = false; // RESIZE_MODE_FIT default (contain, not zoom)
  let qualityHeight = null; // null = Auto
  let speed = 1;
  let muted = false;
  let resolutions = [];
  let captionList = [];
  let activeCaptionId = null; // null = Off
  let variants = [];
  let selectedVariantId = null;
  let onSelectVariant = null;
  let episodes = [];
  let currentSe = 0;
  let currentEp = 0;
  let onSelectEpisode = null;
  let episodesShown = false;
  let loaded = false;
  let loading = false;
  const loadedTracks = new Map(); // captionId -> <track>

  video.style.objectFit = 'contain';

  // Render an active cue inside a 55%-black band (matching the app's overlay).
  function setCue(text) {
    if (!text) {
      el.cap.replaceChildren();
      return;
    }
    const span = document.createElement('span');
    span.className = 'cap-text-band';
    span.textContent = text;
    el.cap.replaceChildren(span);
  }

  // --- chrome visibility ----------------------------------------------------

  function scheduleHide() {
    clearTimeout(hideTimer);
    if (controlsShown && !video.paused && menu === 'none') {
      hideTimer = setTimeout(() => {
        controlsShown = false;
        render();
      }, 3200);
    }
  }
  function showControls() {
    controlsShown = true;
    render();
    scheduleHide();
  }

  // --- menus ----------------------------------------------------------------

  function openMenu(name) {
    menu = menu === name ? 'none' : name;
    render();
    scheduleHide();
  }
  function rowItem(label, value) {
    return `<div class="menu-row" data-row><span>${label}</span><span class="val">${value}  ›</span></div>`;
  }
  function optItem(label, active) {
    return `<div class="menu-opt${active ? ' on' : ''}" data-opt><span class="dot"></span>${label}</div>`;
  }
  function renderMenu() {
    if (menu === 'none') {
      el.menu.hidden = true;
      return;
    }
    el.menu.hidden = false;
    let html = '';
    if (menu === 'settings') {
      html += rowItem('Quality', qualityHeight ? `${qualityHeight}p` : 'Auto');
      html += rowItem('Speed', `${speed}x`);
      if (variants.length > 1) {
        const cur = variants.find((v) => v.id === selectedVariantId)?.label || 'Original';
        html += rowItem('Audio', cur);
      }
    } else if (menu === 'quality') {
      html += optItem('Auto', qualityHeight == null);
      for (const h of resolutions) html += optItem(`${h}p`, qualityHeight === h);
    } else if (menu === 'speed') {
      for (const s of SPEEDS) html += optItem(`${s}x`, s === speed);
    } else if (menu === 'subtitles') {
      html += optItem('Off', activeCaptionId == null);
      for (const c of captionList) html += optItem(c.lanName || c.lan, activeCaptionId === c.id);
    } else if (menu === 'audio') {
      for (const v of variants) html += optItem(v.label, v.id === selectedVariantId);
    }
    el.menu.innerHTML = html;

    // Wire row navigation (settings -> submenu).
    if (menu === 'settings') {
      const rows = el.menu.querySelectorAll('[data-row]');
      rows.forEach((r, i) => {
        r.onclick = () => {
          const targets = ['quality', 'speed', 'audio'];
          openMenu(targets[i]);
        };
      });
    } else {
      const opts = el.menu.querySelectorAll('[data-opt]');
      opts.forEach((o, i) => {
        o.onclick = () => onMenuOpt(i);
      });
    }
  }
  function onMenuOpt(i) {
    if (menu === 'quality') {
      qualityHeight = i === 0 ? null : resolutions[i - 1];
      applyQuality(qualityHeight);
    } else if (menu === 'speed') {
      speed = SPEEDS[i];
      video.playbackRate = speed;
    } else if (menu === 'subtitles') {
      const cap = i === 0 ? null : captionList[i - 1];
      selectCaption(cap);
    } else if (menu === 'audio') {
      const v = variants[i];
      if (v && v.id !== selectedVariantId && onSelectVariant) onSelectVariant(v.id);
    }
    menu = 'none';
    render();
    scheduleHide();
  }

  // --- quality (Shaka track selection) -------------------------------------

  function applyQuality(h) {
    if (!shakaPlayer) return;
    if (h == null) {
      shakaPlayer.configure({ abr: { enabled: true } });
      return;
    }
    shakaPlayer.configure({ abr: { enabled: false } });
    const tracks = shakaPlayer.getVariantTracks();
    let t = tracks.find((x) => x.height === h);
    if (!t && tracks.length) {
      t = [...tracks].sort(
        (a, b) => Math.abs((a.height || 0) - h) - Math.abs((b.height || 0) - h),
      )[0];
    }
    if (t) shakaPlayer.selectVariantTrack(t, true);
  }

  // --- captions (native hidden TextTrack -> custom mono overlay) ------------

  async function selectCaption(cap) {
    // Hide all loaded tracks first.
    for (const tr of loadedTracks.values()) tr.track.mode = 'disabled';
    setCue('');
    activeCaptionId = cap ? cap.id : null;
    if (!cap) return;
    try {
      let trackEl = loadedTracks.get(cap.id);
      if (!trackEl) {
        const vtt = await window.api.captionVtt(cap.url);
        const url = URL.createObjectURL(new Blob([vtt], { type: 'text/vtt' }));
        trackEl = document.createElement('track');
        trackEl.kind = 'subtitles';
        trackEl.label = cap.lanName || cap.lan;
        trackEl.srclang = cap.lan || cap.id;
        trackEl.src = url;
        video.appendChild(trackEl);
        loadedTracks.set(cap.id, trackEl);
        await new Promise((res) => {
          trackEl.addEventListener('load', res, { once: true });
          setTimeout(res, 1500);
        });
        trackEl.track.addEventListener('cuechange', () => {
          if (activeCaptionId !== cap.id) return;
          const cues = trackEl.track.activeCues;
          setCue(cues && cues.length ? cues[0].text : '');
        });
      }
      trackEl.track.mode = 'hidden'; // events fire, native rendering off
    } catch {
      /* best-effort, like the app */
    }
  }

  // --- scrubber -------------------------------------------------------------

  let scrubbing = false;
  function seekFromPointer(clientX) {
    const r = el.scrubber.getBoundingClientRect();
    const frac = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    if (video.duration) video.currentTime = frac * video.duration;
    updateScrub(frac);
  }
  function updateScrub(frac) {
    el.played.style.width = `${frac * 100}%`;
    el.knob.style.left = `${frac * 100}%`;
  }
  el.scrubber.addEventListener('pointerdown', (e) => {
    scrubbing = true;
    el.scrubber.setPointerCapture(e.pointerId);
    seekFromPointer(e.clientX);
    showControls();
  });
  el.scrubber.addEventListener('pointermove', (e) => {
    if (scrubbing) seekFromPointer(e.clientX);
  });
  el.scrubber.addEventListener('pointerup', () => {
    scrubbing = false;
  });

  // --- tap / double-tap (single video region) ------------------------------

  let lastTap = 0;
  el.tap.addEventListener('click', (e) => {
    const now = Date.now();
    if (now - lastTap < 280) {
      lastTap = 0;
      const r = el.tap.getBoundingClientRect();
      const x = e.clientX - r.left;
      if (x < r.width / 3) seekBy(-10);
      else if (x > (r.width * 2) / 3) seekBy(10);
      else togglePlay();
      showControls();
      return;
    }
    lastTap = now;
    if (menu !== 'none' || episodesShown) {
      menu = 'none';
      episodesShown = false;
      render();
    } else {
      controlsShown = !controlsShown;
      render();
      if (controlsShown) scheduleHide();
    }
  });

  // Reveal the chrome on hover/move (not just on click), like a desktop player.
  // Cheap: only full-render on the hidden->shown transition; otherwise just
  // push back the auto-hide timer so an open menu doesn't rebuild on every move.
  function onActivity() {
    if (!controlsShown) {
      controlsShown = true;
      render();
    }
    scheduleHide();
  }
  overlay.addEventListener('mousemove', onActivity);
  overlay.addEventListener('mouseleave', () => {
    if (!video.paused && menu === 'none') {
      controlsShown = false;
      clearTimeout(hideTimer);
      render();
    }
  });

  // --- transport ------------------------------------------------------------

  function togglePlay() {
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  }
  function seekBy(sec) {
    video.currentTime = Math.max(
      0,
      Math.min(video.duration || Infinity, video.currentTime + sec),
    );
  }
  function toggleMute() {
    muted = !muted;
    video.muted = muted;
    render();
  }
  function setVolume(delta) {
    muted = false;
    video.muted = false;
    video.volume = Math.max(0, Math.min(1, (video.volume || 0) + delta));
    render();
  }
  function cycleCaption() {
    if (!captionList.length) return;
    selectCaption(activeCaptionId == null ? captionList[0] : null);
    render();
  }

  el.center.addEventListener('click', togglePlay);
  el.playpause.addEventListener('click', togglePlay);
  el.back10.addEventListener('click', () => {
    seekBy(-10);
    showControls();
  });
  el.fwd10.addEventListener('click', () => {
    seekBy(10);
    showControls();
  });
  el.mute.addEventListener('click', toggleMute);
  el.episodes.addEventListener('click', () => {
    episodesShown = !episodesShown;
    menu = 'none';
    render();
    scheduleHide();
  });
  el.cc.addEventListener('click', () => openMenu('subtitles'));
  el.settings.addEventListener('click', () =>
    openMenu(['settings', 'quality', 'speed', 'audio'].includes(menu) ? 'none' : 'settings'),
  );
  el.fill.addEventListener('click', () => {
    fillScreen = !fillScreen;
    video.style.objectFit = fillScreen ? 'cover' : 'contain';
    render();
  });
  el.fs.addEventListener('click', toggleFullscreen);

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else overlay.requestFullscreen?.();
  }
  document.addEventListener('fullscreenchange', render);

  // Keyboard shortcuts (active only while a stream is loaded and not typing).
  document.addEventListener('keydown', (e) => {
    if (!loaded) return;
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    let handled = true;
    switch (e.key) {
      case ' ':
      case 'k':
        togglePlay();
        break;
      case 'ArrowRight':
        seekBy(5);
        break;
      case 'ArrowLeft':
        seekBy(-5);
        break;
      case 'l':
        seekBy(10);
        break;
      case 'j':
        seekBy(-10);
        break;
      case 'ArrowUp':
        setVolume(0.1);
        break;
      case 'ArrowDown':
        setVolume(-0.1);
        break;
      case 'm':
        toggleMute();
        break;
      case 'f':
        toggleFullscreen();
        break;
      case 'c':
        cycleCaption();
        break;
      default:
        if (e.key >= '0' && e.key <= '9' && video.duration) {
          video.currentTime = (Number(e.key) / 10) * video.duration;
        } else {
          handled = false;
        }
    }
    if (handled) {
      e.preventDefault();
      showControls();
    }
  });

  // --- render loop ----------------------------------------------------------

  function render() {
    const playing = !video.paused;
    const buffering = loading || (video.readyState < 3 && playing);
    const chromeVisible = controlsShown || video.paused;

    el.chrome.classList.toggle('hidden', !chromeVisible);
    overlay.classList.toggle('cursor-hidden', !chromeVisible && !video.paused);
    el.buffering.classList.toggle('hidden', !buffering);
    el.center.classList.toggle('hidden', buffering || !chromeVisible);
    el.center.innerHTML = playing ? ICON.pause : ICON.play;
    el.playpause.innerHTML = playing ? ICON.pause : ICON.play;
    el.mute.innerHTML = muted ? ICON.volumeOff : ICON.volumeOn;
    el.mute.classList.toggle('active', muted);
    el.fill.classList.toggle('active', fillScreen);
    el.cc.classList.toggle('active', activeCaptionId != null);
    el.cc.hidden = captionList.length === 0;
    el.episodes.hidden = episodes.length === 0;
    el.episodes.classList.toggle('active', episodesShown);
    el.settings.classList.toggle('active', menu !== 'none');
    el.fs.innerHTML = document.fullscreenElement ? ICON.fsExit : ICON.fsEnter;

    renderMenu();
    renderEpisodes();
  }

  // In-player episode strip (port of StreamPlayerChrome's EpisodesOverlay).
  function renderEpisodes() {
    const show = episodesShown && episodes.length > 0 && (controlsShown || video.paused);
    el.epov.hidden = !show;
    if (!show) return;
    const tiles = episodes
      .map((e) => {
        const on = e.se === currentSe && e.ep === currentEp;
        return `<button class="ep-cell${on ? ' on' : ''}" data-se="${e.se}" data-ep="${e.ep}">${e.label}</button>`;
      })
      .join('');
    el.epov.innerHTML = `<div class="ep-strip-label">EPISODES</div><div class="ep-strip">${tiles}</div>`;
    el.epov.querySelectorAll('.ep-cell').forEach((c) =>
      c.addEventListener('click', () => {
        const se = Number(c.dataset.se);
        const ep = Number(c.dataset.ep);
        episodesShown = false;
        render();
        if ((se !== currentSe || ep !== currentEp) && onSelectEpisode) onSelectEpisode(se, ep);
      }),
    );
  }

  function tick() {
    const dur = video.duration || 0;
    const pos = video.currentTime || 0;
    const buf = video.buffered.length ? video.buffered.end(video.buffered.length - 1) : 0;
    if (!scrubbing && dur > 0) {
      updateScrub(pos / dur);
      el.buf.style.width = `${Math.min(1, buf / dur) * 100}%`;
    }
    el.time.textContent = `${fmt(pos * 1000)}  /  ${fmt(dur * 1000)}`;
    raf = requestAnimationFrame(tick);
  }

  ['play', 'pause', 'waiting', 'playing', 'canplay', 'seeked'].forEach((ev) =>
    video.addEventListener(ev, () => {
      render();
      if (ev === 'play') scheduleHide();
    }),
  );

  // --- public API -----------------------------------------------------------

  async function ensureShaka() {
    if (shakaPlayer) return;
    shaka.polyfill.installAll();
    shakaPlayer = new shaka.Player();
    await shakaPlayer.attach(video);
    shakaPlayer.addEventListener('error', (e) => {
      if (typeof window.onPlayerError === 'function') window.onPlayerError(e.detail);
    });
    // Patch bare HEVC codec strings (codecs="hev1") so MSE accepts them.
    shakaPlayer.getNetworkingEngine().registerResponseFilter((type, response) => {
      if (type !== shaka.net.NetworkingEngine.RequestType.MANIFEST) return;
      const text = new TextDecoder().decode(response.data);
      const patched = text.replace(/codecs="(hev1|hvc1)"/g, 'codecs="$1.1.6.L120.90"');
      if (patched !== text) response.data = new TextEncoder().encode(patched).buffer;
    });
  }

  async function load(stream, opts = {}) {
    await ensureShaka();
    resolutions = stream.resolutions || [];
    variants = opts.variants || [];
    selectedVariantId = opts.selectedVariantId ?? null;
    onSelectVariant = opts.onSelectVariant || null;
    episodes = opts.episodes || [];
    currentSe = opts.currentSe ?? 0;
    currentEp = opts.currentEp ?? 0;
    onSelectEpisode = opts.onSelectEpisode || null;
    episodesShown = false;
    // Fresh stream: reset transient menu state (mirrors per-stream ExoPlayer).
    qualityHeight = null;
    speed = 1;
    video.playbackRate = 1;
    menu = 'none';
    // Drop any previous caption tracks.
    for (const tr of loadedTracks.values()) tr.remove();
    loadedTracks.clear();
    captionList = [];
    activeCaptionId = null;
    setCue('');

    shakaPlayer.configure({ abr: { enabled: true } });
    // Start the render loop and show spinner during load
    loading = true;
    if (!raf) raf = requestAnimationFrame(tick);
    render();
    await shakaPlayer.load(stream.url, opts.startTime || 0);
    loading = false;
    video.muted = muted;
    video.play().catch(() => {});
    loaded = true;
    controlsShown = true;
    render();
    scheduleHide();
  }

  function setCaptions(list) {
    captionList = list || [];
    render();
  }

  async function unload() {
    loaded = false;
    episodes = [];
    episodesShown = false;
    clearTimeout(hideTimer);
    if (raf) {
      cancelAnimationFrame(raf);
      raf = null;
    }
    for (const tr of loadedTracks.values()) tr.remove();
    loadedTracks.clear();
    captionList = [];
    activeCaptionId = null;
    setCue('');
    menu = 'none';
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    if (shakaPlayer) await shakaPlayer.unload().catch(() => {});
  }

  return { load, setCaptions, unload };
}

window.createStreamPlayer = createStreamPlayer;
