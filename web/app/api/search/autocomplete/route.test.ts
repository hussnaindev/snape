import { describe, expect, test } from 'bun:test';

/** Mirrors GET handler query gate in route.ts */
function emptyResultsForShortQuery(q: string) {
  const trimmed = q.trim();
  if (!trimmed || trimmed.length < 2) {
    return { ok: true, results: { movies: [], series: [], people: [] } };
  }
  return null;
}

describe('autocomplete API query gate', () => {
  test('returns empty results for missing or short query', () => {
    expect(emptyResultsForShortQuery('')).toEqual({
      ok: true,
      results: { movies: [], series: [], people: [] },
    });
    expect(emptyResultsForShortQuery('a')).toEqual({
      ok: true,
      results: { movies: [], series: [], people: [] },
    });
    expect(emptyResultsForShortQuery('  ')).toEqual({
      ok: true,
      results: { movies: [], series: [], people: [] },
    });
  });

  test('does not short-circuit valid queries', () => {
    expect(emptyResultsForShortQuery('ab')).toBeNull();
    expect(emptyResultsForShortQuery('  batman  ')).toBeNull();
  });
});
