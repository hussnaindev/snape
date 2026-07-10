import { describe, expect, test } from 'bun:test';
import type { TMDBMovie, TMDBPersonSearchHit, TMDBSeries } from '@/types/tmdb';
import {
  AUTOCOMPLETE_ITEM_LIMIT,
  AUTOCOMPLETE_MIN_QUERY_LENGTH,
  flatIndexForCategory,
  flattenAutocompleteItems,
  getNextSelectedIndex,
  isValidSelection,
  shouldFetchAutocomplete,
} from './search-autocomplete-utils';

function movie(id: number): TMDBMovie {
  return {
    id,
    title: `Movie ${id}`,
    poster_path: '/p.jpg',
    backdrop_path: '/b.jpg',
    release_date: '2020-01-01',
    overview: '',
    vote_average: 0,
    vote_count: 0,
    genre_ids: [],
    popularity: 0,
  };
}

function series(id: number): TMDBSeries {
  return {
    id,
    name: `Show ${id}`,
    poster_path: '/p.jpg',
    backdrop_path: '/b.jpg',
    first_air_date: '2020-01-01',
    overview: '',
    vote_average: 0,
    vote_count: 0,
    genre_ids: [],
    popularity: 0,
    origin_country: [],
  };
}

function person(id: number): TMDBPersonSearchHit {
  return {
    id,
    name: `Person ${id}`,
    profile_path: '/prof.jpg',
    known_for_department: 'Acting',
    popularity: 0,
  };
}

describe('shouldFetchAutocomplete', () => {
  test('requires at least 2 non-whitespace characters', () => {
    expect(shouldFetchAutocomplete('')).toBe(false);
    expect(shouldFetchAutocomplete(' ')).toBe(false);
    expect(shouldFetchAutocomplete('a')).toBe(false);
    expect(shouldFetchAutocomplete(' a ')).toBe(false);
    expect(shouldFetchAutocomplete('ab')).toBe(true);
    expect(shouldFetchAutocomplete('  ab  ')).toBe(true);
  });
});

describe('flattenAutocompleteItems', () => {
  test('returns empty for null suggestions', () => {
    expect(flattenAutocompleteItems(null)).toEqual([]);
  });

  test('orders movies then series then people', () => {
    const flat = flattenAutocompleteItems({
      movies: [movie(1), movie(2)],
      series: [series(10)],
      people: [person(100)],
    });
    expect(flat.map((i) => i.href)).toEqual(['/movie/1', '/movie/2', '/series/10', '/person/100']);
  });

  test('caps each category at AUTOCOMPLETE_ITEM_LIMIT', () => {
    const many = Array.from({ length: 8 }, (_, i) => movie(i + 1));
    const flat = flattenAutocompleteItems({
      movies: many,
      series: [],
      people: [],
    });
    expect(flat).toHaveLength(AUTOCOMPLETE_ITEM_LIMIT);
    expect(flat[0]?.href).toBe('/movie/1');
    expect(flat[3]?.href).toBe('/movie/4');
  });

  test('max flat items when all categories full', () => {
    const manyMovies = Array.from({ length: 4 }, (_, i) => movie(i + 1));
    const manySeries = Array.from({ length: 4 }, (_, i) => series(i + 10));
    const manyPeople = Array.from({ length: 4 }, (_, i) => person(i + 100));
    const flat = flattenAutocompleteItems({
      movies: manyMovies,
      series: manySeries,
      people: manyPeople,
    });
    expect(flat).toHaveLength(12);
  });

  test('empty categories are skipped in ordering', () => {
    const flat = flattenAutocompleteItems({
      movies: [],
      series: [series(5)],
      people: [person(9)],
    });
    expect(flat.map((i) => i.href)).toEqual(['/series/5', '/person/9']);
  });
});

describe('flatIndexForCategory', () => {
  test('matches flattenAutocompleteItems indices', () => {
    const results = {
      movies: [movie(1), movie(2)],
      series: [series(3)],
      people: [person(4), person(5)],
    };
    const flat = flattenAutocompleteItems(results);
    expect(flatIndexForCategory(results, 'movies', 0)).toBe(0);
    expect(flatIndexForCategory(results, 'movies', 1)).toBe(1);
    expect(flatIndexForCategory(results, 'series', 0)).toBe(2);
    expect(flatIndexForCategory(results, 'people', 0)).toBe(3);
    expect(flatIndexForCategory(results, 'people', 1)).toBe(4);
  });

  test('empty category returns -1', () => {
    const results = { movies: [movie(1)], series: [], people: [] };
    expect(flatIndexForCategory(results, 'series', 0)).toBe(-1);
  });
});

describe('keyboard selection', () => {
  test('arrow down from -1 selects first item', () => {
    expect(getNextSelectedIndex('down', -1, 5)).toBe(0);
  });

  test('arrow down stops at last item', () => {
    expect(getNextSelectedIndex('down', 4, 5)).toBe(4);
  });

  test('arrow up from 0 goes to -1', () => {
    expect(getNextSelectedIndex('up', 0, 5)).toBe(-1);
  });

  test('arrow up from -1 stays -1', () => {
    expect(getNextSelectedIndex('up', -1, 5)).toBe(-1);
  });

  test('arrow down with zero items stays -1', () => {
    expect(getNextSelectedIndex('down', -1, 0)).toBe(-1);
  });

  test('isValidSelection bounds', () => {
    expect(isValidSelection(-1, 3)).toBe(false);
    expect(isValidSelection(0, 3)).toBe(true);
    expect(isValidSelection(2, 3)).toBe(true);
    expect(isValidSelection(3, 3)).toBe(false);
  });
});

describe('API vs client limit contract', () => {
  test('client slice matches API slice when API returns more than limit', () => {
    const apiWouldReturn = {
      movies: Array.from({ length: 4 }, (_, i) => movie(i + 1)),
      series: Array.from({ length: 4 }, (_, i) => series(i + 10)),
      people: Array.from({ length: 4 }, (_, i) => person(i + 100)),
    };
    const flat = flattenAutocompleteItems(apiWouldReturn);
    expect(flat).toHaveLength(12);
    for (let i = 0; i < 4; i++) {
      expect(flatIndexForCategory(apiWouldReturn, 'movies', i)).toBe(i);
    }
  });

  test('mismatch if dropdown shows more than flatten slice (regression guard)', () => {
    const oversized = {
      movies: Array.from({ length: 6 }, (_, i) => movie(i + 1)),
      series: [],
      people: [],
    };
    const flat = flattenAutocompleteItems(oversized);
    expect(flat).toHaveLength(4);
    expect(flatIndexForCategory(oversized, 'movies', 4)).toBe(4);
    expect(flatIndexForCategory(oversized, 'movies', 5)).toBe(5);
    expect(flat[3]?.href).toBe('/movie/4');
    expect(flatIndexForCategory(oversized, 'movies', 4)).not.toBe(flat.length - 1);
  });
});

describe('min query length constant', () => {
  test('documented threshold is 2', () => {
    expect(AUTOCOMPLETE_MIN_QUERY_LENGTH).toBe(2);
  });
});
