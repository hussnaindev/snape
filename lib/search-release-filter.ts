import type { TMDBMovie, TMDBSeries } from '@/types/tmdb';

/** Fast path: TMDB dates are YYYY-MM-DD; length check avoids empty/invalid compares. */
export function isReleasedOnOrBeforeCutoff(date: string, cutoff: string): boolean {
  return date.length >= 10 && date <= cutoff;
}

/** One pass — drops collections and unreleased titles (search API has no date params). */
export function filterReleasedSearchMovies(
  items: readonly TMDBMovie[],
  cutoff: string,
): TMDBMovie[] {
  const out: TMDBMovie[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    if ((item as { media_type?: string }).media_type === 'collection') continue;
    if (isReleasedOnOrBeforeCutoff(item.release_date, cutoff)) out.push(item);
  }
  return out;
}

/** One pass — drops collections and series that have not aired yet. */
export function filterReleasedSearchSeries(
  items: readonly TMDBSeries[],
  cutoff: string,
): TMDBSeries[] {
  const out: TMDBSeries[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    if ((item as { media_type?: string }).media_type === 'collection') continue;
    if (isReleasedOnOrBeforeCutoff(item.first_air_date, cutoff)) out.push(item);
  }
  return out;
}
