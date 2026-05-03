'use client';

import { tmdbImage } from '@/lib/tmdb-image';
import {
  WATCH_HISTORY_MIN_ENTRIES,
  clearAllWatchHistory,
  getWatchHistory,
  syncWatchHistoryCookie,
} from '@/lib/watch-history';
import { SYNCED_EVENT } from '@/lib/watch-history';
import type { WatchHistoryEntry } from '@/lib/watch-history';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useLayoutEffect, useState } from 'react';

const MIN_ENTRIES = WATCH_HISTORY_MIN_ENTRIES;

function ContinueWatchingCard({ entry }: { entry: WatchHistoryEntry }) {
  const backdrop = tmdbImage(entry.backdropPath, 'w780');
  const poster = tmdbImage(entry.posterPath, 'w342');
  const href =
    entry.type === 'movie'
      ? `/movie/${entry.id}/watch`
      : `/series/${entry.id}/watch?s=${entry.season ?? 1}&e=${entry.episode ?? 1}`;

  return (
    <div className="group relative flex-none w-[130px] sm:w-[300px] md:w-[340px] lg:w-[380px] rounded-md overflow-hidden bg-white/5">
      <Link href={href} prefetch={false} className="block">
          {/* Mobile: portrait card with poster */}
          <div className="sm:hidden aspect-[2/3] relative overflow-hidden">
            {poster ? (
              <Image src={poster} alt={entry.title} fill sizes="130px" className="object-cover" />
            ) : (
              <div className="absolute inset-0 bg-white/5 flex items-center justify-center text-white/20 text-xs">
                No Image
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 px-2 pb-4 pt-2">
              <div className="flex items-center gap-1.5">
                <div className="flex items-center justify-center w-5 h-5 flex-none overflow-hidden rounded-full bg-white/15 border border-white/25 opacity-100 group-hover:w-0 group-hover:h-0 group-hover:opacity-0 group-hover:border-0 transition-all duration-300">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="white" aria-hidden="true" className="flex-none">
                    <polygon points="6,4 20,12 6,20" />
                  </svg>
                </div>
                <p className="text-white text-[10px] font-medium leading-tight line-clamp-2 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
                  {entry.title}
                </p>
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-white/20">
              <div className="h-full bg-white" style={{ width: `${entry.progress}%` }} />
            </div>
          </div>

        {/* Desktop: landscape card with backdrop */}
        <div className="hidden sm:block aspect-video relative overflow-hidden">
          {(backdrop ?? poster) ? (
            <Image
              src={(backdrop ?? poster) as string}
              alt={entry.title}
              fill
              sizes="(max-width: 1024px) 300px, 380px"
              className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
            />
          ) : (
            <div className="absolute inset-0 bg-white/5 flex items-center justify-center text-white/20 text-sm">
              No Image
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

          {/* Play button overlay (desktop only) */}
          <div className="hidden sm:flex absolute inset-0 items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
            <div className="relative w-14 h-14 rounded-full overflow-hidden bg-black/30 border-[1.5px] border-white/40 shadow-[0_0_12px_rgba(255,255,255,0.15)] group-hover:bg-black/40 group-hover:shadow-[0_0_14px_rgba(255,255,255,0.2)] transition-all duration-300 flex items-center justify-center">
              {/* Shine sweep */}
              <div
                className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out"
                style={{ background: 'linear-gradient(105deg, transparent 38%, rgba(255,255,255,0.1) 45%, rgba(255,255,255,0.15) 50%, rgba(255,255,255,0.1) 55%, transparent 62%)' }}
              />
              <svg width="26" height="26" viewBox="0 0 24 24" fill="white" aria-hidden="true">
                <polygon points="6,4 20,12 6,20" />
              </svg>
            </div>
          </div>

          {/* Title + play icon */}
          <div className="absolute bottom-0 left-0 right-0 px-2.5 pb-5 pt-2">
            <div className="flex items-center gap-1.5">
              <div className="hidden sm:flex items-center justify-center w-5 h-5 flex-none overflow-hidden rounded-full bg-white/15 border border-white/25 opacity-100 group-hover:w-0 group-hover:h-0 group-hover:opacity-0 group-hover:border-0 transition-all duration-300">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="white" aria-hidden="true" className="flex-none">
                  <polygon points="6,4 20,12 6,20" />
                </svg>
              </div>
              <p className="text-white text-sm font-medium leading-tight line-clamp-1 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
                {entry.title}
              </p>
            </div>
            {entry.year && (
              <span className="text-white/50 text-xs mt-0.5">
                {entry.type === 'series' ? 'Series · ' : ''}
                {entry.year}
              </span>
            )}
          </div>

          <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-white/20">
            <div className="h-full bg-white" style={{ width: `${entry.progress}%` }} />
          </div>
        </div>
      </Link>
    </div>
  );
}

export function ContinueWatchingCarousel({ hasHistory }: { hasHistory: boolean }) {
  // null = not yet read from localStorage; array = loaded (may be empty)
  const [items, setItems] = useState<WatchHistoryEntry[] | null>(null);

  useLayoutEffect(() => {
    const history = getWatchHistory();
    syncWatchHistoryCookie(history); // corrects stale cookies from prior sessions
    setItems(history);
  }, []);

  useEffect(() => {
    function onCleared() {
      setItems(getWatchHistory());
      syncWatchHistoryCookie([]);
    }
    function onSynced() {
      setItems(getWatchHistory());
    }
    window.addEventListener('watch-history-cleared', onCleared);
    window.addEventListener(SYNCED_EVENT, onSynced);
    return () => {
      window.removeEventListener('watch-history-cleared', onCleared);
      window.removeEventListener(SYNCED_EVENT, onSynced);
    };
  }, []);

  const loaded = items !== null;
  const visible = loaded && items.length >= MIN_ENTRIES;

  if (!loaded) {
    if (!hasHistory) return null;
    return (
      <section className="px-4 md:px-8 mt-6">
        {/* Identical element types + CSS classes as the real header — same line-height, same height */}
        <div className="flex items-center gap-2 mb-3">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            className="flex-shrink-0 text-transparent"
          >
            <polygon points="5,3 19,12 5,21" fill="currentColor" stroke="none" />
          </svg>
          <h2 className="font-semibold text-sm sm:text-base tracking-wide text-transparent select-none">
            Continue Watching
          </h2>
        </div>
        {/* Identical flex + pb-2 + card aspect-ratios as the real carousel row */}
        <div className="relative flex gap-2 overflow-x-hidden pb-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="flex-none w-[130px] sm:w-[300px] md:w-[340px] lg:w-[380px] rounded-md bg-white/5"
            >
              <div className="sm:hidden aspect-[2/3]" />
              <div className="hidden sm:block aspect-video" />
            </div>
          ))}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-7 h-7 rounded-full border-2 border-white/20 border-t-white animate-spin" />
          </div>
        </div>
      </section>
    );
  }

  if (!visible) return null;

  return (
    <section className="px-4 md:px-8 mt-6">
      <div className="flex items-center gap-2 mb-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            className="flex-shrink-0 text-white"
          >
            <polygon points="5,3 19,12 5,21" fill="currentColor" stroke="none" />
          </svg>
          <h2 className="min-w-0 truncate text-white font-semibold text-sm sm:text-base tracking-wide">
            Continue Watching
          </h2>
        </div>
        <button
          type="button"
          onClick={() => void clearAllWatchHistory()}
          aria-label="Clear watch history"
          className="hidden md:inline-flex flex-none text-xs font-medium text-white/35 hover:text-white/55 transition-colors px-1 py-0.5 -mr-1 cursor-pointer"
        >
          Clear
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
        {items.map((entry) => (
          <ContinueWatchingCard key={`${entry.type}-${entry.id}`} entry={entry} />
        ))}
      </div>
    </section>
  );
}
