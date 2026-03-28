'use client';

import { useCallback, useEffect, useState } from 'react';

type ExtendedOrientation = ScreenOrientation & {
  lock?: (orientation: string) => Promise<void>;
  unlock?: () => void;
};

export function WatchControls() {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    function onFsChange() {
      const inFs = !!document.fullscreenElement;
      setIsFullscreen(inFs);
      if (!inFs) {
        (screen.orientation as ExtendedOrientation).unlock?.();
      }
    }
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (isFullscreen) {
      await document.exitFullscreen().catch(() => {});
    } else {
      try {
        await document.documentElement.requestFullscreen();
        // Lock to landscape after entering fullscreen (Android only; throws silently on iOS)
        await (screen.orientation as ExtendedOrientation).lock?.('landscape').catch(() => {});
      } catch {}
    }
  }, [isFullscreen]);

  return (
    // Shown on mobile only (md:hidden). Positioned top-right, respecting notch/cutout.
    <button
      type="button"
      onClick={toggleFullscreen}
      className="absolute z-10 w-10 h-10 flex items-center justify-center rounded-full bg-black/60 text-white md:hidden"
      style={{
        top: 'max(12px, env(safe-area-inset-top))',
        right: 'max(12px, env(safe-area-inset-right))',
      }}
      aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen landscape'}
    >
      {isFullscreen ? (
        // Compress / exit-fullscreen icon
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M8 3v3a2 2 0 0 1-2 2H3" />
          <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
          <path d="M3 16h3a2 2 0 0 1 2 2v3" />
          <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
        </svg>
      ) : (
        // Expand / enter-fullscreen icon
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M8 3H5a2 2 0 0 0-2 2v3" />
          <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
          <path d="M3 16v3a2 2 0 0 0 2 2h3" />
          <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
        </svg>
      )}
    </button>
  );
}
