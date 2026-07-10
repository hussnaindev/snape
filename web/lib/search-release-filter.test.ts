import { describe, expect, test } from 'bun:test';
import {
  filterReleasedSearchMovies,
  filterReleasedSearchSeries,
  isReleasedOnOrBeforeCutoff,
} from './search-release-filter';
import type { TMDBMovie, TMDBSeries } from '@/types/tmdb';

const CUTOFF = '2026-05-26';

function movie(overrides: Partial<TMDBMovie> & Pick<TMDBMovie, 'id'>): TMDBMovie {
  return {
    title: 'Title',
    overview: '',
    poster_path: '/p.jpg',
    backdrop_path: '/b.jpg',
    release_date: '2020-01-01',
    vote_average: 0,
    vote_count: 0,
    genre_ids: [],
    popularity: 0,
    ...overrides,
  };
}

function show(overrides: Partial<TMDBSeries> & Pick<TMDBSeries, 'id'>): TMDBSeries {
  return {
    name: 'Show',
    overview: '',
    poster_path: '/p.jpg',
    backdrop_path: '/b.jpg',
    first_air_date: '2020-01-01',
    vote_average: 0,
    vote_count: 0,
    genre_ids: [],
    popularity: 0,
    origin_country: [],
    ...overrides,
  };
}

describe('isReleasedOnOrBeforeCutoff', () => {
  test('rejects empty and short dates', () => {
    expect(isReleasedOnOrBeforeCutoff('', CUTOFF)).toBe(false);
    expect(isReleasedOnOrBeforeCutoff('2026', CUTOFF)).toBe(false);
  });

  test('accepts past and today', () => {
    expect(isReleasedOnOrBeforeCutoff('1999-12-31', CUTOFF)).toBe(true);
    expect(isReleasedOnOrBeforeCutoff(CUTOFF, CUTOFF)).toBe(true);
  });

  test('rejects future dates', () => {
    expect(isReleasedOnOrBeforeCutoff('2099-01-01', CUTOFF)).toBe(false);
  });
});

describe('filterReleasedSearchMovies', () => {
  test('single pass drops collections and unreleased', () => {
    const items = [
      movie({ id: 1, release_date: '2020-01-01' }),
      movie({ id: 2, release_date: '2099-01-01' }),
      { ...movie({ id: 3, release_date: '2020-01-01' }), media_type: 'collection' } as TMDBMovie & {
        media_type: string;
      },
      movie({ id: 4, release_date: CUTOFF }),
    ];
    expect(filterReleasedSearchMovies(items, CUTOFF).map((m) => m.id)).toEqual([1, 4]);
  });
});

describe('filterReleasedSearchSeries', () => {
  test('single pass drops unreleased series', () => {
    const items = [
      show({ id: 1, first_air_date: '2015-01-01' }),
      show({ id: 2, first_air_date: '2099-12-01' }),
    ];
    expect(filterReleasedSearchSeries(items, CUTOFF).map((s) => s.id)).toEqual([1]);
  });
});
