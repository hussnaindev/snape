'use client';

import { tmdbImage } from '@/lib/tmdb-image';
import type { TMDBMovie } from '@/types/tmdb';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { RatingBadge } from './ui/rating-badge';

interface HeroSectionProps {
  movies: TMDBMovie[];
  trailerKeys?: Record<number, string | null>;
}

export function HeroSection({ movies, trailerKeys }: HeroSectionProps) {
  const [active, setActive] = useState(0);
  const [fading, setFading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [videoVisible, setVideoVisible] = useState(false);
  const [muted, setMuted] = useState(true);
  const [pageOrigin, setPageOrigin] = useState('');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    setPageOrigin(window.location.origin);
  }, []);
  const featured = movies.slice(0, 5).reverse();

  function goTo(index: number) {
    if (index === active) return;
    setFading(true);
    setExpanded(false);
    setTimeout(() => {
      setActive(index);
      setFading(false);
    }, 300);
  }

  // Auto-cycle every 60s
  useEffect(() => {
    const id = setInterval(() => {
      setFading(true);
      setExpanded(false);
      setTimeout(() => {
        setActive((prev) => (prev + 1) % featured.length);
        setFading(false);
      }, 300);
    }, 60000);
    return () => clearInterval(id);
  }, [featured.length]);

  // Reset video state when slide changes
  useEffect(() => {
    setShowVideo(false);
    setVideoVisible(false);
    setMuted(true);
  }, [active]);

  const movie = featured[active];
  const trailerKey = movie && trailerKeys ? (trailerKeys[movie.id] ?? null) : null;

  // Step 1 — mount the iframe after a short delay
  useEffect(() => {
    if (!trailerKey) return;
    const t = setTimeout(() => setShowVideo(true), 1500);
    return () => clearTimeout(t);
  }, [trailerKey]);

  // Step 2 — YouTube handshake + event listening
  useEffect(() => {
    if (!showVideo || !trailerKey) {
      setVideoVisible(false);
      return;
    }

    const iframe = iframeRef.current;
    if (!iframe) return;

    function initPlayer() {
      iframe?.contentWindow?.postMessage(JSON.stringify({ event: 'listening' }), 'https://www.youtube.com');
    }

    const fallback = setTimeout(() => setVideoVisible(true), 8000);

    function onMessage(e: MessageEvent) {
      try {
        const data: unknown =
          typeof e.data === 'string' ? (JSON.parse(e.data) as unknown) : e.data;
        if (!data || typeof data !== 'object') return;
        const { event, info } = data as { event?: unknown; info?: unknown };

        if (event === 'onStateChange' && info === 1) {
          clearTimeout(fallback);
          setVideoVisible(true);
        } else if (event === 'onError' && (info === 101 || info === 150)) {
          clearTimeout(fallback);
          setShowVideo(false);
        }
      } catch {
        // not a YouTube message
      }
    }

    iframe.addEventListener('load', initPlayer);
    initPlayer();
    window.addEventListener('message', onMessage);

    return () => {
      clearTimeout(fallback);
      iframe.removeEventListener('load', initPlayer);
      window.removeEventListener('message', onMessage);
    };
  }, [showVideo, trailerKey]);

  function handleMuteToggle() {
    if (iframeRef.current?.contentWindow) {
      const func = muted ? 'unMute' : 'mute';
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({ event: 'command', func, args: [] }),
        'https://www.youtube.com',
      );
    }
    setMuted((m) => !m);
  }

  const embedUrl = trailerKey
    ? `https://www.youtube.com/embed/${trailerKey}?autoplay=1&mute=1&controls=0&modestbranding=1&rel=0&showinfo=0&loop=1&playlist=${trailerKey}&iv_load_policy=3&enablejsapi=1${pageOrigin ? `&origin=${pageOrigin}` : ''}`
    : null;

  const touchStartX = useRef<number | null>(null);

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const dx = touchStartX.current - (e.changedTouches[0]?.clientX ?? touchStartX.current);
    if (Math.abs(dx) > 50) {
      goTo(dx > 0 ? (active + 1) % featured.length : (active - 1 + featured.length) % featured.length);
    }
    touchStartX.current = null;
  }

  if (!movie) return null;

  const backdrop = tmdbImage(movie.backdrop_path, 'original');
  const poster = tmdbImage(movie.poster_path, 'w500');
  const year = movie.release_date?.slice(0, 4) ?? '';

  return (
    <div
      className="relative h-[30vh] sm:h-[80vh] min-h-[260px] sm:min-h-[480px]"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Backdrop / Video — extends below hero bounds so it bleeds into carousel */}
      <div
        className={`absolute top-0 left-0 right-0 bottom-[-6rem] overflow-hidden -z-10 transition-opacity duration-300 ${fading ? 'opacity-0' : 'opacity-100'}`}
      >
        {/* Mobile: poster (portrait) */}
        {(poster || backdrop) && (
          <Image
            src={poster || backdrop!}
            alt={movie.title}
            fill
            priority
            sizes="100vw"
            className={`object-cover object-top sm:hidden transition-opacity duration-1000 ${videoVisible ? 'opacity-0' : 'opacity-100'}`}
          />
        )}
        {/* Desktop: backdrop — fades out when video is playing */}
        {(backdrop || poster) && (
          <Image
            src={backdrop || poster!}
            alt={movie.title}
            fill
            priority
            sizes="100vw"
            className={`object-cover hidden sm:block transition-opacity duration-1000 ${videoVisible ? 'opacity-0' : 'opacity-100'}`}
          />
        )}

        {/* YouTube trailer — desktop only, invisible until confirmed playing */}
        {embedUrl && showVideo && (
          <iframe
            ref={iframeRef}
            src={embedUrl}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            title={`${movie.title} trailer`}
            className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[177.78vh] h-[56.25vw] min-w-[130%] min-h-[130%] scale-[1.3] pointer-events-none transition-opacity duration-1000 ${videoVisible ? 'opacity-100' : 'opacity-0'}`}
          />
        )}

        {!backdrop && !poster && <div className="absolute inset-0 bg-white/5" />}

        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent" />
      </div>

      {/* Content */}
      <div
        className={`absolute -bottom-3 sm:bottom-0 left-0 right-0 px-3 sm:px-4 md:px-12 pb-0 sm:pb-2 transition-opacity duration-300 ${fading ? 'opacity-0' : 'opacity-100'}`}
      >
        <div className="max-w-xl">
          <h1 className="font-syne font-bold text-xl sm:text-4xl md:text-6xl text-white leading-tight">
            {movie.title}
          </h1>
          <div className="flex items-center gap-2 sm:gap-3 mt-2 sm:mt-3">
            {year && <span className="text-white/60 text-xs sm:text-sm">{year}</span>}
            {movie.vote_average > 0 && <RatingBadge rating={movie.vote_average} />}
          </div>
          {movie.overview && (
            <div className="hidden sm:block mt-3 max-w-md">
              <p className={`text-white/70 text-sm leading-relaxed ${expanded ? '' : 'line-clamp-3'}`}>
                {movie.overview}
              </p>
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="mt-1 text-white/50 hover:text-white text-xs transition-colors"
              >
                {expanded ? 'See less' : 'See more'}
              </button>
            </div>
          )}
          <div className="flex gap-2 sm:gap-3 mt-3 sm:mt-5">
            <Link
              href={`/movie/${movie.id}`}
              className="inline-flex items-center gap-1 sm:gap-2 bg-white text-black font-semibold text-[11px] sm:text-sm px-3 py-1.5 sm:px-5 sm:py-2.5 rounded-md sm:rounded-lg hover:bg-gray-200 transition-colors"
            >
              <span>▶</span> Watch
            </Link>
            <Link
              href={`/movie/${movie.id}`}
              className="inline-flex items-center gap-1 sm:gap-2 bg-white/10 text-white font-semibold text-[11px] sm:text-sm px-3 py-1.5 sm:px-5 sm:py-2.5 rounded-md sm:rounded-lg border border-white/20 hover:bg-white/20 transition-colors"
            >
              More Info
            </Link>
          </div>
        </div>
      </div>

      {/* Mute toggle — desktop only, shown when video is playing */}
      {videoVisible && trailerKey && (
        <button
          type="button"
          onClick={handleMuteToggle}
          className="absolute bottom-2 right-5 sm:bottom-14 sm:right-4 z-10 flex items-center justify-center w-8 h-8 rounded-full border border-white/40 bg-black/50 text-white/80 hover:text-white hover:border-white/70 transition-colors"
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

      {/* Dot indicators */}
      <div className="absolute -bottom-3 sm:bottom-2 right-3 sm:right-6 flex gap-2">
        {featured.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => goTo(i)}
            aria-label={`Go to slide ${i + 1}`}
            className={`w-2 h-2 rounded-full transition-all ${
              i === active ? 'bg-white w-6' : 'bg-white/30 hover:bg-white/60'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
