'use client';

import { AccountLayout } from '@/components/account-layout';
import { useAuth } from '@/components/auth/auth-provider';
import { tmdbImage, tmdbResponsive } from '@/lib/tmdb-image';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';

type WatchlistItem = {
  id: string;
  tmdbId: number;
  mediaType: 'movie' | 'series' | 'collection';
  addedAt: string;
};

type TMDBCard = {
  id: number;
  title?: string;
  name?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  mediaType: 'movie' | 'series' | 'collection';
  overview?: string;
};

type TabId = 'all' | 'movies' | 'series' | 'collections';

export default function WatchlistPage() {
  const { user, isLoading } = useAuth();
  const [cards, setCards] = useState<TMDBCard[]>([]);
  const [fetching, setFetching] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>('all');

  useEffect(() => {
    if (isLoading) return;
    if (!user) { setFetching(false); return; }

    fetch('/api/watchlist')
      .then((r) => r.json())
      .then(async (json) => {
        if (!json.ok) return;
        const wl = json.data as WatchlistItem[];
        const results = await Promise.all(
          wl.map(async (item) => {
            if (item.mediaType === 'collection') {
              try {
                const res = await fetch(`/api/tmdb/collection/${item.tmdbId}`);
                const d = await res.json();
                if (d.ok && d.data) {
                  const coll = d.data as { id: number; name: string; poster_path: string | null; backdrop_path: string | null; overview: string };
                  return { ...coll, mediaType: 'collection' as const };
                }
              } catch {}
              return null;
            }
            return fetch(`/api/tmdb/${item.mediaType === 'movie' ? 'movie' : 'tv'}/${item.tmdbId}`)
              .then((r) => r.json())
              .then((d) => (d.ok && d.data ? { ...d.data, mediaType: item.mediaType } : null) as TMDBCard | null)
              .catch(() => null);
          }),
        );
        setCards(results.filter((c): c is TMDBCard => c !== null && typeof c.id === 'number'));
      })
      .catch(() => {})
      .finally(() => setFetching(false));
  }, [user, isLoading]);

  async function removeItem(tmdbId: number, mediaType: 'movie' | 'series' | 'collection') {
    setCards((prev) => prev.filter((c) => !(c.id === tmdbId && c.mediaType === mediaType)));
    await fetch('/api/watchlist', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tmdbId, mediaType }),
    }).catch(() => {});
  }

  const filteredCards = cards.filter((c) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'movies') return c.mediaType === 'movie';
    if (activeTab === 'series') return c.mediaType === 'series';
    if (activeTab === 'collections') return c.mediaType === 'collection';
    return true;
  });

  const tabCounts = {
    all: cards.length,
    movies: cards.filter((c) => c.mediaType === 'movie').length,
    series: cards.filter((c) => c.mediaType === 'series').length,
    collections: cards.filter((c) => c.mediaType === 'collection').length,
  };

  return (
    <AccountLayout>
      <div className="px-4 md:px-8 py-6 md:py-8 pb-20">
        <h1 className="text-white text-2xl font-bold mb-6">My Watchlist</h1>

        {!user && !isLoading && (
          <Empty
            message="Login to save movies and shows to your watchlist"
            action={{ label: 'Login', href: '/auth/login' }}
          />
        )}

        {user && fetching && <SkeletonGrid />}

        {user && !fetching && cards.length === 0 && (
          <Empty
            message="Your watchlist is empty"
            action={{ label: 'Browse content', href: '/' }}
          />
        )}

        {user && !fetching && cards.length > 0 && (
          <>
            {/* Tabs */}
            <div className="flex gap-2 mb-6">
              {(['all', 'movies', 'series', 'collections'] as TabId[]).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    activeTab === tab
                      ? 'bg-white text-black'
                      : 'bg-white/5 text-white/70 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)} ({tabCounts[tab]})
                </button>
              ))}
            </div>

            {/* Cards */}
            <div className="flex flex-wrap gap-2 sm:gap-3">
              {filteredCards.map((card) => (
                <div
                  key={`${card.mediaType}-${card.id}`}
                  className="w-[130px] sm:w-[240px] md:w-[300px] lg:w-[340px]"
                >
                  <WatchlistCard card={card} onRemove={removeItem} />
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </AccountLayout>
  );
}

function WatchlistCard({
  card,
  onRemove,
}: {
  card: TMDBCard;
  onRemove: (id: number, type: 'movie' | 'series' | 'collection') => void;
}) {
  const title = card.title ?? card.name ?? '';
  const year = (card.release_date ?? card.first_air_date ?? '').slice(0, 4);
  const href = card.mediaType === 'collection'
    ? `/collection/${card.id}`
    : card.mediaType === 'movie'
      ? `/movie/${card.id}`
      : `/series/${card.id}`;
  const poster = tmdbImage(card.poster_path, 'w342');
  const backdrop = tmdbImage(card.backdrop_path, 'w780');

  return (
    <div className="group relative block overflow-hidden rounded-md bg-white/5 transition-all duration-300 ease-out sm:hover:scale-105 sm:hover:shadow-[0_8px_30px_rgba(0,0,0,0.6)] sm:hover:brightness-110 sm:hover:z-10">
      <Link href={href} prefetch={false} className="block h-full w-full">
        {/* Mobile: Poster (portrait) */}
        <div className="aspect-[2/3] overflow-hidden sm:hidden relative">
          {poster ? (
            <Image
              src={poster}
              alt={title}
              fill
              sizes="50vw"
              className="object-cover transition-transform duration-500 ease-out group-hover:scale-110"
            />
          ) : backdrop ? (
            <Image
              src={backdrop}
              alt={title}
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
              alt={title}
              fill
              sizes="(max-width: 1024px) 33vw, 25vw"
              className="object-cover transition-transform duration-500 ease-out group-hover:scale-110"
            />
          ) : poster ? (
            <Image
              src={poster}
              alt={title}
              fill
              sizes="(max-width: 1024px) 33vw, 25vw"
              className="object-cover transition-transform duration-500 ease-out group-hover:scale-110"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-white/5 text-white/20 text-sm">
              No Image
            </div>
          )}
        </div>

        {/* Type chip top-left */}
        <span className="absolute top-1 left-1.5 sm:top-1.5 sm:left-2 lg:top-2 lg:left-3 z-10 inline-flex items-center text-[7px] sm:text-[9px] lg:text-[10px] xl:text-[11px] font-semibold tracking-widest uppercase text-white/80 border border-white/40 rounded-full px-1.5 py-1 lg:px-2.5 lg:py-1.5 bg-black/60">
          {card.mediaType === 'movie' ? 'Film' : card.mediaType === 'series' ? 'Series' : 'Collection'}
        </span>

        {/* Rating chip top-right */}
        {card.vote_average !== undefined && card.vote_average > 0 && (
          <span className="absolute top-1 right-1.5 sm:top-1.5 sm:right-2 lg:top-2 lg:right-3 z-10 inline-flex items-center gap-1 rounded-full border border-white/40 px-1.5 py-1 lg:px-2.5 lg:py-1.5 text-[7px] sm:text-[9px] lg:text-[10px] xl:text-[11px] font-semibold tabular-nums text-white bg-black/60">
            ★ {card.vote_average.toFixed(1)}
          </span>
        )}

        {/* Title strip */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent flex flex-col justify-end px-1.5 py-1 sm:px-3 sm:py-2.5 lg:px-4 lg:py-3">
          <p className="text-white/90 text-[11px] sm:text-sm lg:text-[15px] xl:text-[16px] font-light tracking-[0.2em] leading-tight truncate uppercase drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
            {title}
          </p>
          {year && (
            <span className="text-white/50 text-[9px] sm:text-xs lg:text-sm mt-0.5 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
              {year}
            </span>
          )}
        </div>
      </Link>
      <button
        type="button"
        onClick={() => onRemove(card.id, card.mediaType)}
        aria-label="Remove from watchlist"
        className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/70 border border-white/20 text-white/60 hover:text-white hover:bg-black/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs"
      >
        ✕
      </button>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <>
      {/* Mobile skeleton */}
      <div className="md:hidden grid grid-cols-2 gap-2.5">
        {Array.from({ length: 9 }, (_, i) => (
          <div key={i} className="rounded-lg bg-white/5 aspect-[2/3] animate-pulse" />
        ))}
      </div>
      {/* Desktop skeleton */}
      <div className="hidden md:grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="rounded-xl bg-white/5 aspect-video animate-pulse" />
        ))}
      </div>
    </>
  );
}

function Empty({
  message,
  action,
}: {
  message: string;
  action: { label: string; href: string };
}) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <svg
        width="48"
        height="48"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-white/20"
        aria-hidden="true"
      >
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
      </svg>
      <p className="text-white/50 text-center max-w-xs text-sm">{message}</p>
      <Link
        href={action.href}
        className="px-6 py-2.5 bg-white/10 text-white text-sm font-medium rounded-lg hover:bg-white/15 transition-colors"
      >
        {action.label}
      </Link>
    </div>
  );
}
