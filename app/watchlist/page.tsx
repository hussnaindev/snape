'use client';

import { AccountLayout } from '@/components/account-layout';
import { useAuth } from '@/components/auth/auth-provider';
import { tmdbImage } from '@/lib/tmdb-image';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';

type WatchlistItem = {
  id: string;
  tmdbId: number;
  mediaType: 'movie' | 'series';
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
  mediaType: 'movie' | 'series';
};

export default function WatchlistPage() {
  const { user, isLoading } = useAuth();
  const [cards, setCards] = useState<TMDBCard[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (isLoading) return;
    if (!user) { setFetching(false); return; }

    fetch('/api/watchlist')
      .then((r) => r.json())
      .then(async (json) => {
        if (!json.ok) return;
        const wl = json.data as WatchlistItem[];
        const results = await Promise.all(
          wl.map((item) =>
            fetch(`/api/tmdb/${item.mediaType === 'movie' ? 'movie' : 'tv'}/${item.tmdbId}`)
              .then((r) => r.json())
              .then((d) => (d.ok && d.data ? { ...d.data, mediaType: item.mediaType } : null) as TMDBCard | null)
              .catch(() => null),
          ),
        );
        setCards(results.filter((c): c is TMDBCard => c !== null && typeof c.id === 'number'));
      })
      .catch(() => {})
      .finally(() => setFetching(false));
  }, [user, isLoading]);

  async function removeItem(tmdbId: number, mediaType: 'movie' | 'series') {
    setCards((prev) => prev.filter((c) => !(c.id === tmdbId && c.mediaType === mediaType)));
    await fetch('/api/watchlist', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tmdbId, mediaType }),
    }).catch(() => {});
  }

  return (
    <AccountLayout>
      <div className="px-4 md:px-8 py-6 md:py-8 pb-20">
        <h1 className="text-white text-2xl font-bold mb-6">My Watchlist</h1>

        {!user && !isLoading && (
          <Empty
            message="Sign in to save movies and shows to your watchlist"
            action={{ label: 'Sign in', href: '/auth/login' }}
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
            {/* Mobile: portrait 2:3 grid */}
            <div className="md:hidden grid grid-cols-3 gap-2.5">
              {cards.map((card) => (
                <PortraitCard key={`${card.mediaType}-${card.id}`} card={card} onRemove={removeItem} />
              ))}
            </div>

            {/* Desktop: landscape 16:9 grid */}
            <div className="hidden md:grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {cards.map((card) => (
                <LandscapeCard key={`${card.mediaType}-${card.id}`} card={card} onRemove={removeItem} />
              ))}
            </div>
          </>
        )}
      </div>
    </AccountLayout>
  );
}

/* ── Portrait card (mobile) ── */
function PortraitCard({
  card,
  onRemove,
}: {
  card: TMDBCard;
  onRemove: (id: number, type: 'movie' | 'series') => void;
}) {
  const title = card.title ?? card.name ?? '';
  const year = (card.release_date ?? card.first_air_date ?? '').slice(0, 4);
  const href = card.mediaType === 'movie' ? `/movie/${card.id}` : `/series/${card.id}`;
  const poster = tmdbImage(card.poster_path, 'w342');

  return (
    <div className="group relative">
      <Link href={href} prefetch={false}>
        <div className="rounded-lg overflow-hidden bg-white/5 aspect-[2/3] relative">
          {poster ? (
            <Image
              src={poster}
              alt={title}
              fill
              sizes="(max-width: 640px) 33vw, 20vw"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-white/20 text-xs">No Image</div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </Link>
      <button
        type="button"
        onClick={() => onRemove(card.id, card.mediaType)}
        aria-label="Remove from watchlist"
        className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/70 border border-white/20 text-white/60 hover:text-white hover:bg-black/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-[10px]"
      >
        ✕
      </button>
      <div className="mt-1.5 px-0.5">
        <p className="text-white text-[11px] font-medium leading-tight line-clamp-1">{title}</p>
        {year && <p className="text-white/40 text-[9px]">{year}</p>}
      </div>
    </div>
  );
}

/* ── Landscape card (desktop) ── */
function LandscapeCard({
  card,
  onRemove,
}: {
  card: TMDBCard;
  onRemove: (id: number, type: 'movie' | 'series') => void;
}) {
  const title = card.title ?? card.name ?? '';
  const year = (card.release_date ?? card.first_air_date ?? '').slice(0, 4);
  const href = card.mediaType === 'movie' ? `/movie/${card.id}` : `/series/${card.id}`;
  // prefer backdrop for landscape, fall back to poster
  const img = tmdbImage(card.backdrop_path ?? card.poster_path, card.backdrop_path ? 'w780' : 'w342');

  return (
    <div className="group relative rounded-xl overflow-hidden bg-white/5">
      <Link href={href} prefetch={false} className="block">
        {/* 16:9 image container */}
        <div className="aspect-video relative">
          {img ? (
            <Image
              src={img}
              alt={title}
              fill
              sizes="(max-width: 1024px) 50vw, 33vw"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-white/20 text-sm">No Image</div>
          )}
          {/* gradient overlay for text legibility */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

          {/* media type badge */}
          <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-black/60 text-white/70 border border-white/10">
            {card.mediaType === 'movie' ? 'Movie' : 'Series'}
          </span>

          {/* title + year at bottom */}
          <div className="absolute bottom-0 left-0 right-0 px-3 pb-3">
            <p className="text-white text-sm font-semibold leading-tight line-clamp-1">{title}</p>
            {year && <p className="text-white/50 text-xs mt-0.5">{year}</p>}
          </div>
        </div>
      </Link>

      {/* Remove button */}
      <button
        type="button"
        onClick={() => onRemove(card.id, card.mediaType)}
        aria-label="Remove from watchlist"
        className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-black/70 border border-white/20 text-white/60 hover:text-white hover:bg-black/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs"
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
      <div className="md:hidden grid grid-cols-3 gap-2.5">
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
