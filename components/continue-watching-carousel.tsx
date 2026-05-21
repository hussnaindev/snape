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
import { RatingBadge } from './ui/rating-badge';
import { useEffect, useLayoutEffect, useState } from 'react';

const MIN_ENTRIES = WATCH_HISTORY_MIN_ENTRIES;

function ContinueWatchingCard({ entry }: { entry: WatchHistoryEntry }) {
  const backdrop = tmdbImage(entry.backdropPath, 'w780');
  const poster = tmdbImage(entry.posterPath, 'w500');
  const href =
    entry.type === 'movie'
      ? `/movie/${entry.id}?autoplay=true`
      : `/series/${entry.id}?autoplay=true&s=${entry.season ?? 1}&e=${entry.episode ?? 1}`;

  return (
    <Link
      href={href}
      prefetch={false}
      className="group relative flex-none w-[130px] sm:w-[300px] md:w-[340px] lg:w-[380px] overflow-hidden rounded-2xl sm:rounded-[28px] bg-white/5 transition-all duration-300 ease-out ring-1 sm:ring-2 ring-white/25 shadow-[0_8px_24px_rgba(255,255,255,0.08),_0_2px_6px_rgba(255,255,255,0.05)] hover:-translate-y-1 hover:ring-white/35 hover:shadow-[0_12px_36px_rgba(255,255,255,0.13)] hover:z-10"
    >
      {/* Mobile: portrait card with poster */}
      <div className="sm:hidden aspect-[2/3] relative overflow-hidden">
        {poster ? (
          <Image
            src={poster}
            alt={entry.title}
            fill
            sizes="130px"
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-110"
          />
        ) : (
          <div className="absolute inset-0 bg-white/5 flex items-center justify-center text-white/20 text-xs">
            No Image
          </div>
        )}

        {/* Play overlay on hover */}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
          <div className="w-12 h-12 rounded-full border border-white/50 bg-black/30 flex items-center justify-center shadow-[0_0_20px_rgba(255,255,255,0.12)]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white" aria-hidden="true">
              <polygon points="6,4 20,12 6,20" />
            </svg>
          </div>
        </div>

        {/* Bottom gradient — type badge + title + rating */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent px-2.5 pt-8 pb-2.5">
          <span className="text-[8px] sm:text-[9px] font-semibold tracking-widest uppercase text-white/45 block mb-0.5">
            {entry.type === 'movie' ? 'Film' : 'Series'}
          </span>
          <p className="text-white text-[11px] sm:text-[13px] font-chesna-grotesk font-medium line-clamp-2 leading-snug">
            {entry.title}
          </p>
          {entry.vote_average > 0 && (
            <RatingBadge rating={entry.vote_average} className="text-[8px] sm:text-[9px] px-1 py-px mt-1.5" />
          )}
        </div>

        {/* Progress bar */}
        <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-white/20">
          <div className="h-full bg-gradient-to-r from-red-900 via-[#E50914] to-red-400" style={{ width: `${entry.progress}%` }} />
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
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-110"
          />
        ) : (
          <div className="absolute inset-0 bg-white/5 flex items-center justify-center text-white/20 text-sm">
            No Image
          </div>
        )}

        {/* Play overlay on hover */}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
          <div className="w-12 h-12 rounded-full border border-white/50 bg-black/30 flex items-center justify-center shadow-[0_0_20px_rgba(255,255,255,0.12)]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white" aria-hidden="true">
              <polygon points="6,4 20,12 6,20" />
            </svg>
          </div>
        </div>

        {/* Bottom gradient — title + type badge + rating */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent px-4 pt-8 pb-2.5">
          <p className="text-[16px] font-chesna-grotesk tracking-wide leading-tight truncate max-w-[200px] text-white mb-1">
            {entry.title}
          </p>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="text-[10px] font-semibold tracking-widest uppercase text-white/50">
              {entry.type === 'movie' ? 'Film' : 'Series'}
            </span>
            {entry.vote_average > 0 && (
              <RatingBadge rating={entry.vote_average} className="text-[11px] px-1 py-px flex-none" />
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-white/20">
          <div className="h-full bg-gradient-to-r from-red-900 via-[#E50914] to-red-400" style={{ width: `${entry.progress}%` }} />
        </div>
      </div>
    </Link>
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
        <div className="relative flex gap-1.5 overflow-x-hidden pt-3 sm:pt-4 pb-3 sm:pb-4 px-1 sm:px-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="flex-none w-[130px] sm:w-[300px] md:w-[340px] lg:w-[380px] rounded-2xl sm:rounded-[28px] bg-white/5"
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

      <div className="flex gap-1.5 overflow-x-auto no-scrollbar pt-3 sm:pt-4 pb-3 sm:pb-4 px-1 sm:px-2">
        {items.map((entry) => (
          <ContinueWatchingCard key={`${entry.type}-${entry.id}`} entry={entry} />
        ))}
      </div>
    </section>
  );
}
