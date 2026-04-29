'use client';

import { useAuth } from '@/components/auth/auth-provider';
import { addToWatchHistory, uploadEntryToServer } from '@/lib/watch-history';
import { useEffect } from 'react';

interface Props {
  id: number;
  type: 'movie' | 'series';
  title: string;
  posterPath: string | null;
  backdropPath: string | null;
  year: string;
}

export function WatchHistoryRecorder({ id, type, title, posterPath, backdropPath, year }: Props) {
  const { state } = useAuth();
  const isAuthenticated = state.status === 'authenticated';

  useEffect(() => {
    addToWatchHistory({ id, type, title, posterPath, backdropPath, year });

    if (isAuthenticated) {
      uploadEntryToServer({
        id,
        type,
        title,
        posterPath,
        backdropPath,
        year,
        progress: 0, // will be overwritten by server upsert
        watchedAt: Date.now(),
      });
    }
  }, [id, type, title, posterPath, backdropPath, year, isAuthenticated]);

  return null;
}
