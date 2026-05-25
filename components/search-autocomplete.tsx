'use client';

import { useDebounce } from '@/lib/use-debounce';
import { SearchDropdown } from '@/components/search-dropdown';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  flattenAutocompleteItems,
  shouldFetchAutocomplete,
  getNextSelectedIndex,
  isValidSelection,
} from '@/lib/search-autocomplete-utils';
import type { TMDBMovie, TMDBSeries, TMDBPersonSearchHit } from '@/types/tmdb';

const initialSuggestions = {
  movies: [] as TMDBMovie[],
  series: [] as TMDBSeries[],
  people: [] as TMDBPersonSearchHit[],
};

export function SearchAutocomplete() {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState('');
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
    inputRef.current?.focus();
  }, []);

  // Reset when route changes (skip initial mount so opening search on a page still works).
  useEffect(() => {
    if (prevPathnameRef.current === pathname) return;
    prevPathnameRef.current = pathname;
    fetchGenerationRef.current += 1;
    setQuery('');
    setSuggestions(null);
    setSuggestionsLoading(false);
    setSuggestionsError(false);
    setSelectedIndex(-1);
    setShowDropdown(false);
  }, [pathname]);

  useEffect(() => {
    const q = debouncedQuery.trim();
    if (!shouldFetchAutocomplete(q)) {
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
  }, [debouncedQuery]);

  useEffect(() => {
    setSelectedIndex(-1);
  }, [debouncedQuery]);

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
      router.push(items[selectedIndex]!.href);
      setQuery('');
      setShowDropdown(false);
    }
  }

  const handleSubmit: React.FormEventHandler = useCallback(
    (e) => {
      e.preventDefault();
      const q = query.trim();
      if (!q) return;
      const url = `/search?q=${encodeURIComponent(q)}&tab=movies`;
      router.push(url);
      if (pathname === '/search') {
        setTimeout(() => router.refresh(), 0);
      }
      setQuery('');
      setShowDropdown(false);
    },
    [query, pathname, router],
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
            } else {
              setShowDropdown(true);
            }
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (shouldFetchAutocomplete(query) && !suggestionsLoading) {
              setShowDropdown(true);
            }
          }}
          placeholder="Search movies, TV, cast…"
          className="bg-black/60 border border-white/20 rounded px-3 py-1.5 text-sm text-white placeholder-white/40 outline-none focus:border-white/60 w-44 md:w-64"
        />
        {showDropdown && shouldFetchAutocomplete(query) && (
          <SearchDropdown
            movies={suggestions?.movies ?? initialSuggestions.movies}
            series={suggestions?.series ?? initialSuggestions.series}
            people={suggestions?.people ?? initialSuggestions.people}
            query={query}
            loading={suggestionsLoading}
            error={suggestionsError}
            selectedIndex={selectedIndex}
            onClose={() => {
              setShowDropdown(false);
              setQuery('');
            }}
          />
        )}
      </div>
    </form>
  );
}
