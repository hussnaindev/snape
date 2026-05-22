'use client';

import { useAuth } from '@/components/auth/auth-provider';
import { cn } from '@/lib/utils';
import type { TMDBCollection } from '@/types/tmdb';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

interface Props {
  collection: TMDBCollection;
  className?: string;
  iconOnly?: boolean;
}

export function AddCollectionToWatchlistButton({ collection, className, iconOnly }: Props) {
  const { user } = useAuth();
  const [inList, setInList] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const userRef = useRef(user);
  userRef.current = user;

  // Check if collection is in watchlist
  useEffect(() => {
    if (!user) {
      setInitializing(false);
      setInList(false);
      return;
    }
    setInitializing(true);
    fetch('/api/watchlist')
      .then((r) => r.json())
      .then((json) => {
        if (!json.ok || userRef.current?.id !== user.id) return;
        const watchlistItems = json.data as { tmdbId: number; mediaType: string }[];
        const found = watchlistItems.some(
          (item) => item.tmdbId === collection.id && item.mediaType === 'collection',
        );
        setInList(found);
      })
      .catch(() => {})
      .finally(() => setInitializing(false));
  }, [user, collection]);

  const handleClick = useCallback(async () => {
    if (loading || !user) return;
    setLoading(true);
    try {
      if (inList) {
        await fetch('/api/watchlist', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tmdbId: collection.id, mediaType: 'collection' }),
        });
        setInList(false);
      } else {
        await fetch('/api/watchlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tmdbId: collection.id, mediaType: 'collection' }),
        });
        setInList(true);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [loading, user, inList, collection]);

  if (!user) {
    if (iconOnly) {
      return (
        <Link
          href="/auth/login"
          aria-label="Login to add to watchlist"
          className={cn(
            'flex items-center justify-center w-9 h-9 rounded-full border transition-all bg-black/60 text-white border-white/30 hover:border-white/70',
            className,
          )}
        >
          <PlusIcon />
        </Link>
      );
    }

    return (
      <Link
        href="/auth/login"
        className={cn(
          'relative top-0 inline-flex items-center justify-center gap-2 text-nowrap rounded-full border py-0.5 text-xs font-semibold uppercase leading-tight tracking-widest transition-all duration-300 ease-out cursor-pointer active:top-0.5 h-10 px-3 md:h-12 md:px-5 min-w-36 border-white/20 bg-white/10 text-white lg:hover:border-transparent lg:hover:bg-white/20 lg:hover:text-white active:border-transparent active:bg-white/20',
          className,
        )}
      >
        <PlusIcon />
        <span className="px-2">Add to Watchlist</span>
      </Link>
    );
  }

  if (initializing) {
    return (
      <div
        className={cn(
          iconOnly
            ? 'w-9 h-9 rounded-full bg-white/10 animate-pulse'
            : 'h-10 w-48 rounded-lg bg-white/10 animate-pulse',
          className,
        )}
      />
    );
  }

  if (iconOnly) {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        aria-label={inList ? 'Remove from watchlist' : 'Add to watchlist'}
        className={cn(
          'flex items-center justify-center w-9 h-9 rounded-full border transition-all cursor-pointer',
          inList
            ? 'bg-white text-black border-white'
            : 'bg-black/60 text-white border-white/30 hover:border-white/70',
          loading && 'opacity-50 cursor-wait',
          className,
        )}
      >
        {inList ? <CheckIcon /> : <PlusIcon />}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className={cn(
        'relative top-0 inline-flex items-center justify-center gap-2 text-nowrap rounded-full border py-0.5 text-xs font-semibold uppercase leading-tight tracking-widest transition-all duration-300 ease-out cursor-pointer active:top-0.5 h-10 px-3 md:h-12 md:px-5 min-w-36',
        inList
          ? 'border-white/20 bg-white/20 text-white lg:hover:bg-white/30 active:bg-white/20'
          : 'border-white/20 bg-white/2 text-white lg:hover:border-transparent lg:hover:bg-white/20 lg:hover:text-white active:border-transparent active:bg-white/20',
        loading && 'opacity-50 cursor-wait',
        className,
      )}
    >
      {inList ? <CheckIcon /> : <PlusIcon />}
      <span className="px-2">{inList ? 'In Watchlist' : 'Add to Watchlist'}</span>
    </button>
  );
}

function PlusIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
