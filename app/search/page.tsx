import { CollectionCard } from '@/components/collection-card';
import { InfiniteMovieGrid } from '@/components/infinite-movie-grid';
import { InfiniteSeriesGrid } from '@/components/infinite-series-grid';
import { ParallaxContent } from '@/components/parallax-content';
import { SearchActorGrid } from '@/components/search-actor-grid';
import { SearchHeader } from '@/components/search-header';
import { SectionDivider } from '@/components/ui/section-divider';
import { parseSearchTab } from '@/components/search-tab-chips';
import { Topbar } from '@/components/topbar';
import { APP_NAME } from '@/lib/config';
import { chunk } from '@/lib/utils';
import { searchCollections, searchMovies, searchPeople, searchTvShows } from '@/lib/tmdb';
import { filterHasImages } from '@/lib/tmdb-filters';

const ROW_SIZE = 6;
import type { TMDBCollectionSearchHit, TMDBMovie, TMDBPersonSearchHit, TMDBSeries } from '@/types/tmdb';
import type { Metadata } from 'next';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<{ q?: string; tab?: string }>;
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { q } = await searchParams;
  return { title: q ? `"${q}" — ${APP_NAME}` : `Search — ${APP_NAME}` };
}

export default async function SearchPage({ searchParams }: Props) {
  const { q, tab } = await searchParams;
  const query = q?.trim() ?? '';
  const activeTab = parseSearchTab(tab);

  let movies: TMDBMovie[] = [];
  let series: TMDBSeries[] = [];
  let people: TMDBPersonSearchHit[] = [];
  let collections: TMDBCollectionSearchHit[] = [];
  let movieSearch: Awaited<ReturnType<typeof searchMovies>> | null = null;
  let seriesSearch: Awaited<ReturnType<typeof searchTvShows>> | null = null;

  if (query) {
    try {
      if (activeTab === 'movies') {
        movieSearch = await searchMovies(query, 1, undefined, false);
        movies = filterHasImages(movieSearch.results);
      } else if (activeTab === 'series') {
        seriesSearch = await searchTvShows(query, 1, undefined, false);
        series = filterHasImages(seriesSearch.results);
      } else if (activeTab === 'collections') {
        collections = await searchCollections(query, false);
      } else {
        people = await searchPeople(query, false);
      }
    } catch {
      // TMDB failure — show empty state
    }
  }

  const totalHits =
    activeTab === 'movies'
      ? (movieSearch?.total_results ?? 0)
      : activeTab === 'series'
        ? (seriesSearch?.total_results ?? 0)
        : activeTab === 'collections'
          ? collections.length
          : people.length;

  const showMovieGrid =
    activeTab === 'movies' && movieSearch !== null && movieSearch.total_results > 0;
  const showSeriesGrid =
    activeTab === 'series' && seriesSearch !== null && seriesSearch.total_results > 0;
  const showCollectionsGrid = activeTab === 'collections' && collections.length > 0;
  const showActorGrid = activeTab === 'actors' && people.length > 0;

  return (
    <>
      <Topbar />
      <main className="pt-24 pb-16 px-4 md:px-8">
        {query ? (
          <>
            <SearchHeader query={query} active={activeTab} totalResults={totalHits} />
            {showMovieGrid && movieSearch && (
              <InfiniteMovieGrid
                key={`${query}-movies`}
                mode="search"
                query={query}
                resolvedQuery={movieSearch.resolvedQuery}
                initialMovies={movies}
                totalPages={movieSearch.total_pages}
                parallaxRows
              />
            )}
            {showSeriesGrid && seriesSearch && (
              <InfiniteSeriesGrid
                key={`${query}-series`}
                query={query}
                resolvedQuery={seriesSearch.resolvedQuery}
                initialSeries={series}
                totalPages={seriesSearch.total_pages}
                parallaxRows
              />
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
                    <section key={i}>
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
