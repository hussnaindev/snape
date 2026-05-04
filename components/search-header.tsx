'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { SEARCH_TAB_IDS, type SearchTabId } from './search-tab-chips';

const TABS: { id: SearchTabId; label: string }[] = SEARCH_TAB_IDS.map((id) => {
  const labels: Record<SearchTabId, string> = {
    movies: 'Movies',
    series: 'Series',
    actors: 'Actors',
    collections: 'Collections',
  };
  return { id, label: labels[id] };
});

interface Props {
  query: string;
  active: SearchTabId;
  totalResults?: number;
}

export function SearchHeader({ query, active, totalResults }: Props) {
  const q = encodeURIComponent(query);

  return (
    <div className="flex flex-col items-center gap-4 mb-8">
      {/* Query chip + results count — inline */}
      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/40">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <span className="text-white text-sm font-medium">{query}</span>
        {totalResults !== undefined && totalResults > 0 && (
          <div className="flex items-center gap-1 ml-2 pl-2 border-l border-white/10">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-white/30">
              <line x1="4" y1="9" x2="20" y2="9" />
              <line x1="4" y1="15" x2="20" y2="15" />
              <line x1="10" y1="3" x2="8" y2="21" />
              <line x1="16" y1="3" x2="14" y2="21" />
            </svg>
            <span className="text-white/50 text-xs tabular-nums">{totalResults.toLocaleString()}</span>
          </div>
        )}
      </div>

      {/* Merged toggle tabs */}
      <div className="inline-flex rounded-lg bg-white/5 border border-white/10 p-1 gap-0.5" role="tablist">
        {TABS.map(({ id, label }) => {
          const selected = active === id;
          return (
              <Link
                key={id}
                href={`/search?q=${q}&tab=${id}`}
                prefetch={false}
                role="tab"
                aria-selected={selected}
                className={cn(
                  'rounded-md px-4 py-1.5 text-xs font-medium transition-all duration-200 cursor-pointer',
                  selected
                    ? 'bg-white text-black shadow-[0_2px_8px_rgba(0,0,0,0.3)]'
                    : 'text-white/50 hover:text-white/80',
                )}
              >
              {label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
