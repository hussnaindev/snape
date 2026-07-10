import type { TMDBMovie, TMDBPersonSearchHit, TMDBSeries } from '@/types/tmdb';

export const AUTOCOMPLETE_MIN_QUERY_LENGTH = 2;
export const AUTOCOMPLETE_ITEM_LIMIT = 4;

export type AutocompleteResults = {
  movies: TMDBMovie[];
  series: TMDBSeries[];
  people: TMDBPersonSearchHit[];
};

export type FlatAutocompleteItem = { href: string };

export function shouldFetchAutocomplete(query: string): boolean {
  return query.trim().length >= AUTOCOMPLETE_MIN_QUERY_LENGTH;
}

export function flattenAutocompleteItems(
  suggestions: AutocompleteResults | null,
  limit = AUTOCOMPLETE_ITEM_LIMIT,
): FlatAutocompleteItem[] {
  if (!suggestions) return [];
  const items: FlatAutocompleteItem[] = [];
  for (const movie of suggestions.movies.slice(0, limit)) {
    items.push({ href: `/movie/${movie.id}` });
  }
  for (const show of suggestions.series.slice(0, limit)) {
    items.push({ href: `/series/${show.id}` });
  }
  for (const person of suggestions.people.slice(0, limit)) {
    items.push({ href: `/person/${person.id}` });
  }
  return items;
}

/** Mirrors SearchDropdown flat index assignment (movies → series → people). */
export function flatIndexForCategory(
  results: AutocompleteResults,
  category: 'movies' | 'series' | 'people',
  indexInCategory: number,
): number {
  let idx = -1;
  for (let i = 0; i < results.movies.length; i++) {
    idx++;
    if (category === 'movies' && i === indexInCategory) return idx;
  }
  for (let i = 0; i < results.series.length; i++) {
    idx++;
    if (category === 'series' && i === indexInCategory) return idx;
  }
  for (let i = 0; i < results.people.length; i++) {
    idx++;
    if (category === 'people' && i === indexInCategory) return idx;
  }
  return -1;
}

export function getNextSelectedIndex(
  direction: 'up' | 'down',
  current: number,
  total: number,
): number {
  if (direction === 'down') {
    return current < total - 1 ? current + 1 : current;
  }
  return current > -1 ? current - 1 : -1;
}

export function isValidSelection(selectedIndex: number, total: number): boolean {
  return selectedIndex >= 0 && selectedIndex < total;
}
