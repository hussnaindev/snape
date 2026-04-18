import type { TMDBSeries } from '@/types/tmdb';
import { SeriesCard } from './series-card';

interface SeriesGridProps {
  series: TMDBSeries[];
}

export function SeriesGrid({ series }: SeriesGridProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 px-4 md:px-8">
      {series.map((s) => (
        <SeriesCard key={s.id} series={s} imageSize="w1280" />
      ))}
    </div>
  );
}
