// Ensures only one VideoPlayer instance plays media at a time app-wide.
let stopActive: (() => void) | null = null;

function pauseOtherVideos(keep?: HTMLVideoElement | null): void {
  if (typeof document === 'undefined') return;
  for (const el of document.querySelectorAll('video')) {
    if (el === keep) continue;
    try {
      el.pause();
      el.removeAttribute('src');
      el.load();
    } catch {}
  }
}

export function silenceOtherVideos(keep?: HTMLVideoElement | null): void {
  pauseOtherVideos(keep);
}

export function claimActiveMedia(stop: () => void, videoEl?: HTMLVideoElement | null): void {
  pauseOtherVideos(videoEl);
  if (stopActive && stopActive !== stop) stopActive();
  stopActive = stop;
}

export function releaseActiveMedia(stop: () => void): void {
  if (stopActive === stop) stopActive = null;
}

export function isFullscreenRoot(root: HTMLElement | null): boolean {
  const el = document.fullscreenElement;
  return !!el && !!root && (el === root || root.contains(el));
}

export function exitFullscreenIfRoot(root: HTMLElement | null): void {
  if (isFullscreenRoot(root)) document.exitFullscreen().catch(() => {});
}
