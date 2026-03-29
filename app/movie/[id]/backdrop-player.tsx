'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

interface Props {
  backdropUrl: string;
  trailerKey: string | null;
  alt: string;
}

export function BackdropPlayer({ backdropUrl, trailerKey, alt }: Props) {
  // showVideo: iframe is mounted (after initial delay)
  // videoVisible: iframe has confirmed it's playing (safe to show)
  const [showVideo, setShowVideo] = useState(false);
  const [videoVisible, setVideoVisible] = useState(false);
  const [muted, setMuted] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Step 1 — mount the iframe after a short delay
  useEffect(() => {
    if (!trailerKey) return;
    const t = setTimeout(() => setShowVideo(true), 1500);
    return () => clearTimeout(t);
  }, [trailerKey]);

  // Step 2 — once iframe is mounted: handshake with YouTube, listen for events
  useEffect(() => {
    if (!showVideo || !trailerKey) {
      setVideoVisible(false);
      return;
    }

    const iframe = iframeRef.current;
    if (!iframe) return;

    // YouTube won't dispatch postMessage events until we send "listening"
    function initPlayer() {
      iframe?.contentWindow?.postMessage(JSON.stringify({ event: 'listening' }), '*');
    }

    // Fallback: if no event arrives in 8 s, reveal anyway (e.g. postMessage blocked)
    const fallback = setTimeout(() => setVideoVisible(true), 8000);

    function onMessage(e: MessageEvent) {
      try {
        const data: unknown =
          typeof e.data === 'string' ? (JSON.parse(e.data) as unknown) : e.data;
        if (!data || typeof data !== 'object') return;
        const { event, info } = data as { event?: unknown; info?: unknown };

        if (event === 'onStateChange' && info === 1) {
          // 1 = playing — safe to reveal the iframe
          clearTimeout(fallback);
          setVideoVisible(true);
        } else if (event === 'onError' && (info === 101 || info === 150)) {
          // Age-restricted or embedding disabled — abort, keep backdrop
          clearTimeout(fallback);
          setShowVideo(false);
        }
      } catch {
        // not a YouTube message
      }
    }

    iframe.addEventListener('load', initPlayer);
    // Also try immediately in case the iframe already loaded (cached)
    initPlayer();
    window.addEventListener('message', onMessage);

    return () => {
      clearTimeout(fallback);
      iframe.removeEventListener('load', initPlayer);
      window.removeEventListener('message', onMessage);
    };
  }, [showVideo, trailerKey]);

  const embedUrl = trailerKey
    ? `https://www.youtube-nocookie.com/embed/${trailerKey}?autoplay=1&mute=1&controls=0&modestbranding=1&rel=0&showinfo=0&loop=1&playlist=${trailerKey}&iv_load_policy=3&enablejsapi=1`
    : null;

  function handleMuteToggle() {
    if (iframeRef.current?.contentWindow) {
      const func = muted ? 'unMute' : 'mute';
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({ event: 'command', func, args: '' }),
        '*',
      );
    }
    setMuted((m) => !m);
  }

  return (
    <div className="relative h-[calc(45vh+4rem)] md:h-[calc(55vh+9rem)] min-h-[200px] md:min-h-[320px] overflow-hidden">
      {/* Backdrop image — fades out once video is confirmed playing */}
      {backdropUrl ? (
        <Image
          src={backdropUrl}
          alt={alt}
          fill
          priority
          sizes="100vw"
          className={`object-cover object-top transition-opacity duration-1000 ${videoVisible ? 'opacity-0' : 'opacity-100'}`}
        />
      ) : (
        <div className="absolute inset-0 bg-white/5" />
      )}

      {/* YouTube trailer — invisible until confirmed playing */}
      {embedUrl && showVideo && (
        <iframe
          ref={iframeRef}
          src={embedUrl}
          allow="autoplay; fullscreen"
          title={`${alt} trailer`}
          className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[177.78vh] h-[56.25vw] min-w-full min-h-full pointer-events-none transition-opacity duration-1000 ${videoVisible ? 'opacity-100' : 'opacity-0'}`}
        />
      )}

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent pointer-events-none" />

      {/* Back button — desktop only */}
      <Link
        href="/"
        className="absolute top-20 left-4 md:left-8 text-white/70 hover:text-white text-sm hidden md:flex items-center gap-1 transition-colors z-10"
      >
        ← Back
      </Link>

      {/* Mute toggle */}
      {videoVisible && trailerKey && (
        <button
          type="button"
          onClick={handleMuteToggle}
          className="absolute bottom-4 right-4 z-10 flex items-center justify-center w-8 h-8 rounded-full border border-white/40 bg-black/50 text-white/80 hover:text-white hover:border-white/70 transition-colors"
          aria-label={muted ? 'Unmute trailer' : 'Mute trailer'}
        >
          {muted ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M16.5 12A4.5 4.5 0 0 0 14 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
            </svg>
          )}
        </button>
      )}
    </div>
  );
}
