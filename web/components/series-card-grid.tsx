import { ParallaxContent } from '@/components/parallax-content';
import { SeriesCard } from '@/components/series-card';
import { chunk } from '@/lib/utils';
import type { TMDBSeries } from '@/types/tmdb';

const ROW_SIZE = 6;

type Props = {
  series: TMDBSeries[];
  parallaxRows?: boolean;
};

export function SeriesCardGrid({ series, parallaxRows }: Props) {
  if (parallaxRows) {
    return (
      <>
        <div className="grid grid-cols-2 gap-3 px-4 sm:hidden">
          {series.map((s) => (
            <SeriesCard key={s.id} series={s} />
          ))}
        </div>
        <div className="hidden sm:block">
          {chunk(series, ROW_SIZE).map((row, i) => (
            <section key={row.map((s) => s.id).join('-')} className="relative z-0 hover:z-50">
              <ParallaxContent direction={i % 2 === 0 ? 'left' : 'right'} speed={120}>
                <div className="grid grid-cols-[repeat(auto-fit,minmax(165px,210px))] justify-center gap-3 px-4 md:px-8">
                  {row.map((s) => (
                    <SeriesCard key={s.id} series={s} />
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
      {series.map((s) => (
        <SeriesCard key={s.id} series={s} />
      ))}
    </div>
  );
}
