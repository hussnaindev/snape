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
} from '@/lib/tmdb';
import { APP_NAME } from '@/lib/config';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: `${APP_NAME} — Stream Movies Instantly`,
};

export default async function HomePage() {
  const [trending, nowPlaying, topRated, popular, actionRaw, adventureRaw, thrillerRaw, scifiRaw] =
    await Promise.all([
      getTrendingMovies(),
      getNowPlayingMovies(),
      getTopRatedMovies(),
      getPopularMovies(1),
      getMoviesByGenre(28),   // Action
      getMoviesByGenre(12),   // Adventure
      getMoviesByGenre(53),   // Thriller
      getMoviesByGenre(878),  // Sci-Fi
    ]);

  // Deduplicate genre rails — exclude movies already shown in earlier sections
  const seen = new Set<number>([
    ...trending.map((m) => m.id),
    ...nowPlaying.map((m) => m.id),
    ...topRated.map((m) => m.id),
  ]);

  function dedupe<T extends { id: number }>(movies: T[]): T[] {
    return movies.filter((m) => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });
  }

  const action = dedupe(actionRaw);
  const adventure = dedupe(adventureRaw);
  const thriller = dedupe(thrillerRaw);
  const scifi = dedupe(scifiRaw);

  return (
    <>
      <Topbar />

      <div>
        {/* Hero */}
        <HeroSection movies={trending} />

        {/* Rails */}
        <div className="mt-6 flex flex-col gap-6">
          <MovieCarousel title="Trending This Week" movies={trending} />
          <MovieCarousel title="Now Playing" movies={nowPlaying} />
          <MovieCarousel title="Top Rated" movies={topRated} />
          <MovieCarousel title="Action" movies={action} />
          <MovieCarousel title="Adventure" movies={adventure} />
          <MovieCarousel title="Thriller" movies={thriller} />
          <MovieCarousel title="Sci-Fi" movies={scifi} />
        </div>

        {/* Popular grid */}
        <div className="mt-6 mb-10">
          <div className="px-4 md:px-8 mb-4">
            <SectionDivider label={`Popular on ${APP_NAME}`} />
          </div>
          <MovieGrid movies={popular.results} />
        </div>
      </div>
    </>
  );
}
