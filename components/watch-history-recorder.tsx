'use client';

import { addToWatchHistory } from '@/lib/watch-history';
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
  useEffect(() => {
    addToWatchHistory({ id, type, title, posterPath, backdropPath, year });
  }, [id, type, title, posterPath, backdropPath, year]);

  return null;
}
