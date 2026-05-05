'use client';

import Image from 'next/image';
import Link from 'next/link';
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
import type { TMDBSeason, TMDBSeasonSummary } from '@/types/tmdb';

import { EpisodeGuide } from './episode-guide';

interface Props {
  backdropUrl: string;
  trailerKey: string | null;
  alt: string;
  embedUrl: string;
  seriesId: number;
  poster: string;
  posterPath: string | null;
  backdropPath: string | null;
  name: string;
  tagline?: string | null;
  yearRange: string;
  numberOfSeasons: number;
  rating: number;
  genres: { id: number; name: string }[];
  status: string;
  statusColor: string;
  providers: PreferredProviderKey[];
  creators: string;
  networks: string;
  overview: string | null;
  firstEpisodeSeason: number;
  firstEpisodeNumber: number;
  seasons: TMDBSeasonSummary[];
  initialSeason: TMDBSeason | null;
}

export function SeriesDetailHero({
  backdropUrl,
  trailerKey,
  alt,
  embedUrl,
  seriesId,
  poster,
  posterPath,
  backdropPath,
  name,
  tagline,
  yearRange,
  numberOfSeasons,
  rating,
  genres,
  status,
  statusColor,
  providers,
  creators,
  networks,
  overview,
  firstEpisodeSeason,
  firstEpisodeNumber,
  seasons,
  initialSeason,
}: Props) {
  const [playerActive, setPlayerActive] = useState(false);
  const [playerVisible, setPlayerVisible] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [episodePanelOpen, setEpisodePanelOpen] = useState(false);
  const { setControls } = usePlayerControls();

  // YouTube trailer state
  const [showVideo, setShowVideo] = useState(false);
  const [videoVisible, setVideoVisible] = useState(false);
  const [muted, setMuted] = useState(true);
  const [pageOrigin, setPageOrigin] = useState('');

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPageOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    if (!trailerKey || playerActive) return;
    const t = setTimeout(() => setShowVideo(true), 100);
    return () => clearTimeout(t);
  }, [trailerKey, playerActive]);

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

  useEffect(() => {
    if (!playerActive) {
      setPlayerVisible(false);
      return;
    }
    const t = setTimeout(() => setPlayerVisible(true), 50);
    return () => clearTimeout(t);
  }, [playerActive]);

  useEffect(() => {
    if (!playerActive) return;

    function onFsChange() {
      setIsFullscreen(!!document.fullscreenElement);
    }
    document.addEventListener('fullscreenchange', onFsChange);

    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      document.exitFullscreen().catch(() => {});
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
      playerContainerRef.current?.requestFullscreen().catch(() => {});
    }
  }, [isFullscreen]);

  const handleEpisodes = useCallback(() => {
    setEpisodePanelOpen((v) => !v);
  }, []);

  function handleWatchClick() {
    setPlayerActive(true);
  }

  // Register / unregister controls in topbar
  useEffect(() => {
    if (!playerActive || !playerVisible) {
      setControls(null);
      return;
    }
    setControls({
      isFullscreen,
      onFullscreen: handleFullscreen,
      ...(seasons.length > 0 && initialSeason ? { onEpisodes: handleEpisodes } : {}),
    });
    return () => setControls(null);
  }, [playerActive, playerVisible, isFullscreen, handleFullscreen, handleEpisodes, setControls]);

  return (
    <>
      {/* BACKDROP / PLAYER SECTION */}
      <div
        ref={playerContainerRef}
        className={cn(
          'relative overflow-hidden bg-black transition-[height] duration-500',
          playerActive
            ? 'h-[calc(45vh+4rem)] md:h-screen min-h-[200px]'
            : 'h-[calc(45vh+4rem)] md:h-[calc(55vh+9rem)] min-h-[200px] md:min-h-[320px]',
        )}
      >
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

        {!playerActive && (
          <Link
            href="/"
            className="absolute top-20 left-4 md:left-8 text-white/70 hover:text-white text-sm hidden md:flex items-center gap-1 transition-colors z-10"
          >
            ← Back
          </Link>
        )}

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

        {/* Exit-fullscreen + episodes overlay — only when fullscreen (topbar hidden) */}
        {playerActive && isFullscreen && (
          <div
            className={cn(
              'absolute z-20 flex items-center gap-2 transition-all duration-300',
              playerVisible ? 'opacity-100' : 'opacity-0',
            )}
            style={{
              top: 'max(12px, env(safe-area-inset-top))',
              right: 'max(12px, env(safe-area-inset-right))',
            }}
          >
            {seasons.length > 0 && initialSeason && (
              <button
                type="button"
                onClick={() => setEpisodePanelOpen((v) => !v)}
                className="flex items-center gap-1.5 bg-black/70 text-white text-xs font-medium px-3 py-2 rounded-full border border-white/20 hover:border-white/50 transition-all cursor-pointer"
                aria-label="Toggle episodes panel"
              >
                Episodes
              </button>
            )}
            <button
              type="button"
              onClick={handleFullscreen}
              className="flex items-center justify-center bg-black/70 text-white p-2 rounded-full border border-white/20 hover:border-white/50 transition-all duration-300 cursor-pointer"
              aria-label="Exit fullscreen"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M8 3v3a2 2 0 0 1-2 2H3" />
                <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
                <path d="M3 16h3a2 2 0 0 1 2 2v3" />
                <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
              </svg>
            </button>
          </div>
        )}

        {playerActive && (
          <WatchHistoryRecorder
            id={seriesId}
            type="series"
            title={name}
            posterPath={posterPath}
            backdropPath={backdropPath}
            year={yearRange.slice(0, 4)}
            season={firstEpisodeSeason}
            episode={firstEpisodeNumber}
          />
        )}

        {/* Episode panel — fixed right-side drawer, works in both fullscreen and normal mode */}
        {playerActive && episodePanelOpen && seasons.length > 0 && initialSeason && (
          <>
            <div
              className="fixed inset-0 z-[59] bg-black/60"
              onClick={() => setEpisodePanelOpen(false)}
              aria-hidden="true"
            />
            <div className="fixed top-0 right-0 bottom-0 z-[60] w-[26rem] max-w-[92vw] bg-[#0f0f10] border-l border-white/10 flex flex-col shadow-2xl animate-slide-in-right">
              <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-white/10 flex-none">
                <h2 className="text-white font-semibold font-body text-base">Episodes</h2>
                <button
                  type="button"
                  onClick={() => setEpisodePanelOpen(false)}
                  aria-label="Close episodes panel"
                  className="text-white/50 hover:text-white transition-colors p-1 cursor-pointer"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
              <div className="overflow-y-auto flex-1 px-4 py-4">
                <EpisodeGuide seriesId={seriesId} seasons={seasons} initialSeason={initialSeason} />
              </div>
            </div>
          </>
        )}
      </div>

      {/* CARD + SYNOPSIS */}
      <div
        className={cn(
          'px-4 md:px-8 relative z-10 transition-[margin-top] duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]',
          playerActive ? 'mt-4' : '-mt-36 md:-mt-60',
        )}
      >
        <div className="flex gap-4 md:gap-8 items-stretch">
          {/* POSTER */}
          <div className="flex-none w-24 md:w-40">
            {poster && (
              <div className="relative aspect-[2/3] w-full h-full rounded overflow-hidden shadow-2xl">
                <Image
                  src={poster}
                  alt={name}
                  fill
                  sizes="(max-width: 768px) 96px, 160px"
                  className="object-cover"
                />
              </div>
            )}
          </div>

          {/* DETAILS */}
          <div className="flex-1 min-w-0 flex flex-col justify-between">
            <div className="min-w-0">
              <h1 className="font-body text-xl md:text-4xl font-bold text-white leading-tight line-clamp-2">
                {name}
              </h1>

              {tagline && (
                <p className="hidden md:block mt-1 text-white/50 italic text-xs truncate">
                  {tagline}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-1 md:gap-2 mt-1 text-[10px] md:text-sm text-white/60">
                {yearRange && <span>{yearRange}</span>}
                {numberOfSeasons > 0 && (
                  <>
                    <span className="text-white/20">·</span>
                    <span>
                      {numberOfSeasons} {numberOfSeasons === 1 ? 'Season' : 'Seasons'}
                    </span>
                  </>
                )}
                {rating > 0 && (
                  <>
                    <span className="text-white/20">·</span>
                    <RatingBadge rating={rating} />
                  </>
                )}
              </div>

              <div className="flex flex-nowrap gap-1 md:gap-2 mt-2 overflow-x-auto no-scrollbar">
                {status && (
                  <span
                    className={cn(
                      'inline-flex items-center justify-center text-center whitespace-nowrap text-[9px] md:text-xs px-1.5 md:px-2 py-px md:py-0.5 rounded border font-medium',
                      statusColor,
                    )}
                  >
                    {status}
                  </span>
                )}
                {genres.slice(0, 3).map((g) => (
                  <TagChip key={g.id} label={g.name} />
                ))}
              </div>

              <WatchProvidersRow providers={providers} />
            </div>

            <div className="pt-2 flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleWatchClick}
                className="inline-flex items-center justify-center gap-2 flex-1 bg-white text-black font-semibold text-sm px-5 py-2 rounded-lg hover:bg-gray-200 transition-colors md:hidden cursor-pointer"
              >
                <span>▶</span> Watch
              </button>

              <button
                type="button"
                onClick={handleWatchClick}
                className="hidden md:inline-flex items-center justify-center gap-2 bg-white text-black font-semibold text-sm px-6 py-2.5 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer"
              >
                <span>▶</span> Watch
              </button>

              <WatchlistButton
                tmdbId={seriesId}
                mediaType="series"
                iconOnly
                className="md:hidden"
              />
              <WatchlistButton
                tmdbId={seriesId}
                mediaType="series"
                className="hidden md:inline-flex"
              />
            </div>
          </div>
        </div>

        {overview && (
          <div className="mt-5 md:mt-8 max-w-2xl">
            <ExpandableText text={overview} />
          </div>
        )}

        {creators && (
          <p className="mt-3 text-xs md:text-sm text-white/40">
            <span className="text-white/60">Created by</span>{' '}
            <span className="text-white/70">{creators}</span>
          </p>
        )}

        {networks && <p className="mt-1 text-xs text-white/40">{networks}</p>}
      </div>
    </>
  );
}
