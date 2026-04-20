import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { InfiniteMovieGrid } from '@/components/infinite-movie-grid';
import { Topbar } from '@/components/topbar';
import { SectionDivider } from '@/components/ui/section-divider';
import { getMoviesByGenre } from '@/lib/tmdb';
import { filterHasImages } from '@/lib/tmdb-filters';

export const runtime = 'edge';

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

  const data = await getMoviesByGenre(genreId).catch(() => null);
  if (!data || data.results.length === 0) notFound();

  const movies = filterHasImages(data.results);

  return (
    <>
      <Topbar />
      <div className="pt-20">
        <div className="px-4 md:px-8 mb-6">
          <SectionDivider label={name ? `${name} Movies` : 'Browse by Genre'} />
        </div>
        <InfiniteMovieGrid
          key={genreId}
          mode="browse"
          genreId={genreId}
          initialMovies={movies}
          totalPages={data.total_pages}
        />
      </div>
    </>
  );
}
