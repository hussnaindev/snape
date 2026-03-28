'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface WatchButtonsProps {
  embedUrl: string;
  fullWidth?: boolean;
}

type ExtendedOrientation = ScreenOrientation & {
  lock?: (orientation: string) => Promise<void>;
  unlock?: () => void;
};

export function WatchButtons({ embedUrl, fullWidth }: WatchButtonsProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const exitPlayer = useCallback(async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => {});
    }
    try {
      (screen.orientation as ExtendedOrientation).unlock?.();
    } catch {}
    setIsPlaying(false);
  }, []);

  async function handleWatch() {
    setIsPlaying(true);
    const el = containerRef.current;
    if (!el) return;
    try {
      await el.requestFullscreen();
      // Lock to landscape on mobile (Android Chrome; iOS ignores this)
      await (screen.orientation as ExtendedOrientation).lock?.('landscape').catch(() => {});
    } catch {
      // iOS Safari: requestFullscreen not supported — overlay stays as fixed inset-0
    }
  }

  useEffect(() => {
    function onFullscreenChange() {
      // User exited fullscreen via browser UI or the player's own resize button
      if (!document.fullscreenElement && isPlaying) {
        try {
          (screen.orientation as ExtendedOrientation).unlock?.();
        } catch {}
        setIsPlaying(false);
      }
    }
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, [isPlaying]);

  return (
    <>
      <div className="flex gap-3 flex-wrap">
        <button
          type="button"
          onClick={handleWatch}
          className={`inline-flex items-center gap-2 bg-white text-black font-semibold text-sm px-6 py-2.5 rounded-lg hover:bg-gray-200 transition-colors${fullWidth ? ' w-full justify-center' : ''}`}
        >
          <span>▶</span> Watch
        </button>
      </div>

      {/* Player container — requestFullscreen target */}
      <div
        ref={containerRef}
        className={`fixed inset-0 bg-black ${isPlaying ? 'z-50' : '-z-10 invisible'}`}
      >
        {isPlaying && (
          <>
            {/*
              Pad the bottom by the safe-area inset so the player's own controls
              (play/pause bar) aren't hidden behind the iOS home indicator.
            */}
            <div
              className="absolute inset-0"
              style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
            >
              <iframe
                src={embedUrl}
                className="w-full h-full"
                allowFullScreen
                allow="autoplay; fullscreen; accelerometer; gyroscope; picture-in-picture"
                sandbox="allow-scripts allow-same-origin allow-presentation allow-fullscreen"
                title="Video player"
              />
            </div>

            {/*
              Controls overlay — pointer-events-none so all touches pass through
              to the iframe. Only the close button re-enables pointer events.
            */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}
            >
              <div className="flex items-start justify-between px-3">
                <button
                  type="button"
                  onClick={exitPlayer}
                  className="pointer-events-auto w-10 h-10 flex items-center justify-center rounded-full bg-black/60 text-white text-base leading-none"
                  aria-label="Exit player"
                >
                  ✕
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
