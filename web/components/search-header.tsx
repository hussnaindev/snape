'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
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
  active: SearchTabId;
}

export function SearchHeaderFallback() {
  return (
    <div className="flex flex-col items-center mb-8">
      <div className="inline-flex rounded-lg bg-white/5 border border-white/10 p-1 gap-0.5 h-9 w-56 animate-pulse" />
    </div>
  );
}

export function SearchHeader({ active }: Props) {
  const searchParams = useSearchParams();
  const q = encodeURIComponent(searchParams.get('q')?.trim() ?? '');

  return (
    <div className="flex flex-col items-center mb-8">
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
