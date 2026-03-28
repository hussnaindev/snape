'use client';

import { useEffect, useState } from 'react';

interface PlayerModalProps {
  embedUrl: string;
  onClose: () => void;
}

export function PlayerModal({ embedUrl, onClose }: PlayerModalProps) {
  const [fillMode, setFillMode] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Lock to landscape on mobile when player opens
  useEffect(() => {
    type LockableOrientation = ScreenOrientation & { lock?(o: string): Promise<void> };
    (screen.orientation as LockableOrientation)?.lock?.('landscape').catch(() => {});
    return () => screen.orientation?.unlock();
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black/95 animate-fade-in flex items-center justify-center">
      {/* Video container — single iframe, container class swapped to avoid reload */}
      <div
        className={
          fillMode
            ? 'fixed inset-0 bg-black'
            : 'relative w-full max-w-5xl mx-4 animate-scale-in aspect-video rounded overflow-hidden bg-black'
        }
      >
        <iframe
          src={embedUrl}
          className="w-full h-full"
          allowFullScreen
          allow="autoplay; fullscreen"
          sandbox="allow-scripts allow-same-origin allow-presentation allow-fullscreen"
          title="Video player"
        />
      </div>

      {/* Controls — always anchored top-right */}
      <div className="fixed top-3 right-3 flex gap-2 z-[60]">
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
          onClick={onClose}
          className="bg-black/60 text-white text-sm px-3 py-1.5 rounded-full backdrop-blur-sm hover:bg-black/80 transition-colors"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
