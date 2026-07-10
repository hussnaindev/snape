import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { InfiniteScrollSentinel } from '@/components/infinite-scroll-sentinel';
import { MovieCardGrid } from '@/components/movie-card-grid';
import { ParallaxContent } from '@/components/parallax-content';
import { SectionDivider } from '@/components/ui/section-divider';
import { buildPageHref, mergePaginatedResults, parsePageParam } from '@/lib/paginated-tmdb';
import { getMoviesByGenre } from '@/lib/tmdb';
import { filterHasImages } from '@/lib/tmdb-filters';

export const runtime = 'edge';

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ name?: string; page?: string }>;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { name } = await searchParams;
  return {
    title: name ? `${name} Movies` : 'Browse Movies',
  };
}

export default async function BrowseGenrePage({ params, searchParams }: Props) {
  const { id } = await params;
  const { name, page: pageParam } = await searchParams;

  const genreId = Number(id);
  if (Number.isNaN(genreId)) notFound();

  const firstPage = await getMoviesByGenre(genreId, 1).catch(() => null);
  if (!firstPage || firstPage.results.length === 0) notFound();

  const page = parsePageParam(pageParam, firstPage.total_pages);
  const movies = filterHasImages(
    await mergePaginatedResults(page, (p) => getMoviesByGenre(genreId, p)),
  );

  const hasMore = page < firstPage.total_pages;
  const nextHref = hasMore ? buildPageHref(`/browse/${genreId}`, { name, page: page + 1 }) : null;

  return (
    <>
      <div className="pt-20">
        <section>
          <ParallaxContent direction="left" speed={120}>
            <div className="px-4 md:px-8 mb-6">
              <SectionDivider label={name ? `${name} Movies` : 'Browse by Genre'} />
            </div>
          </ParallaxContent>
        </section>
        <MovieCardGrid movies={movies} parallaxRows />
        <InfiniteScrollSentinel hasMore={hasMore} nextHref={nextHref} />
      </div>
    </>
  );
}
