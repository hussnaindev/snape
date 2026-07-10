import { CollectionCard } from '@/components/collection-card';
import { InfiniteScrollSentinel } from '@/components/infinite-scroll-sentinel';
import { MovieCardGrid } from '@/components/movie-card-grid';
import { ParallaxContent } from '@/components/parallax-content';
import { SearchActorGrid } from '@/components/search-actor-grid';
import { SearchHeader, SearchHeaderFallback } from '@/components/search-header';
import { parseSearchTab } from '@/components/search-tab-chips';
import { SeriesCardGrid } from '@/components/series-card-grid';
import { SectionDivider } from '@/components/ui/section-divider';
import { APP_NAME } from '@/lib/config';
import { buildPageHref, mergePaginatedResults, parsePageParam } from '@/lib/paginated-tmdb';
import { searchCollections, searchMovies, searchPeople, searchTvShows } from '@/lib/tmdb';
import { filterHasImages } from '@/lib/tmdb-filters';
import { chunk } from '@/lib/utils';

const ROW_SIZE = 6;
import type {
  TMDBCollectionSearchHit,
  TMDBMovie,
  TMDBPersonSearchHit,
  TMDBSeries,
} from '@/types/tmdb';
import type { Metadata } from 'next';
import { Suspense } from 'react';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<{ q?: string; tab?: string; page?: string }>;
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { q } = await searchParams;
  return { title: q ? `"${q}" — ${APP_NAME}` : `Search — ${APP_NAME}` };
}

export default async function SearchPage({ searchParams }: Props) {
  const { q, tab, page: pageParam } = await searchParams;
  const query = q?.trim() ?? '';
  const activeTab = parseSearchTab(tab);

  let movies: TMDBMovie[] = [];
  let series: TMDBSeries[] = [];
  let people: TMDBPersonSearchHit[] = [];
  let collections: TMDBCollectionSearchHit[] = [];
  let movieSearch: Awaited<ReturnType<typeof searchMovies>> | null = null;
  let seriesSearch: Awaited<ReturnType<typeof searchTvShows>> | null = null;
  let moviePage = 1;
  let seriesPage = 1;

  if (query) {
    try {
      if (activeTab === 'movies') {
        movieSearch = await searchMovies(query, 1, undefined, false);
        moviePage = parsePageParam(pageParam, movieSearch.total_pages);
        if (movieSearch.resolvedQuery) {
          const resolved = movieSearch.resolvedQuery;
          movies = filterHasImages(
            await mergePaginatedResults(moviePage, (p) => searchMovies(query, p, resolved, false)),
          );
        }
      } else if (activeTab === 'series') {
        seriesSearch = await searchTvShows(query, 1, undefined, false);
        seriesPage = parsePageParam(pageParam, seriesSearch.total_pages);
        if (seriesSearch.resolvedQuery) {
          const resolved = seriesSearch.resolvedQuery;
          series = filterHasImages(
            await mergePaginatedResults(seriesPage, (p) =>
              searchTvShows(query, p, resolved, false),
            ),
          );
        }
      } else if (activeTab === 'collections') {
        collections = await searchCollections(query, false);
      } else {
        people = await searchPeople(query, false);
      }
    } catch {
      // TMDB failure — show empty state
    }
  }

  const showMovieGrid =
    activeTab === 'movies' && movieSearch !== null && movieSearch.total_results > 0;
  const showSeriesGrid =
    activeTab === 'series' && seriesSearch !== null && seriesSearch.total_results > 0;
  const showCollectionsGrid = activeTab === 'collections' && collections.length > 0;
  const showActorGrid = activeTab === 'actors' && people.length > 0;

  return (
    <>
      <main className="pt-24 pb-16 px-4 md:px-8">
        {query ? (
          <>
            <Suspense fallback={<SearchHeaderFallback />}>
              <SearchHeader active={activeTab} />
            </Suspense>
            {showMovieGrid && movieSearch && (
              <>
                <MovieCardGrid movies={movies} parallaxRows />
                <InfiniteScrollSentinel
                  hasMore={moviePage < movieSearch.total_pages}
                  nextHref={
                    moviePage < movieSearch.total_pages
                      ? buildPageHref('/search', {
                          q: query,
                          tab: 'movies',
                          page: moviePage + 1,
                        })
                      : null
                  }
                />
              </>
            )}
            {showSeriesGrid && seriesSearch && (
              <>
                <SeriesCardGrid series={series} parallaxRows />
                <InfiniteScrollSentinel
                  hasMore={seriesPage < seriesSearch.total_pages}
                  nextHref={
                    seriesPage < seriesSearch.total_pages
                      ? buildPageHref('/search', {
                          q: query,
                          tab: 'series',
                          page: seriesPage + 1,
                        })
                      : null
                  }
                />
              </>
            )}
            {showCollectionsGrid && (
              <section>
                <ParallaxContent direction="left" speed={120}>
                  <div className="px-4 md:px-8 mb-6">
                    <SectionDivider label="Collections" />
                  </div>
                </ParallaxContent>
                <div className="grid grid-cols-2 gap-3 px-4 sm:hidden">
                  {collections.map((collection) => (
                    <CollectionCard key={collection.id} collection={collection} />
                  ))}
                </div>
                <div className="hidden sm:block">
                  {chunk(collections, ROW_SIZE).map((row, i) => (
                    <section key={row.map((c) => c.id).join('-')}>
                      <ParallaxContent direction={i % 2 === 0 ? 'right' : 'left'} speed={120}>
                        <div className="grid grid-cols-[repeat(auto-fit,minmax(165px,210px))] justify-center gap-3 px-4 md:px-8">
                          {row.map((collection) => (
                            <CollectionCard key={collection.id} collection={collection} />
                          ))}
                        </div>
                      </ParallaxContent>
                    </section>
                  ))}
                </div>
              </section>
            )}
            {showActorGrid && (
              <section>
                <ParallaxContent direction="right" speed={120}>
                  <SearchActorGrid people={people} />
                </ParallaxContent>
              </section>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <p className="text-white/50 text-sm">Search movies, TV shows, or cast names.</p>
          </div>
        )}
      </main>
    </>
  );
}
