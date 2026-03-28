'use client';

import { useEffect } from 'react';

interface PlayerModalProps {
  embedUrl: string;
  onClose: () => void;
}

export function PlayerModal({ embedUrl, onClose }: PlayerModalProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 animate-fade-in">
      <div className="relative w-full max-w-5xl mx-4 animate-scale-in">
        <button
          type="button"
          onClick={onClose}
          className="absolute -top-10 right-0 text-white/70 hover:text-white text-2xl z-10"
        >
          ✕
        </button>
        <div className="relative aspect-video rounded overflow-hidden bg-black">
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
    </div>
  );
}
