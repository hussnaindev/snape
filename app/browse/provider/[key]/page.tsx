import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { MovieCard } from '@/components/movie-card';
import { SeriesCard } from '@/components/series-card';
import { Topbar } from '@/components/topbar';
import { SectionDivider } from '@/components/ui/section-divider';
import { getMoviesByProvider, getSeriesByProvider } from '@/lib/tmdb';
import { filterHasImages } from '@/lib/tmdb-filters';
import { PREFERRED_PROVIDERS } from '@/lib/watch-providers';

export const runtime = 'edge';

interface Props {
  params: Promise<{ key: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { key } = await params;
  const provider = PREFERRED_PROVIDERS.find((p) => p.key === key);
  if (!provider) return { title: 'Provider Not Found' };
  return { title: `${provider.label} — Browse Movies & Series` };
}

export default async function ProviderBrowsePage({ params }: Props) {
  const { key } = await params;
  const provider = PREFERRED_PROVIDERS.find((p) => p.key === key);
  if (!provider) notFound();

  const [movies, series] = await Promise.all([
    getMoviesByProvider(provider.tmdbId),
    getSeriesByProvider(provider.tmdbId),
  ]);

  const filteredMovies = filterHasImages(movies);
  const filteredSeries = filterHasImages(series);

  if (filteredMovies.length === 0 && filteredSeries.length === 0) notFound();

  return (
    <>
      <Topbar />
      <div className="pt-20">
        {filteredMovies.length > 0 && (
          <div className="px-4 md:px-8 mb-6">
            <SectionDivider label={`${provider.label} Movies`} />
          </div>
        )}
        {filteredMovies.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 3xl:grid-cols-8 gap-3 px-4 md:px-8">
            {filteredMovies.map((movie) => (
              <MovieCard key={movie.id} movie={movie} />
            ))}
          </div>
        )}

        {filteredSeries.length > 0 && (
          <div className="px-4 md:px-8 mb-6 mt-10">
            <SectionDivider label={`${provider.label} Series`} />
          </div>
        )}
        {filteredSeries.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 3xl:grid-cols-8 gap-3 px-4 md:px-8">
            {filteredSeries.map((s) => (
              <SeriesCard key={s.id} series={s} />
            ))}
          </div>
        )}

        <div className="h-16" />
      </div>
    </>
  );
}
