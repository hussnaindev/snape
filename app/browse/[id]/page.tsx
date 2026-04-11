import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { MovieGrid } from '@/components/movie-grid';
import { Topbar } from '@/components/topbar';
import { SectionDivider } from '@/components/ui/section-divider';
import { getMoviesByGenre } from '@/lib/tmdb';

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ name?: string }>;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { name } = await searchParams;
  return {
    title: name ? `${name} Movies` : 'Browse Movies',
  };
}

export default async function BrowseGenrePage({ params, searchParams }: Props) {
  const { id } = await params;
  const { name } = await searchParams;

  const genreId = Number(id);
  if (Number.isNaN(genreId)) notFound();

  const moviesData = await getMoviesByGenre(genreId).catch(() => null);
  if (!moviesData || moviesData.length === 0) notFound();

  // Filter out movies missing both backdrop and poster images
  function hasImages<T extends { backdrop_path: string | null; poster_path: string | null }>(
    movies: T[],
  ): T[] {
    return movies.filter((m) => m.backdrop_path !== null || m.poster_path !== null);
  }

  const movies = hasImages(moviesData);

  return (
    <>
      <Topbar />
      <div className="pt-20">
        <div className="px-4 md:px-8 mb-6">
          <SectionDivider label={name ? `${name} Movies` : 'Browse by Genre'} />
        </div>
        <MovieGrid movies={movies} />
        {movies.length === 0 && (
          <div className="text-center py-12">
            <p className="text-white/50">No movies found in this genre.</p>
          </div>
        )}
      </div>
    </>
  );
}
