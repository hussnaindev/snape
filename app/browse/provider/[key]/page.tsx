import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { InfiniteScrollSentinel } from '@/components/infinite-scroll-sentinel';
import { MovieCardGrid } from '@/components/movie-card-grid';
import { ParallaxContent } from '@/components/parallax-content';
import { SectionDivider } from '@/components/ui/section-divider';
import { SeriesCardGrid } from '@/components/series-card-grid';
import { CURATED_PROVIDERS } from '@/lib/curated-providers';
import { buildPageHref, mergePaginatedResults, parsePageParam } from '@/lib/paginated-tmdb';
import {
  getCuratedProviderMovies,
  getMoviesByProviderPage,
  getSeriesByProviderPage,
} from '@/lib/tmdb';
import { filterHasImages } from '@/lib/tmdb-filters';
import { PREFERRED_PROVIDERS } from '@/lib/watch-providers';

export const runtime = 'edge';

interface Props {
  params: Promise<{ key: string }>;
  searchParams: Promise<{ page?: string }>;
}

function resolveProvider(key: string) {
  const preferred = PREFERRED_PROVIDERS.find((p) => p.key === key);
  if (preferred) return { kind: 'preferred' as const, provider: preferred };
  const curated = CURATED_PROVIDERS.find((p) => p.key === key);
  if (curated) return { kind: 'curated' as const, provider: curated };
  return null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { key } = await params;
  const resolved = resolveProvider(key);
  if (!resolved) return { title: 'Provider Not Found' };
  const suffix =
    resolved.kind === 'curated'
      ? resolved.provider.mediaType === 'series'
        ? 'Series'
        : 'Movies'
      : 'Movies & Series';
  return { title: `${resolved.provider.label} — Browse ${suffix}` };
}

export default async function ProviderBrowsePage({ params, searchParams }: Props) {
  const { key } = await params;
  const { page: pageParam } = await searchParams;

  const resolved = resolveProvider(key);
  if (!resolved) notFound();

  const { label: providerLabel } = resolved.provider;

  let allMovies: Awaited<ReturnType<typeof getMoviesByProviderPage>>['results'] = [];
  let allSeries: Awaited<ReturnType<typeof getSeriesByProviderPage>>['results'] = [];
  let totalMoviePages = 0;
  let totalSeriesPages = 0;
  let hasMore = false;

  if (resolved.kind === 'curated') {
    const page = Math.max(1, Number(pageParam ?? 1));
    const items = await getCuratedProviderMovies(resolved.provider.key, page);
    if (resolved.provider.mediaType === 'series') {
      allSeries = items as typeof allSeries;
    } else {
      allMovies = items as typeof allMovies;
    }
  } else {
    const tmdbId = resolved.provider.tmdbId;

    const firstMoviePage = await getMoviesByProviderPage(tmdbId, 1).catch(() => null);
    const firstSeriesPage = await getSeriesByProviderPage(tmdbId, 1).catch(() => null);

    totalMoviePages = firstMoviePage?.total_pages ?? 0;
    totalSeriesPages = firstSeriesPage?.total_pages ?? 0;

    const page = parsePageParam(pageParam, Math.max(totalMoviePages, totalSeriesPages, 1));

    if (firstMoviePage) {
      allMovies = filterHasImages(
        await mergePaginatedResults(page, (p) => getMoviesByProviderPage(tmdbId, p)),
      );
    }
    if (firstSeriesPage) {
      allSeries = filterHasImages(
        await mergePaginatedResults(page, (p) => getSeriesByProviderPage(tmdbId, p)),
      );
    }

    hasMore = page < Math.max(totalMoviePages, totalSeriesPages, 1);
  }

  if (allMovies.length === 0 && allSeries.length === 0) notFound();

  const nextHref = hasMore
    ? buildPageHref(`/browse/provider/${key}`, { page: Number(pageParam ?? 1) + 1 })
    : null;

  return (
    <>
      <div className="pt-20">
        {allMovies.length > 0 && (
          <section>
            <ParallaxContent direction="left" speed={120}>
              <div className="px-4 md:px-8 mb-6">
                <SectionDivider label={`${providerLabel} Movies`} />
              </div>
            </ParallaxContent>
            <MovieCardGrid movies={allMovies} parallaxRows />
          </section>
        )}

        {allSeries.length > 0 && (
          <section className={allMovies.length > 0 ? 'mt-10' : undefined}>
            <ParallaxContent direction="right" speed={120}>
              <div className="px-4 md:px-8 mb-6">
                <SectionDivider label={`${providerLabel} Series`} />
              </div>
            </ParallaxContent>
            <SeriesCardGrid series={allSeries} parallaxRows />
          </section>
        )}

        <InfiniteScrollSentinel hasMore={hasMore} nextHref={nextHref} />

        <div className="h-16" />
      </div>
    </>
  );
}
