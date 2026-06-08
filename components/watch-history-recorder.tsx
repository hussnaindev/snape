'use client';

import { useAuth } from '@/components/auth/auth-provider';
import { type PlaybackProgress, subscribePlaybackProgress } from '@/lib/playback-progress';
import {
  type WatchHistoryEntry,
  addToWatchHistory,
  recordPlaybackProgress,
  uploadEntryToServer,
} from '@/lib/watch-history';
import { useEffect, useRef } from 'react';

interface Props {
  id: number;
  type: 'movie' | 'series';
  title: string;
  posterPath: string | null;
  backdropPath: string | null;
  year: string;
  season?: number;
  episode?: number;
  vote_average?: number;
}

// How often to persist during continuous playback (the player emits ~every 5s).
const LOCAL_INTERVAL_MS = 4000;
const SERVER_INTERVAL_MS = 15000;

/** Map the player's media type onto the watch-history media type. */
function toHistoryType(t: PlaybackProgress['type']): 'movie' | 'series' {
  return t === 'tv' ? 'series' : 'movie';
}

export function WatchHistoryRecorder({
  id,
  type,
  title,
  posterPath,
  backdropPath,
  year,
  season,
  episode,
  vote_average,
}: Props) {
  const { state } = useAuth();
  const isAuthenticated = state.status === 'authenticated';

  // Record (or refresh) the entry when the title/episode opens.
  useEffect(() => {
    const entry: Omit<WatchHistoryEntry, 'progress' | 'positionSeconds' | 'durationSeconds' | 'watchedAt'> = {
      id,
      type,
      title,
      posterPath,
      backdropPath,
      year,
      vote_average: vote_average ?? 0,
    };
    if (season !== undefined) entry.season = season;
    if (episode !== undefined) entry.episode = episode;
    const stored = addToWatchHistory(entry);

    // Upload the entry as stored (position preserved by addToWatchHistory).
    if (isAuthenticated && stored) uploadEntryToServer(stored);
  }, [id, type, title, posterPath, backdropPath, year, season, episode, vote_average, isAuthenticated]);

  // Persist live playback progress emitted by the player. Local storage on a
  // short throttle (instant resume), server on a longer throttle, and a beacon
  // on tab-hide so the final position survives a close.
  const latestRef = useRef<PlaybackProgress | null>(null);
  const lastLocalRef = useRef(0);
  const lastServerRef = useRef(0);

  useEffect(() => {
    const matches = (p: PlaybackProgress) => {
      if (p.tmdbId !== id || toHistoryType(p.type) !== type) return false;
      if (type === 'series') return p.season === season && p.episode === episode;
      return true;
    };

    const persistLocal = (p: PlaybackProgress) =>
      recordPlaybackProgress({
        id,
        type,
        positionSeconds: p.positionSeconds,
        durationSeconds: p.durationSeconds,
        ...(season !== undefined ? { season } : {}),
        ...(episode !== undefined ? { episode } : {}),
      });

    const unsubscribe = subscribePlaybackProgress((p) => {
      if (!matches(p)) return;
      latestRef.current = p;
      const now = Date.now();

      if (p.ended || now - lastLocalRef.current >= LOCAL_INTERVAL_MS) {
        lastLocalRef.current = now;
        const entry = persistLocal(p);
        if (isAuthenticated && entry && (p.ended || now - lastServerRef.current >= SERVER_INTERVAL_MS)) {
          lastServerRef.current = now;
          uploadEntryToServer(entry);
        }
      }
    });

    // Flush the latest position when the tab is hidden or the page is unloaded.
    const flush = () => {
      const p = latestRef.current;
      if (!p) return;
      const entry = persistLocal(p);
      if (isAuthenticated && entry && typeof navigator !== 'undefined' && navigator.sendBeacon) {
        const body: Record<string, unknown> = {
          tmdbId: entry.id,
          mediaType: entry.type,
          title: entry.title,
          posterPath: entry.posterPath,
          backdropPath: entry.backdropPath,
          year: entry.year,
          progress: entry.progress,
          positionSeconds: entry.positionSeconds,
          durationSeconds: entry.durationSeconds,
        };
        if (entry.season !== undefined) body.season = entry.season;
        if (entry.episode !== undefined) body.episode = entry.episode;
        navigator.sendBeacon('/api/watch-history', new Blob([JSON.stringify(body)], { type: 'application/json' }));
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      unsubscribe();
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [id, type, season, episode, isAuthenticated]);

  return null;
}
