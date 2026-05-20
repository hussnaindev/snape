'use client';

import { tmdbImage } from '@/lib/tmdb-image';
import Image from 'next/image';
import Link from 'next/link';
import { RatingBadge } from './ui/rating-badge';

export type MediaItem = {
  kind: 'movie' | 'series';
  id: number;
  title: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  popularity: number;
};

interface ProviderCardProps {
  item: MediaItem;
}

export function ProviderCard({ item }: ProviderCardProps) {
  const href = item.kind === 'movie' ? `/movie/${item.id}` : `/series/${item.id}`;
  const backdrop = tmdbImage(item.backdrop_path, 'w780');
  const poster = tmdbImage(item.poster_path, 'w342');

  return (
    <Link
      href={href}
      prefetch={false}
      className="group relative flex-none w-[130px] sm:w-[300px] md:w-[340px] lg:w-[380px] overflow-hidden rounded-2xl sm:rounded-[28px] bg-white/5 transition-all duration-300 ease-out ring-1 sm:ring-2 ring-white/25 shadow-[0_8px_24px_rgba(255,255,255,0.08),_0_2px_6px_rgba(255,255,255,0.05)] hover:-translate-y-1 hover:ring-white/35 hover:shadow-[0_12px_36px_rgba(255,255,255,0.13)] hover:z-10"
    >
      {/* Mobile: portrait card with poster */}
      <div className="sm:hidden aspect-[2/3] relative overflow-hidden">
        {poster ? (
          <Image
            src={poster}
            alt={item.title}
            fill
            sizes="130px"
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-110"
          />
        ) : (
          <div className="absolute inset-0 bg-white/5 flex items-center justify-center text-white/20 text-xs">
            No Image
          </div>
        )}

        {/* Play overlay on hover */}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
          <div className="w-12 h-12 rounded-full border border-white/50 bg-black/30 flex items-center justify-center shadow-[0_0_20px_rgba(255,255,255,0.12)]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white" aria-hidden="true">
              <polygon points="6,4 20,12 6,20" />
            </svg>
          </div>
        </div>

        {/* Bottom gradient — type badge + title + rating */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent px-2.5 pt-8 pb-2.5">
          <span className="text-[8px] sm:text-[9px] font-semibold tracking-widest uppercase text-white/45 block mb-0.5">
            {item.kind === 'movie' ? 'Film' : 'Series'}
          </span>
          <p className="text-white text-[11px] sm:text-[13px] font-medium line-clamp-2 leading-snug">
            {item.title}
          </p>
          {item.vote_average > 0 && (
            <RatingBadge
              rating={item.vote_average}
              className="text-[8px] sm:text-[9px] px-1 py-px mt-1.5"
            />
          )}
        </div>
      </div>

      {/* Desktop: landscape card with backdrop */}
      <div className="hidden sm:block aspect-video relative overflow-hidden">
        {(backdrop ?? poster) ? (
          <Image
            src={(backdrop ?? poster) as string}
            alt={item.title}
            fill
            sizes="(max-width: 1024px) 300px, 380px"
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-110"
          />
        ) : (
          <div className="absolute inset-0 bg-white/5 flex items-center justify-center text-white/20 text-sm">
            No Image
          </div>
        )}

        {/* Play overlay on hover */}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
          <div className="w-12 h-12 rounded-full border border-white/50 bg-black/30 flex items-center justify-center shadow-[0_0_20px_rgba(255,255,255,0.12)]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white" aria-hidden="true">
              <polygon points="6,4 20,12 6,20" />
            </svg>
          </div>
        </div>

        {/* Bottom gradient — title + type badge + rating */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent px-4 pt-8 pb-2.5">
          <p className="text-[16px] tracking-wide leading-tight truncate max-w-[200px] text-white mb-1">
            {item.title}
          </p>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="text-[10px] font-semibold tracking-widest uppercase text-white/50">
              {item.kind === 'movie' ? 'Film' : 'Series'}
            </span>
            {item.vote_average > 0 && (
              <RatingBadge
                rating={item.vote_average}
                className="text-[11px] px-1 py-px flex-none"
              />
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
