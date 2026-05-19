'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { usePlayerControls } from '@/lib/player-controls-context';

import { ExpandableText } from '@/components/ui/expandable-text';
import { RatingBadge } from '@/components/ui/rating-badge';
import { TagChip } from '@/components/ui/tag-chip';
import { WatchHistoryRecorder } from '@/components/watch-history-recorder';
import { WatchProvidersRow } from '@/components/watch-providers-row';
import { WatchlistButton } from '@/components/watchlist-button';
import { cn } from '@/lib/utils';
import type { PreferredProviderKey } from '@/lib/watch-providers';

interface Props {
  backdropUrl: string;
  trailerKey: string | null;
  alt: string;
  embedUrl: string;
  movieId: number;
  poster: string;
  posterPath: string | null;
  backdropPath: string | null;
  title: string;
  tagline?: string | null;
  year: string;
  runtime: string | null;
  rating: number;
  genres: { id: number; name: string }[];
  providers: PreferredProviderKey[];
  overview: string | null;
}

export function MovieDetailHero({
  backdropUrl,
  trailerKey,
  alt,
  embedUrl,
  movieId,
  poster,
  posterPath,
  backdropPath,
  title,
  tagline,
  year,
  runtime,
  rating,
  genres,
  providers,
  overview,
}: Props) {
  const [playerActive, setPlayerActive] = useState(false);
  const [playerVisible, setPlayerVisible] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { setControls } = usePlayerControls();
  const searchParams = useSearchParams();

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const autoPlayRef = useRef(false);

  // Auto-trigger player when navigated from watch history (?autoplay=true)
  useEffect(() => {
    if (searchParams.get('autoplay') === 'true' && !autoPlayRef.current) {
      autoPlayRef.current = true;
      setPlayerActive(true);
      setTimeout(() => {
        playerContainerRef.current
          ?.requestFullscreen()
          .then(() =>
            (screen.orientation as unknown as { lock?: (o: string) => Promise<void> }).lock?.(
              'landscape',
            )?.catch(() => {}),
          )
          .catch(() => {});
      }, 300);
    }
  }, [searchParams]);

  const [showVideo, setShowVideo] = useState(false);
  const [videoVisible, setVideoVisible] = useState(false);
  const [muted, setMuted] = useState(true);
  const [pageOrigin, setPageOrigin] = useState('');

  useEffect(() => {
    setPageOrigin(window.location.origin);
  }, []);

  // YouTube: mount iframe shortly after page load
  useEffect(() => {
    if (!trailerKey || playerActive) return;
    const t = setTimeout(() => setShowVideo(true), 100);
    return () => clearTimeout(t);
  }, [trailerKey, playerActive]);

  // YouTube: postMessage handshake
  useEffect(() => {
    if (!showVideo || !trailerKey || playerActive) {
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

    const fallback = setTimeout(() => setVideoVisible(true), 8000);

    function onMessage(e: MessageEvent) {
      try {
        const data: unknown = typeof e.data === 'string' ? (JSON.parse(e.data) as unknown) : e.data;
        if (!data || typeof data !== 'object') return;
        const { event, info } = data as { event?: unknown; info?: unknown };
        if (event === 'onReady') {
          iframe?.contentWindow?.postMessage(
            JSON.stringify({ event: 'command', func: 'setPlaybackQuality', args: ['hd1080'] }),
            'https://www.youtube.com',
          );
        } else if (event === 'onStateChange' && info === 1) {
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
  }, [showVideo, trailerKey, playerActive]);

  // peachify player: fade in after mount
  useEffect(() => {
    if (!playerActive) {
      setPlayerVisible(false);
      return;
    }
    const t = setTimeout(() => setPlayerVisible(true), 50);
    return () => clearTimeout(t);
  }, [playerActive]);

  // Fullscreen tracking + cleanup
  useEffect(() => {
    if (!playerActive) return;

    function onFsChange() {
      const inFs = !!document.fullscreenElement;
      setIsFullscreen(inFs);
      if (!inFs) screen.orientation.unlock();
    }
    document.addEventListener('fullscreenchange', onFsChange);

    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      document.exitFullscreen().catch(() => {});
      screen.orientation.unlock();
    };
  }, [playerActive]);

  const embedYtUrl = trailerKey
    ? `https://www.youtube.com/embed/${trailerKey}?vq=hd1080&autoplay=1&mute=1&controls=0&modestbranding=1&rel=0&showinfo=0&loop=1&playlist=${trailerKey}&iv_load_policy=3&enablejsapi=1${pageOrigin ? `&origin=${pageOrigin}` : ''}`
    : null;

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

  const handleFullscreen = useCallback(() => {
    if (isFullscreen) {
      document.exitFullscreen().catch(() => {});
    } else {
      playerContainerRef.current
        ?.requestFullscreen()
        .then(() =>
          (screen.orientation as unknown as { lock?: (o: string) => Promise<void> }).lock?.(
            'landscape',
          )?.catch(() => {}),
        )
        .catch(() => {});
    }
  }, [isFullscreen]);

  function handleWatchClick() {
    setPlayerActive(true);
  }

  // Register / unregister fullscreen button in topbar
  useEffect(() => {
    if (!playerActive || !playerVisible) {
      setControls(null);
      return;
    }
    setControls({ isFullscreen, onFullscreen: handleFullscreen });
    return () => setControls(null);
  }, [playerActive, playerVisible, isFullscreen, handleFullscreen, setControls]);

  return (
    <>
      {/* BACKDROP / PLAYER SECTION */}
      <div
        ref={playerContainerRef}
        className={cn(
          'relative overflow-hidden bg-black transition-[height] duration-500',
          playerActive
            ? 'h-[calc(45vh+4rem)] md:h-screen min-h-[200px]'
            : 'h-[calc(30vh+4rem)] md:h-[calc(55vh+9rem)] min-h-[200px] md:min-h-[320px]',
        )}
      >
        {/* Backdrop image */}
        {backdropUrl ? (
          <Image
            src={backdropUrl}
            alt={alt}
            fill
            priority
            sizes="100vw"
            className={cn(
              'object-cover object-top transition-opacity duration-700',
              playerActive && playerVisible ? 'opacity-0' : '',
            )}
          />
        ) : (
          <div className="absolute inset-0 bg-white/5" />
        )}

        {/* YouTube trailer — hidden (not unmounted) when player is active */}
        {embedYtUrl && showVideo && (
          <iframe
            ref={iframeRef}
            src={embedYtUrl}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            title={`${alt} trailer`}
            className={cn(
              'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[177.78vh] h-[56.25vw] min-w-[130%] min-h-[130%] scale-[1.3] pointer-events-none transition-opacity duration-700',
              videoVisible && !playerActive ? 'opacity-100' : 'opacity-0',
            )}
          />
        )}

        {/* peachify inline player */}
        {playerActive && (
          <iframe
            src={embedUrl}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            title={`${alt} — watch`}
            className={cn(
              'absolute inset-0 w-full h-full transition-opacity duration-700',
              playerVisible ? 'opacity-100' : 'opacity-0',
            )}
          />
        )}

        {/* Full gradient overlay — fades out when player is active */}
        <div
          className={cn(
            'absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent pointer-events-none transition-opacity duration-500',
            playerActive && playerVisible ? 'opacity-0' : '',
          )}
        />

        {/* Bottom fade — hidden in fullscreen so video fills edge-to-edge */}
        {!isFullscreen && (
          <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-black to-transparent pointer-events-none" />
        )}

        {/* Back button (desktop) — hidden when player active */}
        {!playerActive && (
          <Link
            href="/"
            className="absolute top-20 left-4 md:left-8 text-white/70 hover:text-white text-sm hidden md:flex items-center gap-1 transition-colors z-10"
          >
            ← Back
          </Link>
        )}

        {/* Mute toggle — YouTube trailer only */}
        {videoVisible && trailerKey && !playerActive && (
          <button
            type="button"
            onClick={handleMuteToggle}
            className="absolute bottom-40 sm:bottom-4 right-4 z-30 flex items-center justify-center w-8 h-8 rounded-full border border-white/40 bg-black/50 text-white/80 hover:text-white hover:border-white/70 transition-colors"
            aria-label={muted ? 'Unmute trailer' : 'Mute trailer'}
          >
            {muted ? (
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M16.5 12A4.5 4.5 0 0 0 14 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
              </svg>
            ) : (
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
              </svg>
            )}
          </button>
        )}

        {/* Exit-fullscreen overlay — only when fullscreen (topbar hidden) */}
        {playerActive && isFullscreen && (
          <button
            type="button"
            onClick={handleFullscreen}
            className={cn(
              'absolute z-20 flex items-center justify-center bg-black/70 text-white p-2 rounded-full border border-white/20 hover:border-white/50 transition-all duration-300',
              playerVisible ? 'opacity-100' : 'opacity-0',
            )}
            style={{
              top: 'max(12px, env(safe-area-inset-top))',
              right: 'max(12px, env(safe-area-inset-right))',
            }}
            aria-label="Exit fullscreen"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M8 3v3a2 2 0 0 1-2 2H3" />
              <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
              <path d="M3 16h3a2 2 0 0 1 2 2v3" />
              <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
            </svg>
          </button>
        )}

        {/* Watch history */}
        {playerActive && (
          <WatchHistoryRecorder
            id={movieId}
            type="movie"
            title={title}
            posterPath={posterPath}
            backdropPath={backdropPath}
            year={year}
            vote_average={rating}
          />
        )}
      </div>

      {/* CARD + SYNOPSIS — slides down when player is active */}
      <div
        className={cn(
          'px-4 md:px-8 relative z-10 transition-[margin-top] duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]',
          playerActive ? 'mt-4' : '-mt-36 md:-mt-60',
        )}
      >
        {/* MAIN ROW */}
        <div className="flex gap-4 md:gap-8 items-stretch">
          {/* POSTER */}
          <div className="flex-none w-24 md:w-40">
            {poster && (
              <div className="relative aspect-[2/3] w-full h-full rounded overflow-hidden shadow-2xl">
                <Image
                  src={poster}
                  alt={title}
                  fill
                  sizes="(max-width: 768px) 96px, 160px"
                  className="object-cover"
                />
              </div>
            )}
          </div>

          {/* DETAILS */}
          <div className="flex-1 min-w-0 flex flex-col justify-between">
            {/* TOP CONTENT */}
            <div className="min-w-0">
              <h1 className="font-body text-xl md:text-4xl font-bold text-white leading-tight line-clamp-2">
                {title}
              </h1>

              {tagline && (
                <p className="hidden md:block mt-1 text-white/50 italic text-xs truncate">
                  {tagline}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-1 md:gap-2 mt-1 text-[10px] md:text-sm text-white/60">
                {year && <span>{year}</span>}
                {runtime && (
                  <>
                    <span className="text-white/20">·</span>
                    <span>{runtime}</span>
                  </>
                )}
                {rating > 0 && (
                  <>
                    <span className="text-white/20">·</span>
                    <RatingBadge rating={rating} />
                  </>
                )}
              </div>

              {genres.length > 0 && (
                <div className="flex flex-nowrap gap-1 md:gap-2 mt-2 overflow-x-auto no-scrollbar">
                  {genres.slice(0, 3).map((g) => (
                    <TagChip key={g.id} label={g.name} />
                  ))}
                </div>
              )}

              <WatchProvidersRow providers={providers} />
            </div>

            {/* BOTTOM ACTIONS */}
            <div className="pt-2 flex items-center gap-2 shrink-0">
              {/* Mobile full-width watch button */}
              <button
                type="button"
                onClick={handleWatchClick}
                className="inline-flex items-center justify-center gap-2 flex-1 bg-white text-black font-semibold text-sm px-5 py-2 rounded-lg hover:bg-gray-200 transition-colors md:hidden cursor-pointer"
              >
                <span>▶</span> Watch
              </button>

              {/* Desktop watch button */}
              <button
                type="button"
                onClick={handleWatchClick}
                className="hidden md:inline-flex items-center gap-2 bg-white text-black font-semibold text-sm px-6 py-2.5 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer"
              >
                <span>▶</span> Watch
              </button>

              <WatchlistButton tmdbId={movieId} mediaType="movie" iconOnly className="md:hidden" />
              <WatchlistButton
                tmdbId={movieId}
                mediaType="movie"
                className="hidden md:inline-flex"
              />
            </div>
          </div>
        </div>

        {/* SYNOPSIS */}
        {overview && (
          <div className="mt-5 md:mt-8 max-w-2xl">
            <ExpandableText text={overview} />
          </div>
        )}
      </div>
    </>
  );
}
