'use client';

import { SearchDropdown } from '@/components/search-dropdown';
import { parseSearchTab } from '@/components/search-tab-chips';
import {
  flattenAutocompleteItems,
  getNextSelectedIndex,
  isValidSelection,
  shouldFetchAutocomplete,
} from '@/lib/search-autocomplete-utils';
import { useDebounce } from '@/lib/use-debounce';
import type { TMDBMovie, TMDBPersonSearchHit, TMDBSeries } from '@/types/tmdb';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

const initialSuggestions = {
  movies: [] as TMDBMovie[],
  series: [] as TMDBSeries[],
  people: [] as TMDBPersonSearchHit[],
};

export function SearchAutocomplete() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isSearchPage = pathname === '/search';
  const urlQuery = searchParams.get('q') ?? '';
  const committedQuery = urlQuery.trim();

  const [query, setQuery] = useState(() => (isSearchPage ? urlQuery : ''));
  const isCommittedResults =
    isSearchPage && query.trim() === committedQuery && committedQuery.length > 0;
  const [suggestions, setSuggestions] = useState<{
    movies: TMDBMovie[];
    series: TMDBSeries[];
    people: TMDBPersonSearchHit[];
  } | null>(null);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [showDropdown, setShowDropdown] = useState(false);
  const debouncedQuery = useDebounce(query, 300);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fetchGenerationRef = useRef(0);
  const prevPathnameRef = useRef(pathname);

  useEffect(() => {
    if (!isSearchPage) {
      inputRef.current?.focus();
    }
  }, [isSearchPage]);

  // Keep input in sync with URL on the search results page (back/forward, new results).
  useEffect(() => {
    if (isSearchPage) {
      setQuery(urlQuery);
      setShowDropdown(false);
      fetchGenerationRef.current += 1;
    }
  }, [isSearchPage, urlQuery]);

  // Reset autocomplete UI when leaving the search page.
  useEffect(() => {
    if (prevPathnameRef.current === pathname) return;
    const wasSearchPage = prevPathnameRef.current === '/search';
    prevPathnameRef.current = pathname;

    fetchGenerationRef.current += 1;
    setSuggestions(null);
    setSuggestionsLoading(false);
    setSuggestionsError(false);
    setSelectedIndex(-1);
    setShowDropdown(false);

    if (pathname === '/search') {
      setQuery(urlQuery);
    } else if (wasSearchPage) {
      setQuery('');
    }
  }, [pathname, urlQuery]);

  useEffect(() => {
    const q = debouncedQuery.trim();
    if (!shouldFetchAutocomplete(q)) {
      setSuggestions(null);
      setSuggestionsLoading(false);
      setSuggestionsError(false);
      setShowDropdown(false);
      return;
    }

    // On results page, only suggest while the user is editing away from the committed URL query.
    if (isSearchPage && q === committedQuery) {
      setSuggestions(null);
      setSuggestionsLoading(false);
      setSuggestionsError(false);
      setShowDropdown(false);
      return;
    }

    const generation = ++fetchGenerationRef.current;
    const controller = new AbortController();

    setSuggestions(null);
    setSuggestionsError(false);
    setSuggestionsLoading(true);
    setShowDropdown(true);
    setSelectedIndex(-1);

    fetch(`/api/search/autocomplete?q=${encodeURIComponent(q)}`, {
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) return { ok: false as const };
        return res.json();
      })
      .then((data) => {
        if (generation !== fetchGenerationRef.current) return;
        if (data?.ok) {
          setSuggestions(data.results);
          setSuggestionsError(false);
        } else {
          setSuggestions(null);
          setSuggestionsError(true);
        }
        setShowDropdown(true);
      })
      .catch((err: unknown) => {
        if (generation !== fetchGenerationRef.current) return;
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setSuggestions(null);
        setSuggestionsError(true);
        setShowDropdown(true);
      })
      .finally(() => {
        if (generation === fetchGenerationRef.current) {
          setSuggestionsLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [debouncedQuery, isSearchPage, committedQuery]);

  useEffect(() => {
    setSelectedIndex(-1);
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      setShowDropdown(false);
      return;
    }

    if (suggestionsLoading || suggestionsError) return;

    const items = flattenAutocompleteItems(suggestions);
    const total = items.length;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => getNextSelectedIndex('down', prev, total));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => getNextSelectedIndex('up', prev, total));
    } else if (e.key === 'Enter' && isValidSelection(selectedIndex, total)) {
      e.preventDefault();
      router.push(items[selectedIndex]?.href ?? '');
      setShowDropdown(false);
      if (!isSearchPage) {
        setQuery('');
      }
    }
  }

  const handleSubmit: React.FormEventHandler = useCallback(
    (e) => {
      e.preventDefault();
      const q = query.trim();
      if (!q) return;
      const tab = isSearchPage ? parseSearchTab(searchParams.get('tab') ?? undefined) : 'movies';
      const url = `/search?q=${encodeURIComponent(q)}&tab=${tab}`;
      router.push(url);
      if (pathname === '/search') {
        setTimeout(() => router.refresh(), 0);
      }
      setShowDropdown(false);
      fetchGenerationRef.current += 1;
    },
    [query, pathname, router, isSearchPage, searchParams],
  );

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 animate-fade-in">
      <div ref={containerRef} className="relative">
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            const next = e.target.value;
            setQuery(next);
            setSelectedIndex(-1);
            if (!shouldFetchAutocomplete(next)) {
              setShowDropdown(false);
              setSuggestionsError(false);
            } else if (!isSearchPage || next.trim() !== committedQuery) {
              setShowDropdown(true);
            } else {
              setShowDropdown(false);
            }
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (
              shouldFetchAutocomplete(query) &&
              !suggestionsLoading &&
              (!isSearchPage || query.trim() !== committedQuery)
            ) {
              setShowDropdown(true);
            }
          }}
          placeholder="Search movies, TV, cast…"
          className="bg-black/60 border border-white/20 rounded px-3 py-1.5 text-sm text-white placeholder-white/40 outline-none focus:border-white/60 w-44 md:w-64"
        />
        {showDropdown && shouldFetchAutocomplete(query) && !isCommittedResults && (
          <SearchDropdown
            movies={suggestions?.movies ?? initialSuggestions.movies}
            series={suggestions?.series ?? initialSuggestions.series}
            people={suggestions?.people ?? initialSuggestions.people}
            query={query}
            loading={suggestionsLoading}
            error={suggestionsError}
            selectedIndex={selectedIndex}
            onClose={() => setShowDropdown(false)}
          />
        )}
      </div>
    </form>
  );
}

/** Placeholder while search params hydrate (Suspense). */
export function SearchAutocompleteFallback() {
  return (
    <div
      className="bg-black/60 border border-white/20 rounded px-3 py-1.5 text-sm w-44 md:w-64 h-[34px]"
      aria-hidden
    />
  );
}
