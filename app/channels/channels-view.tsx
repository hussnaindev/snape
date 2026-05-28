'use client';

import { TvPlayer } from '@/components/tv-player';
import { parseChannelName } from '@/lib/parse-channel-name';
import { useDebounce } from '@/lib/use-debounce';
import { cn } from '@/lib/utils';
import type { Channel } from '@/types/channels';
import { useEffect, useMemo, useRef, useState } from 'react';

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

// How many items to render in the list at once
const LIST_CAP = 400;
const SEARCH_LIST_CAP = 200;

/** Parsed display name + merged tags (client-side so cached API payloads still clean up). */
function channelDisplay(ch: Channel): { name: string; tags: string[] } {
  const parsed = parseChannelName(ch.name);
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const t of [...(ch.tags ?? []), ...parsed.tags]) {
    const token = t.trim();
    if (!token) continue;
    const key = token.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(token);
  }
  return { name: parsed.name, tags };
}

export function ChannelsView() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchSelectedIdx, setSearchSelectedIdx] = useState(-1);
  const [playerFullscreen, setPlayerFullscreen] = useState(false);

  // 200 ms debounce — smooth typing, no lag
  const debouncedSearch = useDebounce(searchQuery, 200);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // ── Fetch channels on mount ──────────────────────────────────────────
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

  // ── Close dropdown on outside click ─────────────────────────────────
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

  // ── Memoised derived lists ────────────────────────────────────────────

  // Dropdown: global search across ALL channels (not category-specific), capped at 25
  const dropdownResults = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    if (q.length < 1) return [] as Channel[];
    return channels
      .filter((ch) => channelDisplay(ch).name.toLowerCase().includes(q))
      .slice(0, 25);
  }, [channels, debouncedSearch]);

  // Category-filtered list (used when no search query)
  const categoryChannels = useMemo(() => {
    if (activeCategory === 'all') return channels;
    return channels.filter((ch) =>
      ch.categories.some((c) => c.toLowerCase() === activeCategory),
    );
  }, [channels, activeCategory]);

  // Main list: global search when query present; category view otherwise
  const visibleChannels = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    if (q.length >= 1) {
      // Global search — ignores active category
      return channels
        .filter((ch) => channelDisplay(ch).name.toLowerCase().includes(q))
        .slice(0, SEARCH_LIST_CAP);
    }
    return categoryChannels.slice(0, LIST_CAP);
  }, [channels, categoryChannels, debouncedSearch]);

  const showDropdown =
    dropdownOpen && debouncedSearch.trim().length >= 1 && dropdownResults.length > 0;

  const totalForCategory = debouncedSearch.trim().length >= 1
    ? channels.filter((ch) =>
        channelDisplay(ch).name.toLowerCase().includes(debouncedSearch.toLowerCase()),
      ).length
    : categoryChannels.length;

  // ── Interaction handlers ─────────────────────────────────────────────

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
      const ch = dropdownResults[searchSelectedIdx >= 0 ? searchSelectedIdx : 0];
      if (ch) selectChannel(ch);
    } else if (e.key === 'Escape') {
      setDropdownOpen(false);
    }
  }

  // ── Shared sidebar content ────────────────────────────────────────────
  const sidebarContent = (
    // flex col, h-full; the list is the only scrolling child
    <div className="flex flex-col h-full">

      {/* ── Search ── */}
      {/*
        overflow-visible here so the dropdown isn't clipped.
        Only the list further down gets overflow-y-auto.
      */}
      <div className="p-3 border-b border-white/10 shrink-0 relative z-[65]">
        <div ref={searchContainerRef} className="relative">
          <div className="relative flex items-center">
            <svg
              className="absolute left-3 text-white/35 pointer-events-none shrink-0"
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
              placeholder="Search all channels…"
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
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>

          {/* Search dropdown — absolute, not clipped */}
          {showDropdown && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-[#111113] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-[70] animate-fade-in">
              <div className="max-h-64 overflow-y-auto no-scrollbar py-1">
                {dropdownResults.map((ch, i) => (
                  <button
                    key={`dd-${ch.id}-${ch.streamUrl}`}
                    type="button"
                    onClick={() => selectChannel(ch)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2 text-sm text-left cursor-pointer transition-colors',
                      i === searchSelectedIdx
                        ? 'bg-white/10 text-white'
                        : 'text-white/70 hover:bg-white/5 hover:text-white',
                    )}
                  >
                    <ChannelLogo ch={ch} size="sm" />
                    <div className="min-w-0 flex-1">
                      <ChannelName>{channelDisplay(ch).name}</ChannelName>
                      <ChannelMetaRow tags={channelDisplay(ch).tags} ch={ch} />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Category tabs ── */}
      <div className="shrink-0 border-b border-white/10">
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar px-3 py-2">
          {DISPLAY_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className={cn(
                'shrink-0 px-3 py-1 rounded-full text-[11px] font-chesna-grotesk tracking-[0.1em] uppercase whitespace-nowrap cursor-pointer transition-colors',
                activeCategory === cat.id
                  ? 'bg-white text-black'
                  : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white',
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Channel list (only this section scrolls) ── */}
      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
        {loadingChannels && (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-white/35">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin" aria-hidden="true">
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
                  key={`list-${ch.id}-${ch.streamUrl}`}
                  type="button"
                  onClick={() => setSelectedChannel(ch)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 transition-colors text-left cursor-pointer',
                    isActive
                      ? 'bg-white/10 text-white'
                      : 'text-white/65 hover:bg-white/5 hover:text-white',
                  )}
                >
                  <ChannelLogo ch={ch} size="md" />
                  <div className="min-w-0 flex-1">
                    <ChannelName>{channelDisplay(ch).name}</ChannelName>
                    <ChannelMetaRow tags={channelDisplay(ch).tags} ch={ch} className="mt-1" />
                  </div>
                  {isActive && (
                    <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-red-500" />
                  )}
                </button>
              );
            })}
          </div>
        )}

        {!loadingChannels && !loadError && (
          <div className="px-3 py-3 text-center text-[10px] font-chesna-grotesk tracking-[0.1em] uppercase text-white/20 border-t border-white/5">
            {visibleChannels.length < totalForCategory
              ? `${visibleChannels.length.toLocaleString()} of ${totalForCategory.toLocaleString()} channels`
              : `${visibleChannels.length.toLocaleString()} channels`}
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
    <>
      {/* ── Mobile: player under topbar, list below ── */}
      <div
        className="md:hidden flex flex-col bg-black"
        style={{ height: '100dvh' }}
      >
        <div
          className={cn(
            'relative w-full shrink-0 bg-black h-[48dvh] min-h-[220px]',
            playerFullscreen && '!fixed inset-0 z-[60] h-full max-h-[100dvh] min-h-0',
          )}
        >
          {selectedChannel ? (
            <TvPlayer
              channel={{
                ...selectedChannel,
                name: channelDisplay(selectedChannel).name,
              }}
              className="w-full h-full"
              onFullscreenChange={setPlayerFullscreen}
            />
          ) : (
            <div
              className="w-full h-full bg-[#0a0a0b] flex items-center justify-center"
              style={{ paddingTop: 'calc(4rem + env(safe-area-inset-top))' }}
            >
              {emptyPlayer}
            </div>
          )}
        </div>
        <div
          className={cn(
            'channels-page-chrome flex-1 min-h-0 bg-[#0a0a0b] border-t border-white/10 flex flex-col overflow-visible',
            playerFullscreen && 'hidden',
          )}
        >
          {sidebarContent}
        </div>
      </div>

      {/* ── Desktop: sidebar + player edge-to-edge under topbar ── */}
      <div
        className="hidden md:flex bg-black"
        style={{ height: '100dvh' }}
      >
        <div
          className="channels-page-chrome w-[17rem] xl:w-72 shrink-0 flex flex-col bg-[#0a0a0b] border-r border-white/10"
          style={{ paddingTop: 'calc(4rem + env(safe-area-inset-top))' }}
        >
          <div className="flex-1 min-h-0 overflow-visible flex flex-col">
            {sidebarContent}
          </div>
        </div>

        <div className="flex-1 relative bg-black min-h-0">
          {selectedChannel ? (
            <TvPlayer
              channel={{
                ...selectedChannel,
                name: channelDisplay(selectedChannel).name,
              }}
              className="absolute inset-0 w-full h-full"
              onFullscreenChange={setPlayerFullscreen}
            />
          ) : (
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ paddingTop: 'calc(4rem + env(safe-area-inset-top))' }}
            >
              {emptyPlayer}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── Small components ──────────────────────────────────────────────────

/** Matches category tab typography. */
function ChannelName({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'truncate text-[11px] font-chesna-grotesk tracking-[0.1em] uppercase leading-snug',
        className,
      )}
    >
      {children}
    </div>
  );
}

function ChannelMetaRow({
  ch,
  tags,
  className,
}: {
  ch: Channel;
  tags: string[];
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-1 flex-wrap', className)}>
      {tags.map((tag) => (
        <MetaChip key={tag}>{tag}</MetaChip>
      ))}
      {ch.languages[0] && <MetaChip>{ch.languages[0]}</MetaChip>}
      {ch.country && <MetaChip variant="geo">{ch.country}</MetaChip>}
    </div>
  );
}

function MetaChip({
  children,
  variant = 'default',
}: {
  children: React.ReactNode;
  variant?: 'default' | 'geo';
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center shrink-0 rounded-full text-[9px] font-chesna-grotesk tracking-[0.05em] uppercase px-1.5 py-px leading-none',
        variant === 'geo'
          ? 'bg-white/8 text-white/40'
          : 'bg-white/8 text-white/55',
      )}
    >
      {children}
    </span>
  );
}

function ChannelLogo({ ch, size }: { ch: Channel; size: 'sm' | 'md' }) {
  const cls = size === 'sm' ? 'w-9 h-6' : 'w-10 h-7';
  if (ch.logo) {
    return (
      <img
        src={ch.logo}
        alt=""
        className={cn(cls, 'object-contain rounded shrink-0 bg-white/5')}
      />
    );
  }
  return (
    <div
      className={cn(
        cls,
        'rounded bg-white/5 shrink-0 flex items-center justify-center ring-1 ring-inset ring-white/10',
      )}
    >
      <TvIcon size={size === 'sm' ? 12 : 14} />
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
