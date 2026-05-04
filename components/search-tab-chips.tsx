import { cn } from '@/lib/utils';
import Link from 'next/link';

export const SEARCH_TAB_IDS = ['movies', 'series', 'actors', 'collections'] as const;
export type SearchTabId = (typeof SEARCH_TAB_IDS)[number];

export function parseSearchTab(raw: string | undefined): SearchTabId {
  if (raw === 'series' || raw === 'actors' || raw === 'collections') return raw;
  return 'movies';
}

const LABELS: Record<SearchTabId, string> = {
  movies: 'Movies',
  series: 'Series',
  actors: 'Actors',
  collections: 'Collections',
};

interface SearchTabChipsProps {
  query: string;
  active: SearchTabId;
}

export function SearchTabChips({ query, active }: SearchTabChipsProps) {
  const q = encodeURIComponent(query);

  return (
    <div className="flex flex-wrap gap-2 mb-8" role="tablist" aria-label="Search category">
      {SEARCH_TAB_IDS.map((id) => {
        const selected = active === id;
        return (
          <Link
            key={id}
            href={`/search?q=${q}&tab=${id}`}
            prefetch={false}
            role="tab"
            aria-selected={selected}
            className={cn(
              'rounded-full px-4 py-1.5 text-sm font-medium transition-colors border',
              selected
                ? 'bg-white text-black border-white'
                : 'bg-white/5 text-white/80 border-white/15 hover:border-white/40 hover:text-white',
            )}
          >
            {LABELS[id]}
          </Link>
        );
      })}
    </div>
  );
}
