'use client';

import { useAuth } from '@/components/auth/auth-provider';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

interface Props {
  tmdbId: number;
  mediaType: 'movie' | 'series';
  className?: string;
  iconOnly?: boolean;
}

export function WatchlistButton({ tmdbId, mediaType, className, iconOnly = false }: Props) {
  const { user } = useAuth();
  const [inList, setInList] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  // Track the active user to avoid stale-closure state flips on user change
  const userRef = useRef(user);
  userRef.current = user;

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
        const found = (json.data as { tmdbId: number; mediaType: string }[]).some(
          (item) => item.tmdbId === tmdbId && item.mediaType === mediaType,
        );
        setInList(found);
      })
      .catch(() => {})
      .finally(() => setInitializing(false));
  }, [user, tmdbId, mediaType]);

  if (!user) {
    const href = '/auth/login';

    if (iconOnly) {
      return (
        <Link
          href={href}
          aria-label="Login to add to watchlist"
          className={cn(
            'flex items-center justify-center w-9 h-9 rounded-full border transition-all bg-black/40 text-white border-white/30 hover:border-white/70 backdrop-blur-sm',
            className,
          )}
        >
          <PlusIcon />
        </Link>
      );
    }

    return (
      <Link
        href={href}
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
        className={cn(
          iconOnly
            ? 'w-9 h-9 rounded-full bg-white/10 animate-pulse'
            : 'h-10 w-36 rounded-lg bg-white/10 animate-pulse',
          className,
        )}
      />
    );
  }

  async function toggle() {
    if (loading) return;
    // Optimistic update
    const prev = inList;
    setInList(!prev);
    setLoading(true);
    try {
      const res = await fetch('/api/watchlist', {
        method: prev ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tmdbId, mediaType }),
      });
      const json = await res.json();
      if (!json.ok) setInList(prev); // revert on error
    } catch {
      setInList(prev); // revert on network error
    } finally {
      setLoading(false);
    }
  }

  if (iconOnly) {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-label={inList ? 'Remove from watchlist' : 'Add to watchlist'}
        className={cn(
          'flex items-center justify-center w-9 h-9 rounded-full border transition-all cursor-pointer',
          inList
            ? 'bg-white text-black border-white'
            : 'bg-black/40 text-white border-white/30 hover:border-white/70 backdrop-blur-sm',
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
      onClick={toggle}
      disabled={loading}
      className={cn(
        'flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all cursor-pointer',
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
