'use client';

import { useAuth } from '@/components/auth/auth-provider';
import {
  type WatchHistoryEntry,
  addToWatchHistory,
  seededProgress,
  uploadEntryToServer,
} from '@/lib/watch-history';
import { useEffect } from 'react';

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

  useEffect(() => {
    const entry: Omit<WatchHistoryEntry, 'progress' | 'watchedAt'> = {
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
    addToWatchHistory(entry);

    if (isAuthenticated) {
      const serverEntry: WatchHistoryEntry = {
        ...entry,
        progress: seededProgress(id),
        watchedAt: Date.now(),
      };
      uploadEntryToServer(serverEntry);
    }
  }, [
    id,
    type,
    title,
    posterPath,
    backdropPath,
    year,
    season,
    episode,
    vote_average,
    isAuthenticated,
  ]);

  return null;
}
