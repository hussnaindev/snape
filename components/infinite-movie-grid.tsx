'use client';

import { SnakeLoader } from '@/components/ui/snake-loader';
import { isAbortError } from '@/lib/utils';
import type { TMDBMovie } from '@/types/tmdb';
import { useCallback, useEffect, useRef, useState } from 'react';
import { MovieCard } from './movie-card';

type BrowseProps = {
  mode: 'browse';
  genreId: number;
  initialMovies: TMDBMovie[];
  totalPages: number;
};

type SearchProps = {
  mode: 'search';
  query: string;
  resolvedQuery: string | null;
  initialMovies: TMDBMovie[];
  totalPages: number;
};

export type InfiniteMovieGridProps = BrowseProps | SearchProps;

function parsePageResponse(json: unknown): { ok: boolean; results: TMDBMovie[] } {
  if (typeof json !== 'object' || json === null) return { ok: false, results: [] };
  const o = json as Record<string, unknown>;
  if (o.ok !== true || !Array.isArray(o.results)) return { ok: false, results: [] };
  return { ok: true, results: o.results as TMDBMovie[] };
}

export function InfiniteMovieGrid(props: InfiniteMovieGridProps) {
  const mode = props.mode;
  const genreId = mode === 'browse' ? props.genreId : 0;
  const query = mode === 'search' ? props.query : '';
  const resolvedQuery = mode === 'search' ? props.resolvedQuery : null;
  const totalPages = props.totalPages;
  const initialMovies = props.initialMovies;

  const [movies, setMovies] = useState(initialMovies);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(totalPages > 1);
  const pageRef = useRef(1);
  const loadingRef = useRef(false);
  const hasMoreRef = useRef(totalPages > 1);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const initialIdsSignature = initialMovies.map((m) => m.id).join(',');

  useEffect(() => {
    hasMoreRef.current = hasMore;
  }, [hasMore]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `initialMovies` omitted on purpose — new [] each RSC render would reset scroll; `initialIdsSignature` is stable identity
  useEffect(() => {
    abortRef.current?.abort();
    setMovies(initialMovies);
    pageRef.current = 1;
    const more = totalPages > 1;
    setHasMore(more);
    hasMoreRef.current = more;
  }, [initialIdsSignature, totalPages]);

  useEffect(
    () => () => {
      abortRef.current?.abort();
    },
    [],
  );

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMoreRef.current) return;
    const nextPage = pageRef.current + 1;
    if (nextPage > totalPages) {
      hasMoreRef.current = false;
      setHasMore(false);
      return;
    }
    if (mode === 'search' && !resolvedQuery) {
      hasMoreRef.current = false;
      setHasMore(false);
      return;
    }

    loadingRef.current = true;
    setLoading(true);
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    try {
      let url: string;
      if (mode === 'browse') {
        url = `/api/browse/movies?genreId=${genreId}&page=${nextPage}`;
      } else {
        const variant = resolvedQuery;
        if (!variant) {
          hasMoreRef.current = false;
          setHasMore(false);
          return;
        }
        url = `/api/search/titles?q=${encodeURIComponent(query)}&type=movie&page=${nextPage}&variant=${encodeURIComponent(variant)}`;
      }

      const res = await fetch(url, { signal: ac.signal });
      if (!res.ok) throw new Error('fetch failed');
      const data = parsePageResponse(await res.json());
      if (!data.ok) throw new Error('bad response');
      const newResults = data.results;
      setMovies((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        const merged = [...prev];
        for (const m of newResults) {
          if (!seen.has(m.id)) {
            seen.add(m.id);
            merged.push(m);
          }
        }
        return merged;
      });
      pageRef.current = nextPage;
      if (nextPage >= totalPages) {
        hasMoreRef.current = false;
        setHasMore(false);
      }
    } catch (e) {
      if (isAbortError(e)) return;
      hasMoreRef.current = false;
      setHasMore(false);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [mode, genreId, query, resolvedQuery, totalPages]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore();
      },
      { rootMargin: '480px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [loadMore]);

  return (
    <>
      <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 px-4 md:px-8">
        {movies.map((movie) => (
          <MovieCard key={movie.id} movie={movie} />
        ))}
      </div>
      {hasMore && <div ref={sentinelRef} className="h-32 flex justify-center items-center py-6" />}
      {loading && (
        <div className="flex justify-center py-6">
          <SnakeLoader size={48} />
        </div>
      )}
    </>
  );
}
