'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

import { usePlayerControls } from '@/lib/player-controls-context';

import { AddCollectionToWatchlistButton } from '@/components/add-collection-to-watchlist-button';
import { ExpandableText } from '@/components/ui/expandable-text';
import { TagChip } from '@/components/ui/tag-chip';
import { WatchHistoryRecorder } from '@/components/watch-history-recorder';
import { cn } from '@/lib/utils';
import type { TMDBCollection } from '@/types/tmdb';

interface Props {
  collection: TMDBCollection;
  backdropUrl: string;
  poster: string;
  yearRange: string;
  genres: string[];
  embedUrl: string | null;
  firstMovieId: number | null;
  firstMoviePosterPath: string | null;
  firstMovieBackdropPath: string | null;
  firstMovieTitle: string | null;
  firstMovieYear: string;
  firstMovieVoteAverage: number;
}

export function CollectionDetailHero({
  collection,
  backdropUrl,
  poster,
  yearRange,
  genres,
  embedUrl,
  firstMovieId,
  firstMoviePosterPath,
  firstMovieBackdropPath,
  firstMovieTitle,
  firstMovieYear,
  firstMovieVoteAverage,
}: Props) {
  const [playerActive, setPlayerActive] = useState(false);
  const [playerVisible, setPlayerVisible] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { setControls } = usePlayerControls();

  const playerContainerRef = useRef<HTMLDivElement>(null);

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

  // Register / unregister controls in topbar
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
        {backdropUrl ? (
          <Image
            src={backdropUrl}
            alt={collection.name}
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

        {playerActive && embedUrl && (
          <iframe
            src={embedUrl}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            title={`${collection.name} — watch`}
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
            href="/search"
            className="absolute top-20 left-4 md:left-8 text-white/70 hover:text-white text-sm hidden md:flex items-center gap-1 transition-colors z-10"
          >
            ← Back
          </Link>
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

        {playerActive && firstMovieId && firstMovieTitle && (
          <WatchHistoryRecorder
            id={firstMovieId}
            type="movie"
            title={firstMovieTitle}
            posterPath={firstMoviePosterPath}
            backdropPath={firstMovieBackdropPath}
            year={firstMovieYear}
            vote_average={firstMovieVoteAverage}
          />
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
                  alt={collection.name}
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
                {collection.name}
              </h1>

              <div className="flex flex-wrap items-center gap-1 md:gap-2 mt-1 text-[10px] md:text-sm text-white/60">
                {yearRange && <span>{yearRange}</span>}
                {collection.parts.length > 0 && (
                  <>
                    <span className="text-white/20">·</span>
                    <span>{collection.parts.length} movies</span>
                  </>
                )}
              </div>

              {genres.length > 0 && (
                <div className="flex flex-nowrap gap-1 md:gap-2 mt-2 overflow-x-auto no-scrollbar">
                  {genres.map((label) => (
                    <TagChip key={label} label={label} />
                  ))}
                </div>
              )}
            </div>

            <div className="pt-2 flex items-center gap-2 shrink-0">
              {collection.parts.length > 0 && embedUrl && (
                <>
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
                </>
              )}

              <AddCollectionToWatchlistButton
                collection={collection}
                iconOnly
                className="md:hidden"
              />
              <AddCollectionToWatchlistButton
                collection={collection}
                className="hidden md:inline-flex"
              />
            </div>
          </div>
        </div>

        {collection.overview && (
          <div className="mt-5 md:mt-8 max-w-2xl">
            <ExpandableText text={collection.overview} />
          </div>
        )}
      </div>
    </>
  );
}
