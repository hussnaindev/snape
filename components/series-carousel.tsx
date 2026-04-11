import type { TMDBSeries } from '@/types/tmdb';
import { SeriesCard } from './series-card';
import { SectionDivider } from './ui/section-divider';

interface SeriesCarouselProps {
  title: string;
  series: TMDBSeries[];
}

export function SeriesCarousel({ title, series }: SeriesCarouselProps) {
  return (
    <section className="px-4 md:px-8">
      <SectionDivider label={title} className="mb-2" />
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
        {series.map((s) => (
          <div key={s.id} className="flex-none w-[130px] sm:w-[240px] md:w-[300px] lg:w-[340px]">
            <SeriesCard series={s} />
          </div>
        ))}
      </div>
    </section>
  );
}
