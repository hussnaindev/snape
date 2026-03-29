import { HeroSection } from '@/components/hero-section';
import { MovieCarousel } from '@/components/movie-carousel';
import { MovieGrid } from '@/components/movie-grid';
import { Topbar } from '@/components/topbar';
import { SectionDivider } from '@/components/ui/section-divider';
import {
  getNowPlayingMovies,
  getPopularMovies,
  getTopRatedMovies,
  getTrendingMovies,
  getMoviesByGenre,
  getBollywoodMovies,
} from '@/lib/tmdb';
import { APP_NAME } from '@/lib/config';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: `${APP_NAME} — Stream Movies Instantly`,
};

export default async function HomePage() {
  const [trending, nowPlaying, topRated, popular, actionRaw, adventureRaw, thrillerRaw, scifiRaw, bollywoodRaw] =
    await Promise.all([
      getTrendingMovies(),
      getNowPlayingMovies(),
      getTopRatedMovies(),
      getPopularMovies(1),
      getMoviesByGenre(28),   // Action
      getMoviesByGenre(12),   // Adventure
      getMoviesByGenre(53),   // Thriller
      getMoviesByGenre(878),  // Sci-Fi
      getBollywoodMovies(),   // Bollywood
    ]);

  // Filter out movies missing both backdrop and poster images
  function hasImages<T extends { backdrop_path: string | null; poster_path: string | null }>(movies: T[]): T[] {
    return movies.filter((m) => m.backdrop_path !== null || m.poster_path !== null);
  }

  const [trendingFiltered, nowPlayingFiltered, topRatedFiltered, popularFiltered] = [
    hasImages(trending),
    hasImages(nowPlaying),
    hasImages(topRated),
    hasImages(popular.results),
  ];

  // Deduplicate genre rails — exclude movies already shown in earlier sections
  const seen = new Set<number>([
    ...trendingFiltered.map((m) => m.id),
    ...nowPlayingFiltered.map((m) => m.id),
    ...topRatedFiltered.map((m) => m.id),
  ]);

  function dedupe<T extends { id: number }>(movies: T[]): T[] {
    return movies.filter((m) => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });
  }

  const action = dedupe(hasImages(actionRaw));
  const adventure = dedupe(hasImages(adventureRaw));
  const thriller = dedupe(hasImages(thrillerRaw));
  const scifi = dedupe(hasImages(scifiRaw));
  const bollywood = dedupe(hasImages(bollywoodRaw));

  return (
    <>
      <Topbar />

      <div>
        {/* Hero */}
        <HeroSection movies={trendingFiltered} />

        {/* Rails */}
        <div className="mt-6 flex flex-col gap-3">
          <MovieCarousel title="Trending This Week" movies={trendingFiltered} />
          <MovieCarousel title="Now Playing" movies={nowPlayingFiltered} />
          <MovieCarousel title="Top Rated" movies={topRatedFiltered} />
          <MovieCarousel title="Action" movies={action} />
          <MovieCarousel title="Adventure" movies={adventure} />
          <MovieCarousel title="Thriller" movies={thriller} />
          <MovieCarousel title="Sci-Fi" movies={scifi} />
          <MovieCarousel title="Bollywood" movies={bollywood} />
        </div>

        {/* Popular grid */}
        <div className="mt-6 mb-10">
          <div className="px-4 md:px-8 mb-4">
            <SectionDivider label={`Popular on ${APP_NAME}`} />
          </div>
          <MovieGrid movies={popularFiltered} />
        </div>
      </div>
    </>
  );
}
