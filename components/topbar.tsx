'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { APP_NAME } from '@/lib/config';
import { Logo } from '@/components/ui/logo';

export function Topbar() {
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  function openSearch() {
    setSearchOpen(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    router.push(`/search?q=${encodeURIComponent(q)}`);
    setSearchOpen(false);
    setQuery('');
  }

  return (
    <header className="fixed inset-x-0 top-0 z-50 h-16 flex items-center px-4 md:px-8">
      {/* gradient fade background */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/80 to-transparent pointer-events-none" />

      <div className="relative flex w-full items-center justify-between">
        {/* Wordmark */}
        <Link
          href="/"
          className="flex items-center gap-2 text-white"
        >
          <Logo className="w-6 h-6 md:w-7 md:h-7 text-white" />
          <span className="font-display text-lg md:text-xl font-semibold tracking-widest uppercase">
            {APP_NAME}
          </span>
        </Link>

        {/* Search */}
        <div className="flex items-center gap-2">
          {searchOpen ? (
            <form onSubmit={handleSearch} className="flex items-center gap-2 animate-fade-in">
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Escape' && setSearchOpen(false)}
                placeholder="Search movies…"
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
