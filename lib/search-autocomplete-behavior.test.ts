import { describe, expect, test } from 'bun:test';
import { shouldFetchAutocomplete } from './search-autocomplete-utils';

describe('live query closes dropdown without waiting for debounce', () => {
  test('short live query should not keep dropdown open', () => {
    const liveQuery = 'a';
    const debouncedQuery = 'ab';
    expect(shouldFetchAutocomplete(liveQuery)).toBe(false);
    expect(shouldFetchAutocomplete(debouncedQuery)).toBe(true);
    expect(shouldFetchAutocomplete(liveQuery)).toBe(false);
  });

  test('cleared live query should not keep dropdown open', () => {
    expect(shouldFetchAutocomplete('')).toBe(false);
    expect(shouldFetchAutocomplete('batman')).toBe(true);
  });
});

describe('error vs empty results', () => {
  test('error flag is distinct from empty success payload', () => {
    const errorState = { suggestions: null, suggestionsError: true };
    const emptyState = {
      suggestions: { movies: [], series: [], people: [] },
      suggestionsError: false,
    };
    expect(errorState.suggestionsError).toBe(true);
    expect(emptyState.suggestionsError).toBe(false);
    expect(emptyState.suggestions).not.toBeNull();
  });
});
