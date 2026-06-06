'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

import { usePlayerControls } from '@/lib/player-controls-context';

import { AddCollectionToWatchlistButton } from '@/components/add-collection-to-watchlist-button';
import { PeachifyPlayer } from '@/components/peachify-player';
import { ExpandableText } from '@/components/ui/expandable-text';
import { TagChip } from '@/components/ui/tag-chip';
import { WatchHistoryRecorder } from '@/components/watch-history-recorder';
import { registerParallax } from '@/lib/parallax-controller';
import { cn } from '@/lib/utils';
import type { TMDBCollection } from '@/types/tmdb';

interface Props {
  collection: TMDBCollection;
  backdropUrl: string;
  poster: string;
  yearRange: string;
  genres: string[];
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

  const sectionRef = useRef<HTMLElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const metaRef = useRef<HTMLDivElement>(null);
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

  // Parallax: backdrop vertical movement
  useEffect(() => {
    const el = backdropRef.current;
    const section = sectionRef.current;
    if (!el || !section) return;
    return registerParallax(el, section, (t) => {
      el.style.transform = `translate3d(0, ${(t - 0.5) * 360}px, 0)`;
    });
  }, []);

  // Parallax: metadata horizontal movement
  useEffect(() => {
    const el = metaRef.current;
    const section = sectionRef.current;
    if (!el || !section) return;
    return registerParallax(el, section, (t) => {
      el.style.transform = `translate3d(${(t - 0.5) * -120}px, 0, 0)`;
    });
  }, []);

  return (
    <section ref={sectionRef}>
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
        <div ref={backdropRef} className="absolute inset-0">
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
        </div>

        {playerActive && firstMovieId && (
          <PeachifyPlayer
            type="movie"
            tmdbId={firstMovieId}
            title={collection.name}
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
        ref={metaRef}
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
              <h1 className="font-chesna-grotesk text-xl md:text-4xl font-light text-white opacity-90 leading-tight line-clamp-2 uppercase tracking-[0.2em] [text-shadow:0_0_8px_rgba(255,255,255,0.15)]">
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
                <div className="flex flex-nowrap items-center gap-1 md:gap-2 mt-2 overflow-x-auto no-scrollbar">
                  {genres.map((label) => (
                    <TagChip key={label} label={label} className="text-[9px] md:text-[10px]" />
                  ))}
                </div>
              )}
            </div>

            <div className="pt-2 flex items-center gap-2 shrink-0">
              {collection.parts.length > 0 && firstMovieId && (
                <>
                  <button
                    type="button"
                    onClick={handleWatchClick}
                    className="relative top-0 flex-1 inline-flex items-center justify-center gap-2 text-nowrap rounded-full border py-0.5 text-xs font-semibold uppercase leading-tight tracking-widest transition-all duration-300 ease-out cursor-pointer active:top-0.5 h-10 px-3 min-w-36 border-transparent bg-white text-black lg:hover:bg-white/80 active:bg-white/70 md:hidden"
                  >
                    <span>▶</span>
                    <span className="px-2">Watch</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleWatchClick}
                    className="relative top-0 hidden md:inline-flex items-center justify-center gap-2 text-nowrap rounded-full border py-0.5 text-xs font-semibold uppercase leading-tight tracking-widest transition-all duration-300 ease-out cursor-pointer active:top-0.5 h-10 px-3 md:h-12 md:px-5 min-w-36 border-transparent bg-white text-black lg:hover:bg-white/80 active:bg-white/70"
                  >
                    <span>▶</span>
                    <span className="px-2">Watch</span>
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
    </section>
  );
}
