'use client';

import { TvPlayer } from '@/components/tv-player';
import { useDebounce } from '@/lib/use-debounce';
import { cn } from '@/lib/utils';
import type { Channel } from '@/types/channels';
import { useEffect, useRef, useState } from 'react';

const DISPLAY_CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'general', label: 'General' },
  { id: 'news', label: 'News' },
  { id: 'sports', label: 'Sports' },
  { id: 'entertainment', label: 'Entertainment' },
  { id: 'movies', label: 'Movies' },
  { id: 'music', label: 'Music' },
  { id: 'kids', label: 'Kids' },
  { id: 'documentary', label: 'Documentary' },
  { id: 'series', label: 'Series' },
  { id: 'lifestyle', label: 'Lifestyle' },
  { id: 'science', label: 'Science' },
  { id: 'nature', label: 'Nature' },
  { id: 'travel', label: 'Travel' },
  { id: 'comedy', label: 'Comedy' },
  { id: 'business', label: 'Business' },
  { id: 'cooking', label: 'Cooking' },
  { id: 'education', label: 'Education' },
  { id: 'weather', label: 'Weather' },
];

export function ChannelsView() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchSelectedIdx, setSearchSelectedIdx] = useState(-1);
  const debouncedSearch = useDebounce(searchQuery, 150);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Fetch channels on mount
  useEffect(() => {
    let cancelled = false;
    fetch('/api/channels')
      .then((r) => r.json())
      .then((data: unknown) => {
        if (cancelled) return;
        if (
          data != null &&
          typeof data === 'object' &&
          'ok' in data &&
          (data as { ok: boolean }).ok &&
          'channels' in data &&
          Array.isArray((data as { channels: unknown }).channels)
        ) {
          setChannels((data as { channels: Channel[] }).channels);
        } else {
          setLoadError(true);
        }
      })
      .catch(() => { if (!cancelled) setLoadError(true); })
      .finally(() => { if (!cancelled) setLoadingChannels(false); });
    return () => { cancelled = true; };
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  // Channels filtered by category
  const categoryFiltered =
    activeCategory === 'all'
      ? channels
      : channels.filter((ch) =>
          ch.categories.some((c) => c.toLowerCase() === activeCategory),
        );

  // Channels visible in the list (also filtered by search when typed)
  const visibleChannels =
    debouncedSearch.trim()
      ? categoryFiltered.filter((ch) =>
          ch.name.toLowerCase().includes(debouncedSearch.toLowerCase()),
        )
      : categoryFiltered;

  // Dropdown results (capped for performance)
  const dropdownResults =
    debouncedSearch.trim().length >= 1
      ? categoryFiltered
          .filter((ch) =>
            ch.name.toLowerCase().includes(debouncedSearch.toLowerCase()),
          )
          .slice(0, 25)
      : [];

  const showDropdown = dropdownOpen && dropdownResults.length > 0;

  function selectChannel(ch: Channel) {
    setSelectedChannel(ch);
    setDropdownOpen(false);
    setSearchQuery('');
    setSearchSelectedIdx(-1);
  }

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showDropdown) return;
    const total = dropdownResults.length;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSearchSelectedIdx((p) => (p + 1) % total);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSearchSelectedIdx((p) => (p - 1 + total) % total);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const ch =
        dropdownResults[searchSelectedIdx >= 0 ? searchSelectedIdx : 0];
      if (ch) selectChannel(ch);
    } else if (e.key === 'Escape') {
      setDropdownOpen(false);
    }
  }

  // ------------------------------------------------------------------ //
  //  Sidebar content (shared between desktop + mobile)
  // ------------------------------------------------------------------ //
  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="p-3 border-b border-white/10 shrink-0">
        <div ref={searchContainerRef} className="relative">
          <div className="relative flex items-center">
            <svg
              className="absolute left-3 text-white/35 pointer-events-none"
              width="14"
              height="14"
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
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSearchSelectedIdx(-1);
                setDropdownOpen(e.target.value.trim().length >= 1);
              }}
              onFocus={() => {
                if (searchQuery.trim().length >= 1) setDropdownOpen(true);
              }}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search channels…"
              className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-8 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-white/30 transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setDropdownOpen(false);
                  setSearchSelectedIdx(-1);
                }}
                className="absolute right-2.5 text-white/30 hover:text-white/60 transition-colors cursor-pointer"
                aria-label="Clear search"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>

          {/* Search dropdown */}
          {showDropdown && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-[#111113] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-[70] animate-fade-in">
              <div className="max-h-64 overflow-y-auto no-scrollbar py-1">
                {dropdownResults.map((ch, i) => (
                  <button
                    key={`${ch.id}-${ch.streamUrl}`}
                    type="button"
                    onClick={() => selectChannel(ch)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2 text-sm text-left cursor-pointer transition-colors',
                      i === searchSelectedIdx
                        ? 'bg-white/10 text-white'
                        : 'text-white/70 hover:bg-white/5 hover:text-white',
                    )}
                  >
                    {ch.logo ? (
                      <img
                        src={ch.logo}
                        alt=""
                        className="w-9 h-6 object-contain rounded shrink-0 bg-white/5"
                      />
                    ) : (
                      <div className="w-9 h-6 rounded bg-white/5 shrink-0 flex items-center justify-center ring-1 ring-inset ring-white/10">
                        <TvIcon size={12} />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{ch.name}</div>
                      {ch.categories[0] && (
                        <div className="text-xs text-white/35 truncate capitalize">
                          {ch.categories[0]}
                          {ch.country ? ` · ${ch.country}` : ''}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Category tabs */}
      <div className="shrink-0 border-b border-white/10">
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar px-3 py-2">
          {DISPLAY_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className={cn(
                'shrink-0 px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap cursor-pointer transition-colors',
                activeCategory === cat.id
                  ? 'bg-white text-black'
                  : 'bg-white/5 text-white/55 hover:bg-white/10 hover:text-white',
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Channel list */}
      <div className="flex-1 overflow-y-auto no-scrollbar">
        {loadingChannels && (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-white/35">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="animate-spin"
              aria-hidden="true"
            >
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
            <span className="text-sm">Loading channels…</span>
          </div>
        )}

        {!loadingChannels && loadError && (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-white/35 text-sm px-4 text-center">
            <TvIcon size={24} />
            <span>Failed to load channels</span>
          </div>
        )}

        {!loadingChannels && !loadError && visibleChannels.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-white/35 text-sm">
            No channels found
          </div>
        )}

        {!loadingChannels && !loadError && visibleChannels.length > 0 && (
          <div className="py-1">
            {visibleChannels.map((ch) => {
              const isActive = selectedChannel?.streamUrl === ch.streamUrl;
              return (
                <button
                  key={`${ch.id}-${ch.streamUrl}`}
                  type="button"
                  onClick={() => setSelectedChannel(ch)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 transition-colors text-left cursor-pointer',
                    isActive
                      ? 'bg-white/10 text-white'
                      : 'text-white/65 hover:bg-white/5 hover:text-white',
                  )}
                >
                  {ch.logo ? (
                    <img
                      src={ch.logo}
                      alt=""
                      className="w-10 h-7 object-contain rounded shrink-0 bg-white/5"
                    />
                  ) : (
                    <div className="w-10 h-7 rounded bg-white/5 shrink-0 flex items-center justify-center ring-1 ring-inset ring-white/10">
                      <TvIcon size={14} />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{ch.name}</div>
                    {(ch.categories[0] ?? ch.country) && (
                      <div className="text-xs text-white/35 truncate capitalize">
                        {ch.categories[0]}
                        {ch.country ? ` · ${ch.country}` : ''}
                      </div>
                    )}
                  </div>
                  {isActive && (
                    <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-red-500" />
                  )}
                </button>
              );
            })}
          </div>
        )}

        {!loadingChannels && !loadError && visibleChannels.length > 0 && (
          <div className="px-3 py-3 text-center text-xs text-white/20 border-t border-white/5">
            {visibleChannels.length.toLocaleString()} channels
          </div>
        )}
      </div>
    </div>
  );

  const emptyPlayer = (
    <div className="flex flex-col items-center justify-center gap-4 text-white/20 select-none p-8 text-center">
      <TvIcon size={56} />
      <div>
        <p className="text-base font-medium text-white/30">Select a channel</p>
        <p className="text-sm mt-1">Pick a channel from the list to start watching</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Topbar spacer */}
      <div
        className="h-16 shrink-0"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      />

      {/* ---- Mobile layout: player on top, list below ---- */}
      <div className="md:hidden flex flex-col flex-1">
        <div className="w-full bg-black aspect-video">
          {selectedChannel ? (
            <TvPlayer channel={selectedChannel} className="w-full h-full" />
          ) : (
            <div className="w-full h-full bg-[#0a0a0b] flex items-center justify-center">
              {emptyPlayer}
            </div>
          )}
        </div>
        <div
          className="bg-[#0a0a0b] border-t border-white/10 flex flex-col"
          style={{ minHeight: '60vh' }}
        >
          {sidebarContent}
        </div>
      </div>

      {/* ---- Desktop layout: sidebar + player ---- */}
      <div
        className="hidden md:flex flex-1 overflow-hidden"
        style={{ height: 'calc(100vh - 4rem)' }}
      >
        {/* Sidebar */}
        <div className="w-[17rem] xl:w-72 shrink-0 bg-[#0a0a0b] border-r border-white/10 flex flex-col overflow-hidden">
          {sidebarContent}
        </div>

        {/* Player area */}
        <div className="flex-1 bg-black flex items-center justify-center overflow-hidden">
          {selectedChannel ? (
            <TvPlayer channel={selectedChannel} className="w-full h-full" />
          ) : (
            emptyPlayer
          )}
        </div>
      </div>
    </div>
  );
}

function TvIcon({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="7" width="20" height="15" rx="2" ry="2" />
      <polyline points="17 2 12 7 7 2" />
    </svg>
  );
}
