import type { TMDBMovie } from '@/types/tmdb';
import { MovieCard } from './movie-card';
import { SectionDivider } from './ui/section-divider';

interface MovieCarouselProps {
  title: string;
  movies: TMDBMovie[];
}

export function MovieCarousel({ title, movies }: MovieCarouselProps) {
  return (
    <section className="px-4 md:px-8">
      <SectionDivider label={title} className="mb-2" />
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
        {movies.map((movie) => (
          <div
            key={movie.id}
            className="flex-none w-[130px] sm:w-[240px] md:w-[300px] lg:w-[340px]"
          >
            <MovieCard movie={movie} />
          </div>
        ))}
      </div>
    </section>
  );
}
