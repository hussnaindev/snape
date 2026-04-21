'use client';

import { Logo } from '@/components/ui/logo';
import { APP_NAME } from '@/lib/config';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

const GENRES = [
  { id: 28, name: 'Action' },
  { id: 12, name: 'Adventure' },
  { id: 16, name: 'Animation' },
  { id: 35, name: 'Comedy' },
  { id: 80, name: 'Crime' },
  { id: 18, name: 'Drama' },
  { id: 10751, name: 'Family' },
  { id: 14, name: 'Fantasy' },
  { id: 36, name: 'History' },
  { id: 27, name: 'Horror' },
  { id: 10749, name: 'Romance' },
  { id: 878, name: 'Sci-Fi' },
  { id: 53, name: 'Thriller' },
];

export function Topbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);
  const [browseOpen, setBrowseOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const browseRef = useRef<HTMLDivElement>(null);

  function openSearch() {
    setSearchOpen(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    const url = `/search?q=${encodeURIComponent(q)}&tab=movies`;
    router.push(url);
    // Same pathname with a new `q` only updates the URL; the `/search` RSC payload can stay
    // cached and skip re-fetching. Refresh forces the server page to run with the new query.
    if (pathname === '/search') {
      setTimeout(() => router.refresh(), 0);
    }
    setSearchOpen(false);
    setQuery('');
  }

  return (
    <header className="fixed inset-x-0 top-0 z-50 h-16 flex items-center px-4 md:px-8">
      {/* gradient fade background */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/80 to-transparent pointer-events-none" />

      <div className="relative flex w-full items-center justify-between">
        {/* Wordmark */}
        <Link href="/" className="flex items-center gap-2 text-white">
          <Logo className="w-5 h-5 md:w-7 md:h-7 text-white" />
          {/** Keeping it commented for future use */}
          {/* <span className="font-body text-sm md:text-xl font-bold tracking-widest uppercase">
            {APP_NAME}
          </span> */}
        </Link>

        {/* Browse + Search */}
        <div className="flex items-center gap-3">
          {/* Browse dropdown */}
          <div className="relative" ref={browseRef}>
            <button
              type="button"
              onClick={() => setBrowseOpen(!browseOpen)}
              className="text-white/70 hover:text-white transition-colors text-sm font-medium px-2 py-1"
            >
              Browse
            </button>
            {browseOpen && (
              <div className="absolute top-full right-0 mt-1 bg-[#1a1a1a] rounded-lg shadow-xl border border-white/10 w-48 overflow-hidden z-50">
                {GENRES.map((genre) => (
                  <Link
                    key={genre.id}
                    href={`/browse/${genre.id}?name=${encodeURIComponent(genre.name)}`}
                    onClick={() => setBrowseOpen(false)}
                    className="block px-4 py-2 text-white/70 hover:text-white hover:bg-white/5 transition-colors text-sm"
                  >
                    {genre.name}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {searchOpen ? (
            <form onSubmit={handleSearch} className="flex items-center gap-2 animate-fade-in">
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Escape' && setSearchOpen(false)}
                placeholder="Search movies, TV, cast…"
                className="bg-black/60 border border-white/20 rounded px-3 py-1.5 text-sm text-white placeholder-white/40 outline-none focus:border-white/60 w-44 md:w-64"
              />
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                className="text-white/50 hover:text-white text-lg"
              >
                ✕
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={openSearch}
              aria-label="Search"
              className="text-white/70 hover:text-white transition-colors p-1"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
