'use client';

import { useEffect, useRef, useState } from 'react';

interface WatchButtonsProps {
  embedUrl: string;
  fullWidth?: boolean;
}

export function WatchButtons({ embedUrl, fullWidth }: WatchButtonsProps) {
  const [active, setActive] = useState(false);
  const [fillMode, setFillMode] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  function handleWatch() {
    const el = containerRef.current;
    if (!el) return;
    el.requestFullscreen().catch(() => {
      window.open(embedUrl, '_blank');
    });
  }

  useEffect(() => {
    function onFullscreenChange() {
      const isFullscreen = !!document.fullscreenElement;
      setActive(isFullscreen);
      if (isFullscreen) {
        // Auto-rotate to landscape on mobile
        type LockableOrientation = ScreenOrientation & { lock?(o: string): Promise<void> };
        (screen.orientation as LockableOrientation)?.lock?.('landscape').catch(() => {});
      } else {
        screen.orientation?.unlock();
        setFillMode(false);
      }
    }
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

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

      {/* Fullscreen container */}
      <div
        ref={containerRef}
        className={`fixed inset-0 bg-black ${active ? 'z-50' : '-z-10 invisible'}`}
      >
        {active && (
          <>
            {/* Iframe wrapper — class-swapped to avoid reload on fill toggle */}
            <div
              className={
                fillMode
                  ? 'absolute inset-0'
                  : 'absolute inset-0 flex items-center justify-center'
              }
            >
              <div className={fillMode ? 'w-full h-full' : 'w-full aspect-video'}>
                <iframe
                  src={embedUrl}
                  className="w-full h-full"
                  allowFullScreen
                  allow="autoplay; fullscreen"
                  sandbox="allow-scripts allow-same-origin allow-presentation allow-fullscreen"
                  title="Video player"
                />
              </div>
            </div>

            {/* Player controls */}
            <div className="absolute top-3 right-3 flex gap-2 z-10">
              <button
                type="button"
                onClick={() => setFillMode((f) => !f)}
                className="bg-black/60 text-white text-xs font-medium px-3 py-1.5 rounded-full backdrop-blur-sm hover:bg-black/80 transition-colors"
                title={fillMode ? 'Restore aspect ratio' : 'Fill screen (removes black bars)'}
              >
                {fillMode ? 'Fit' : 'Fill'}
              </button>
              <button
                type="button"
                onClick={() => document.exitFullscreen()}
                className="bg-black/60 text-white text-xs px-3 py-1.5 rounded-full backdrop-blur-sm hover:bg-black/80 transition-colors"
              >
                ✕
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
