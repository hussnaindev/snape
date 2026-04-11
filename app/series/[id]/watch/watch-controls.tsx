'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type ExtendedOrientation = ScreenOrientation & {
  lock?: (orientation: string) => Promise<void>;
  unlock?: () => void;
};

function releaseOrientation() {
  try {
    (screen.orientation as ExtendedOrientation).unlock?.();
  } catch {}
}

interface Props {
  seriesId: number;
}

export function WatchControls({ seriesId }: Props) {
  const router = useRouter();
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    document.documentElement.requestFullscreen().then(() => {
      if (window.innerHeight > window.innerWidth) {
        (screen.orientation as ExtendedOrientation).lock?.('landscape').catch(() => {});
      }
    }).catch(() => {});

    function onFsChange() {
      const inFs = !!document.fullscreenElement;
      setIsFullscreen(inFs);
      if (!inFs) releaseOrientation();
    }
    document.addEventListener('fullscreenchange', onFsChange);

    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      document.exitFullscreen().catch(() => {});
      releaseOrientation();
    };
  }, []);

  const handleBack = useCallback(async () => {
    await document.exitFullscreen().catch(() => {});
    releaseOrientation();
    router.push(`/series/${seriesId}`);
  }, [router, seriesId]);

  const toggleFullscreen = useCallback(async () => {
    if (isFullscreen) {
      await document.exitFullscreen().catch(() => {});
    } else {
      try {
        await document.documentElement.requestFullscreen();
        await (screen.orientation as ExtendedOrientation).lock?.('landscape').catch(() => {});
      } catch {}
    }
  }, [isFullscreen]);

  return (
    <>
      <button
        type="button"
        onClick={handleBack}
        className="absolute z-10 w-10 h-10 flex items-center justify-center rounded-full bg-black/60 text-white text-lg"
        style={{
          top: 'max(12px, env(safe-area-inset-top))',
          left: 'max(12px, env(safe-area-inset-left))',
        }}
        aria-label="Back"
      >
        ←
      </button>

      <button
        type="button"
        onClick={toggleFullscreen}
        className="absolute z-10 w-10 h-10 flex items-center justify-center rounded-full bg-black/60 text-white md:hidden"
        style={{
          top: 'max(12px, env(safe-area-inset-top))',
          right: 'max(56px, calc(env(safe-area-inset-right) + 56px))',
        }}
        aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen landscape'}
      >
        {isFullscreen ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M8 3v3a2 2 0 0 1-2 2H3" />
            <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
            <path d="M3 16h3a2 2 0 0 1 2 2v3" />
            <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M8 3H5a2 2 0 0 0-2 2v3" />
            <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
            <path d="M3 16v3a2 2 0 0 0 2 2h3" />
            <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
          </svg>
        )}
      </button>
    </>
  );
}
