'use client';

import { tmdbImage } from '@/lib/tmdb-image';
import type { TMDBMovie } from '@/types/tmdb';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { RatingBadge } from './ui/rating-badge';

interface MovieCardProps {
  movie: TMDBMovie;
  qualityBadge?: '4K' | 'HD' | null;
  imageSize?: string;
  className?: string;
}

export function MovieCard({ movie, qualityBadge, imageSize = 'w780', className }: MovieCardProps) {
  const [trailerKey, setTrailerKey] = useState<string | null>(null);
  const [showTrailer, setShowTrailer] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [videoVisible, setVideoVisible] = useState(false);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const isHoveringRef = useRef(false);
  const [pageOrigin, setPageOrigin] = useState('');

  // Initialize desktop check and page origin
  useEffect(() => {
    const isDesktopView = window.matchMedia('(min-width: 640px)').matches;
    setIsDesktop(isDesktopView);
    setPageOrigin(window.location.origin);
  }, []);

  // Fetch trailer on hover (desktop only)
  const handleMouseEnter = async () => {
    if (!isDesktop) return;

    isHoveringRef.current = true;

    // Clear any existing timeouts
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);

    // If trailer is already loaded, just show it
    if (trailerKey) {
      hoverTimeoutRef.current = setTimeout(() => setShowTrailer(true), 50);
      return;
    }

    // Fetch trailer
    try {
      const res = await fetch(`/api/videos/movie/${movie.id}`);
      if (!res.ok) throw new Error(`Failed to fetch trailer: ${res.status}`);
      const { ok, data } = await res.json();
      if (ok && data.trailerKey && isHoveringRef.current) {
        setTrailerKey(data.trailerKey);
        // Show trailer after a short delay for smooth transition
        hoverTimeoutRef.current = setTimeout(() => setShowTrailer(true), 50);
      }
    } catch (error) {
      console.error(`Failed to fetch trailer for movie ${movie.id}:`, error);
    }
  };

  const handleMouseLeave = () => {
    isHoveringRef.current = false;

    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }),
        'https://www.youtube.com',
      );
    }
    setShowTrailer(false);
    setVideoVisible(false);
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
  };

  // Pause video when showTrailer becomes false
  useEffect(() => {
    if (!showTrailer && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }),
        'https://www.youtube.com',
      );
    }
  }, [showTrailer]);

  // YouTube handshake + quality/visibility management
  useEffect(() => {
    if (!showTrailer || !trailerKey) {
      setVideoVisible(false);
      return;
    }

    const iframe = iframeRef.current;
    if (!iframe) return;

    function initPlayer() {
      iframe?.contentWindow?.postMessage(
        JSON.stringify({ event: 'listening' }),
        'https://www.youtube.com',
      );
    }

    const fallback = setTimeout(() => setVideoVisible(true), 5000);

    function onMessage(e: MessageEvent) {
      try {
        const data: unknown = typeof e.data === 'string' ? (JSON.parse(e.data) as unknown) : e.data;
        if (!data || typeof data !== 'object') return;
        const { event, info } = data as { event?: unknown; info?: unknown };

        if (event === 'onReady') {
          // Player is ready — set quality to 360p (480p resolution)
          iframe?.contentWindow?.postMessage(
            JSON.stringify({ event: 'command', func: 'setPlaybackQuality', args: ['small'] }),
            'https://www.youtube.com',
          );
        } else if (event === 'onStateChange' && info === 1) {
          clearTimeout(fallback);
          setVideoVisible(true);
        } else if (event === 'onError' && (info === 101 || info === 150)) {
          clearTimeout(fallback);
          setShowTrailer(false);
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
  }, [showTrailer, trailerKey]);

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
      if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
      if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }),
          'https://www.youtube.com',
        );
      }
    };
  }, []);

  const backdrop = tmdbImage(movie.backdrop_path, imageSize);
  const poster = tmdbImage(movie.poster_path, 'w342');
  const year = movie.release_date?.slice(0, 4) ?? '';

  const embedUrl = trailerKey
    ? `https://www.youtube.com/embed/${trailerKey}?autoplay=1&mute=1&controls=0&modestbranding=1&rel=0&showinfo=0&loop=1&playlist=${trailerKey}&iv_load_policy=3&enablejsapi=1${pageOrigin ? `&origin=${pageOrigin}` : ''}`
    : null;

  return (
    <div
      className={`group relative block overflow-hidden rounded-md bg-white/5 transition-all duration-300 ease-out sm:hover:scale-105 sm:hover:shadow-[0_8px_30px_rgba(0,0,0,0.6)] sm:hover:brightness-110 sm:hover:z-10 ${className ?? ''}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <Link href={`/movie/${movie.id}`} prefetch={false} className="block h-full w-full">
        {/* Mobile: Poster (portrait) */}
        <div className="aspect-[2/3] overflow-hidden sm:hidden">
          {poster ? (
            <Image
              src={poster}
              alt={movie.title}
              fill
              sizes="50vw"
              className="object-cover transition-transform duration-500 ease-out group-hover:scale-110"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-white/5 text-white/20 text-sm">
              No Image
            </div>
          )}
        </div>

        {/* Desktop: Backdrop (landscape) */}
        <div className="hidden sm:block aspect-video overflow-hidden relative">
          {backdrop ? (
            <Image
              src={backdrop}
              alt={movie.title}
              fill
              sizes="(max-width: 1024px) 33vw, 25vw"
              className={`object-cover transition-all duration-500 ease-out ${videoVisible ? 'opacity-0' : 'opacity-100'} ${!videoVisible && 'group-hover:scale-110'}`}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-white/5 text-white/20 text-sm">
              No Image
            </div>
          )}

          {/* Trailer preview on hover (desktop only) */}
          {embedUrl && showTrailer && (
            <iframe
              ref={iframeRef}
              src={embedUrl}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              title={`${movie.title} trailer`}
              className={`absolute inset-0 h-full w-full origin-center scale-[1.2] pointer-events-none transition-opacity duration-500 ${videoVisible ? 'opacity-100' : 'opacity-0'}`}
            />
          )}
        </div>

        {/* Quality badge */}
        {qualityBadge && (
          <span className="absolute top-2 left-2 bg-black/70 border border-white/30 text-white/80 text-[10px] font-bold px-1.5 py-0.5 rounded">
            {qualityBadge}
          </span>
        )}

        {/* Always-visible title strip */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent flex flex-col justify-end px-1.5 py-1 sm:px-3 sm:py-2.5">
          <p className="text-white text-[11px] sm:text-sm font-medium leading-tight line-clamp-2 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
            {movie.title}
          </p>
          <div className="flex items-center gap-1 mt-0.5">
            {year && (
              <span className="text-white/50 text-[9px] sm:text-xs drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
                {year}
              </span>
            )}
            {movie.vote_average > 0 && (
              <RatingBadge
                rating={movie.vote_average}
                className="text-[8px] px-0.5 py-0 sm:text-[11px] sm:px-1.5"
              />
            )}
          </div>
        </div>
      </Link>
    </div>
  );
}
