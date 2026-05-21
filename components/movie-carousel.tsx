import type { TMDBMovie } from '@/types/tmdb';
import { MovieCard } from './movie-card';
import { SectionDivider } from './ui/section-divider';

interface MovieCarouselProps {
  title: string;
  movies: TMDBMovie[];
}

export function MovieCarousel({ title, movies }: MovieCarouselProps) {
  return (
    <section>
      <div className="px-4 md:px-8">
        <SectionDivider label={title} className="mb-2" />
      </div>
      <div className="overflow-x-auto no-scrollbar">
        <div className="flex gap-2 px-4 md:px-8 pt-3 pb-2">
          {movies.map((movie) => (
            <div
              key={movie.id}
              className="flex-none w-[130px] sm:w-[170px] md:w-[180px] lg:w-[190px] xl:w-[210px] 2xl:w-[240px] 3xl:w-[260px]"
            >
              <MovieCard movie={movie} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
