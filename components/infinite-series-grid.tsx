'use client';

import { ParallaxContent } from '@/components/parallax-content';
import { SnakeLoader } from '@/components/ui/snake-loader';
import { chunk, isAbortError } from '@/lib/utils';
import type { TMDBSeries } from '@/types/tmdb';
import { useCallback, useEffect, useRef, useState } from 'react';
import { SeriesCard } from './series-card';

export interface InfiniteSeriesGridProps {
  query: string;
  resolvedQuery: string | null;
  initialSeries: TMDBSeries[];
  totalPages: number;
  parallaxRows?: boolean;
}

const ROW_SIZE = 6;

function parsePageResponse(json: unknown): { ok: boolean; results: TMDBSeries[] } {
  if (typeof json !== 'object' || json === null) return { ok: false, results: [] };
  const o = json as Record<string, unknown>;
  if (o.ok !== true || !Array.isArray(o.results)) return { ok: false, results: [] };
  return { ok: true, results: o.results as TMDBSeries[] };
}

export function InfiniteSeriesGrid({
  query,
  resolvedQuery,
  initialSeries,
  totalPages,
  parallaxRows,
}: InfiniteSeriesGridProps) {
  const [series, setSeries] = useState(initialSeries);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(totalPages > 1);
  const pageRef = useRef(1);
  const loadingRef = useRef(false);
  const hasMoreRef = useRef(totalPages > 1);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const initialIdsSignature = initialSeries.map((s) => s.id).join(',');

  useEffect(() => {
    hasMoreRef.current = hasMore;
  }, [hasMore]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `initialSeries` omitted on purpose — new [] each RSC render would reset scroll; `initialIdsSignature` is stable identity
  useEffect(() => {
    abortRef.current?.abort();
    setSeries(initialSeries);
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
    if (!resolvedQuery) {
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
      const url = `/api/search/titles?q=${encodeURIComponent(query)}&type=tv&page=${nextPage}&variant=${encodeURIComponent(resolvedQuery)}`;
      const res = await fetch(url, { signal: ac.signal });
      if (!res.ok) throw new Error('fetch failed');
      const data = parsePageResponse(await res.json());
      if (!data.ok) throw new Error('bad response');
      const newResults = data.results;
      setSeries((prev) => {
        const seen = new Set(prev.map((s) => s.id));
        const merged = [...prev];
        for (const s of newResults) {
          if (!seen.has(s.id)) {
            seen.add(s.id);
            merged.push(s);
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
  }, [query, resolvedQuery, totalPages]);

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

  const GRID_CLASS = 'grid grid-cols-[repeat(auto-fit,minmax(165px,210px))] justify-center gap-3 px-4 md:px-8';

  return (
    <>
      {parallaxRows ? (
        chunk(series, ROW_SIZE).map((row, i) => (
          <section key={i} className="relative z-0 hover:z-50">
            <ParallaxContent direction={i % 2 === 0 ? 'left' : 'right'} speed={120}>
              <div className={GRID_CLASS}>
                {row.map((s) => (
                  <SeriesCard key={s.id} series={s} />
                ))}
              </div>
            </ParallaxContent>
          </section>
        ))
      ) : (
        <div className={GRID_CLASS}>
          {series.map((s) => (
            <SeriesCard key={s.id} series={s} />
          ))}
        </div>
      )}
      {hasMore && <div ref={sentinelRef} className="h-32 flex justify-center items-center py-6" />}
      {loading && (
        <div className="flex justify-center py-6">
          <SnakeLoader size={48} />
        </div>
      )}
    </>
  );
}
