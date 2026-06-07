import type { TMDBSeries } from '@/types/tmdb';
import { SeriesCard } from './series-card';
import { SectionDivider } from './ui/section-divider';

interface SeriesCarouselProps {
  title: string;
  series: TMDBSeries[];
}

export function SeriesCarousel({ title, series }: SeriesCarouselProps) {
  return (
    <section>
      <div className="px-4 md:px-8">
        <SectionDivider label={title} className="mb-2" />
      </div>
      <div className="overflow-x-auto no-scrollbar snap-x snap-mandatory overscroll-x-contain scroll-pl-4 md:scroll-pl-8">
        <div className="flex gap-2 px-4 md:px-8 py-8">
          {series.map((s, idx) => (
            <div
              key={s.id}
              className="flex-none w-[130px] sm:w-[170px] md:w-[180px] lg:w-[190px] xl:w-[210px] 2xl:w-[240px] 3xl:w-[260px] snap-start"
            >
              <SeriesCard series={s} prefetch={false} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
