import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { MovieCard } from '@/components/movie-card';
import { ParallaxContent } from '@/components/parallax-content';
import { SeriesCard } from '@/components/series-card';
import { SectionDivider } from '@/components/ui/section-divider';
import { CURATED_PROVIDERS } from '@/lib/curated-providers';
import { getCuratedProviderMovies, getMoviesByProvider, getSeriesByProvider } from '@/lib/tmdb';
import { filterHasImages } from '@/lib/tmdb-filters';
import { chunk } from '@/lib/utils';
import { PREFERRED_PROVIDERS } from '@/lib/watch-providers';

const ROW_SIZE = 6;

export const runtime = 'edge';

interface Props {
  params: Promise<{ key: string }>;
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

export default async function ProviderBrowsePage({ params }: Props) {
  const { key } = await params;
  const resolved = resolveProvider(key);
  if (!resolved) notFound();

  let movies: Awaited<ReturnType<typeof getMoviesByProvider>> = [];
  let series: Awaited<ReturnType<typeof getSeriesByProvider>> = [];

  if (resolved.kind === 'curated') {
    const items = await getCuratedProviderMovies(resolved.provider.key).catch(() => []);
    if (resolved.provider.mediaType === 'series') {
      series = items as typeof series;
    } else {
      movies = items as typeof movies;
    }
  } else {
    [movies, series] = await Promise.all([
      getMoviesByProvider(resolved.provider.tmdbId).catch(() => []),
      getSeriesByProvider(resolved.provider.tmdbId).catch(() => []),
    ]);
  }

  const { label: providerLabel } = resolved.provider;

  const filteredMovies = filterHasImages(movies);
  const filteredSeries = filterHasImages(series);

  if (filteredMovies.length === 0 && filteredSeries.length === 0) notFound();

  return (
    <>
      <div className="pt-20">
        {filteredMovies.length > 0 && (
          <section>
            <ParallaxContent direction="left" speed={120}>
              <div className="px-4 md:px-8 mb-6">
                <SectionDivider label={`${providerLabel} Movies`} />
              </div>
            </ParallaxContent>
            <div className="grid grid-cols-2 gap-3 px-4 sm:hidden">
              {filteredMovies.map((movie) => (
                <MovieCard key={movie.id} movie={movie} />
              ))}
            </div>
            <div className="hidden sm:block">
              {chunk(filteredMovies, ROW_SIZE).map((row, i) => (
                <section key={row.map((m) => m.id).join('-')}>
                  <ParallaxContent direction={i % 2 === 0 ? 'right' : 'left'} speed={120}>
                    <div className="grid grid-cols-[repeat(auto-fit,minmax(165px,210px))] justify-center gap-3 px-4 md:px-8">
                      {row.map((movie) => (
                        <MovieCard key={movie.id} movie={movie} />
                      ))}
                    </div>
                  </ParallaxContent>
                </section>
              ))}
            </div>
          </section>
        )}

        {filteredSeries.length > 0 && (
          <section className="mt-10">
            <ParallaxContent direction="right" speed={120}>
              <div className="px-4 md:px-8 mb-6">
                <SectionDivider label={`${providerLabel} Series`} />
              </div>
            </ParallaxContent>
            <div className="grid grid-cols-2 gap-3 px-4 sm:hidden">
              {filteredSeries.map((s) => (
                <SeriesCard key={s.id} series={s} />
              ))}
            </div>
            <div className="hidden sm:block">
              {chunk(filteredSeries, ROW_SIZE).map((row, i) => (
                <section key={row.map((s) => s.id).join('-')}>
                  <ParallaxContent direction={i % 2 === 0 ? 'left' : 'right'} speed={120}>
                    <div className="grid grid-cols-[repeat(auto-fit,minmax(165px,210px))] justify-center gap-3 px-4 md:px-8">
                      {row.map((s) => (
                        <SeriesCard key={s.id} series={s} />
                      ))}
                    </div>
                  </ParallaxContent>
                </section>
              ))}
            </div>
          </section>
        )}

        <div className="h-16" />
      </div>
    </>
  );
}
