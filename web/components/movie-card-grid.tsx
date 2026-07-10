import { ParallaxContent } from '@/components/parallax-content';
import { MovieCard } from '@/components/movie-card';
import { chunk } from '@/lib/utils';
import type { TMDBMovie } from '@/types/tmdb';

const ROW_SIZE = 6;

type Props = {
  movies: TMDBMovie[];
  parallaxRows?: boolean;
};

export function MovieCardGrid({ movies, parallaxRows }: Props) {
  if (parallaxRows) {
    return (
      <>
        <div className="grid grid-cols-2 gap-3 px-4 sm:hidden">
          {movies.map((movie) => (
            <MovieCard key={movie.id} movie={movie} />
          ))}
        </div>
        <div className="hidden sm:block">
          {chunk(movies, ROW_SIZE).map((row, i) => (
            <section key={i}>
              <ParallaxContent direction={i % 2 === 0 ? 'left' : 'right'} speed={120}>
                <div className="grid grid-cols-[repeat(auto-fit,minmax(165px,210px))] justify-center gap-3 px-4 md:px-8">
                  {row.map((movie) => (
                    <MovieCard key={movie.id} movie={movie} />
                  ))}
                </div>
              </ParallaxContent>
            </section>
          ))}
        </div>
      </>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 px-4">
      {movies.map((movie) => (
        <MovieCard key={movie.id} movie={movie} />
      ))}
    </div>
  );
}
