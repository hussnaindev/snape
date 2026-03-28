'use client';

import { useEffect, useRef, useState } from 'react';

interface WatchButtonsProps {
  embedUrl: string;
  fullWidth?: boolean;
}

export function WatchButtons({ embedUrl, fullWidth }: WatchButtonsProps) {
  const [active, setActive] = useState(false);
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
      setActive(!!document.fullscreenElement);
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

      <div
        ref={containerRef}
        className={`fixed inset-0 bg-black ${active ? 'z-50' : '-z-10 invisible'}`}
      >
        {active && (
          <iframe
            src={embedUrl}
            className="w-full h-full"
            allowFullScreen
            allow="autoplay; fullscreen"
            sandbox="allow-scripts allow-same-origin allow-presentation allow-fullscreen"
            title="Video player"
          />
        )}
      </div>
    </>
  );
}
