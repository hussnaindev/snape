import type { TMDBMovie } from '@/types/tmdb';
import { MovieCard } from './movie-card';

interface MovieGridProps {
  movies: TMDBMovie[];
}

export function MovieGrid({ movies }: MovieGridProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 px-4 md:px-8">
      {movies.map((movie) => (
        <MovieCard key={movie.id} movie={movie} imageSize="w1280" />
      ))}
    </div>
  );
}
