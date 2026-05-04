'use client';

import { useAuth } from '@/components/auth/auth-provider';
import { cn } from '@/lib/utils';
import type { TMDBCollection } from '@/types/tmdb';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

interface Props {
  collection: TMDBCollection;
  className?: string;
}

export function AddCollectionToWatchlistButton({ collection, className }: Props) {
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
    return (
      <Link
        href="/auth/login"
        className={cn(
          'inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all bg-transparent text-white border-white/30 hover:border-white/60 whitespace-nowrap',
          className,
        )}
      >
        <PlusIcon />
        Add to Watchlist
      </Link>
    );
  }

  if (initializing) {
    return (
      <div
        className={cn('h-10 w-48 rounded-lg bg-white/10 animate-pulse', className)}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className={cn(
        'inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all cursor-pointer',
        inList
          ? 'bg-white/10 text-white border-white/30 hover:bg-white/15'
          : 'bg-transparent text-white border-white/30 hover:border-white/60',
        loading && 'opacity-50 cursor-wait',
        className,
      )}
    >
      {inList ? <CheckIcon /> : <PlusIcon />}
      {inList ? 'In Watchlist' : 'Add to Watchlist'}
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
