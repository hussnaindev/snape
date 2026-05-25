'use client';

import { tmdbImage } from '@/lib/tmdb-image';
import Link from 'next/link';
import type { TMDBMovie, TMDBSeries, TMDBPersonSearchHit } from '@/types/tmdb';

interface SearchDropdownProps {
  movies: TMDBMovie[];
  series: TMDBSeries[];
  people: TMDBPersonSearchHit[];
  query: string;
  loading: boolean;
  error: boolean;
  selectedIndex: number;
  onClose: () => void;
}

export function SearchDropdown({
  movies,
  series,
  people,
  query,
  loading,
  error,
  selectedIndex,
  onClose,
}: SearchDropdownProps) {
  const hasResults = movies.length > 0 || series.length > 0 || people.length > 0;
  const showViewAll = !loading && !error;

  let idx = -1;

  return (
    <div className="absolute top-full left-0 right-0 mt-2 bg-black/80 border border-white/10 rounded-xl shadow-2xl overflow-hidden z-[70] animate-fade-in">
      {loading && (
        <div className="flex items-center justify-center gap-2 px-4 py-5 text-white/40 text-sm">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
          Searching…
        </div>
      )}

      {!loading && error && (
        <div className="px-4 py-5 text-white/40 text-sm text-center">Search failed. Try again.</div>
      )}

      {!loading && !error && !hasResults && (
        <div className="px-4 py-5 text-white/40 text-sm text-center">No results found</div>
      )}

      {!loading && !error && hasResults && (
        <div className="max-h-80 overflow-y-auto no-scrollbar py-1">
          {movies.length > 0 && (
            <div>
              <div className="px-4 py-1.5 text-[11px] font-chesna-grotesk tracking-[0.2em] uppercase text-white/40">
                Movies
              </div>
              {movies.map((movie) => {
                idx++;
                return (
                  <SuggestionItem
                    key={`movie-${movie.id}`}
                    href={`/movie/${movie.id}`}
                    image={tmdbImage(movie.poster_path, 'w92')}
                    title={movie.title}
                    subtitle={movie.release_date?.slice(0, 4)}
                    selected={selectedIndex === idx}
                    onClose={onClose}
                  />
                );
              })}
            </div>
          )}

          {series.length > 0 && (
            <div>
              <div className="px-4 py-1.5 text-[11px] font-chesna-grotesk tracking-[0.2em] uppercase text-white/40">
                TV Shows
              </div>
              {series.map((show) => {
                idx++;
                return (
                  <SuggestionItem
                    key={`series-${show.id}`}
                    href={`/series/${show.id}`}
                    image={tmdbImage(show.poster_path, 'w92')}
                    title={show.name}
                    subtitle={show.first_air_date?.slice(0, 4)}
                    selected={selectedIndex === idx}
                    onClose={onClose}
                  />
                );
              })}
            </div>
          )}

          {people.length > 0 && (
            <div>
              <div className="px-4 py-1.5 text-[11px] font-chesna-grotesk tracking-[0.2em] uppercase text-white/40">
                People
              </div>
              {people.map((person) => {
                idx++;
                return (
                  <SuggestionItem
                    key={`person-${person.id}`}
                    href={`/person/${person.id}`}
                    image={tmdbImage(person.profile_path, 'w92')}
                    title={person.name}
                    subtitle={person.known_for_department}
                    selected={selectedIndex === idx}
                    onClose={onClose}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      {showViewAll && (
        <Link
          href={`/search?q=${encodeURIComponent(query)}&tab=movies`}
          onClick={onClose}
          className="flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm text-white/60 hover:text-white hover:bg-white/5 border-t border-white/10 transition-colors"
        >
          View all results
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </Link>
      )}
    </div>
  );
}

function SuggestionItem({
  href,
  image,
  title,
  subtitle,
  selected,
  onClose,
}: {
  href: string;
  image: string;
  title: string;
  subtitle?: string;
  selected: boolean;
  onClose: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClose}
      className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
        selected
          ? 'bg-white/10 text-white'
          : 'text-white/70 hover:text-white hover:bg-white/5'
      }`}
    >
      {image ? (
        <img
          src={image}
          alt=""
          className="w-8 h-12 rounded object-cover shrink-0 bg-white/5"
        />
      ) : (
        <div className="w-8 h-12 rounded bg-white/5 shrink-0 flex items-center justify-center ring-1 ring-inset ring-white/10">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/20">
            <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
            <line x1="7" y1="2" x2="7" y2="22" />
            <line x1="17" y1="2" x2="17" y2="22" />
            <line x1="2" y1="12" x2="22" y2="12" />
            <line x1="2" y1="7" x2="7" y2="7" />
            <line x1="2" y1="17" x2="7" y2="17" />
            <line x1="17" y1="7" x2="22" y2="7" />
            <line x1="17" y1="17" x2="22" y2="17" />
          </svg>
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate">{title}</div>
        {subtitle && <div className="text-xs text-white/40 truncate">{subtitle}</div>}
      </div>
    </Link>
  );
}
