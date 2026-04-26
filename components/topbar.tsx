'use client';

import { Logo } from '@/components/ui/logo';
import { UserMenu } from '@/components/user-menu';
import { APP_NAME } from '@/lib/config';
import { clearAllWatchHistory } from '@/lib/watch-history';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from './auth/auth-provider';
import { useEffect, useRef, useState } from 'react';

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
  const { user, isLoading, logout } = useAuth();
  const [searchOpen, setSearchOpen] = useState(false);
  const [browseOpen, setBrowseOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const browseRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

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
          <div className="relative hidden md:block" ref={browseRef}>
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

          <UserMenu />

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

          {/* Mobile-only: hamburger (keep as the rightmost action) */}
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="md:hidden w-10 h-10 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors flex items-center justify-center text-white/80"
            aria-label="Open menu"
          >
            <HamburgerIcon />
          </button>
        </div>
      </div>

      {/* Mobile-only: sidebar */}
      {mobileOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 bg-black/60 z-[60] backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <div className="md:hidden fixed top-0 right-0 bottom-0 w-80 max-w-[85vw] bg-[#0f0f10] z-[61] border-l border-white/10 flex flex-col shadow-2xl animate-slide-in-right">
            <div className="flex items-center justify-between px-5 pt-10 pb-5 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                  <Logo className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-white text-sm font-semibold">Menu</p>
                  <p className="text-white/40 text-xs">Browse & account</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="ml-2 flex-none w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Close menu"
              >
                <CloseIcon />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* Browse */}
              <div className="px-4 pt-4 pb-2">
                <p className="text-white/40 text-[11px] font-semibold tracking-wider uppercase">Browse</p>
              </div>
              <nav className="px-3 pb-3 space-y-0.5">
                {GENRES.map((genre) => (
                  <Link
                    key={genre.id}
                    href={`/browse/${genre.id}?name=${encodeURIComponent(genre.name)}`}
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center justify-between px-4 py-3 text-sm font-medium text-white/70 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
                  >
                    <span>{genre.name}</span>
                    <ChevronIcon />
                  </Link>
                ))}
              </nav>

              {/* Continue watching — clear lives here on small screens (desktop: row on homepage) */}
              <div className="px-4 pt-1 pb-2 border-t border-white/10">
                <p className="text-white/40 text-[11px] font-semibold tracking-wider uppercase">
                  Continue watching
                </p>
              </div>
              <div className="px-3 pb-3">
                <button
                  type="button"
                  onClick={async () => {
                    await clearAllWatchHistory();
                    setMobileOpen(false);
                    router.refresh();
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-white/45 hover:text-white/75 hover:bg-white/5 rounded-xl transition-colors text-left"
                >
                  <ClearHistoryIcon />
                  Clear watch history
                </button>
              </div>

              {/* Account */}
              <div className="px-4 pt-2 pb-2 border-t border-white/10">
                <p className="text-white/40 text-[11px] font-semibold tracking-wider uppercase">Account</p>
              </div>

              <div className="px-3 pb-4 space-y-0.5">
                {isLoading ? (
                  <div className="px-4 py-3 rounded-xl bg-white/5 text-white/40 text-sm">Loading…</div>
                ) : user ? (
                  <>
                    <Link
                      href="/profile"
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-white/70 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
                    >
                      <ProfileIcon /> Profile
                    </Link>
                    <Link
                      href="/watchlist"
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-white/70 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
                    >
                      <BookmarkIcon /> My Watchlist
                    </Link>
                    <Link
                      href="/settings"
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-white/70 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
                    >
                      <SettingsIcon /> Settings
                    </Link>
                    <button
                      type="button"
                      onClick={async () => {
                        setMobileOpen(false);
                        await logout();
                        router.push('/');
                        router.refresh();
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-red-400 hover:bg-red-500/10 rounded-xl transition-colors text-left mt-1"
                    >
                      <SignOutIcon /> Sign out
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      href="/auth/login"
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-white/70 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
                    >
                      <SignInIcon /> Login
                    </Link>
                    <Link
                      href="/auth/signup"
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-white/70 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
                    >
                      <PlusUserIcon /> Create account
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </header>
  );
}

function ClearHistoryIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

function HamburgerIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" aria-hidden="true">
      <line x1="4" y1="7" x2="20" y2="7" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="17" x2="20" y2="17" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-white/35">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}

function BookmarkIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function SignOutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function SignInIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <polyline points="10 17 15 12 10 7" />
      <line x1="15" y1="12" x2="3" y2="12" />
    </svg>
  );
}

function PlusUserIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="8.5" cy="7" r="4" />
      <line x1="20" y1="8" x2="20" y2="14" />
      <line x1="17" y1="11" x2="23" y2="11" />
    </svg>
  );
}
