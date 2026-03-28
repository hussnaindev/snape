'use client';

import { useEffect } from 'react';

interface TrailerModalProps {
  videoKey: string;
  onClose: () => void;
}

export function TrailerModal({ videoKey, onClose }: TrailerModalProps) {
  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const src = `https://www.youtube-nocookie.com/embed/${videoKey}?autoplay=1&modestbranding=1&rel=0&showinfo=0&iv_load_policy=3&color=white`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl mx-4 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          type="button"
          onClick={onClose}
          className="absolute -top-10 right-0 text-white/70 hover:text-white text-2xl"
        >
          ✕
        </button>
        <div className="aspect-video rounded overflow-hidden">
          <iframe
            src={src}
            allow="autoplay; fullscreen"
            allowFullScreen
            className="w-full h-full border-0"
            title="Trailer"
          />
        </div>
      </div>
    </div>
  );
}
