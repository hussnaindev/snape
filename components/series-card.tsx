'use client';

import { tmdbImage } from '@/lib/tmdb-image';
import { TITLE_STYLE } from '@/lib/title-styles';
import type { TMDBSeries } from '@/types/tmdb';
import Image from 'next/image';
import Link from 'next/link';
import { RatingBadge } from './ui/rating-badge';

interface SeriesCardProps {
  series: TMDBSeries;
  className?: string;
}

export function SeriesCard({ series, className }: SeriesCardProps) {
  const poster = tmdbImage(series.poster_path, 'w500');

  return (
    <div
      className={`group relative block overflow-hidden rounded-2xl sm:rounded-[28px] bg-white/5 ring-1 sm:ring-2 ring-white/25 shadow-[0_8px_24px_rgba(255,255,255,0.08),_0_2px_6px_rgba(255,255,255,0.05)] transition-all duration-300 ease-out hover:-translate-y-1 hover:ring-white/35 hover:shadow-[0_12px_36px_rgba(255,255,255,0.13)] hover:z-10 ${className ?? ''}`}
    >
      <Link href={`/series/${series.id}`} prefetch={false} className="block h-full w-full">
        {/* Poster (portrait) */}
        <div className="aspect-[2/3] overflow-hidden relative">
          {poster ? (
            <Image
              src={poster}
              alt={series.name}
              fill
              sizes="50vw"
              className="object-cover transition-transform duration-500 ease-out group-hover:scale-110"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-white/5 text-white/20 text-sm">
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

          {/* title + type badge + rating */}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent px-2.5 sm:px-3 pt-8 pb-2.5">
            <span className="text-[8px] sm:text-[9px] font-semibold tracking-widest uppercase text-white/45 block mb-0.5">
              Series
            </span>
            <p className={'text-[11px] sm:text-[13px] font-chesna-grotesk uppercase line-clamp-2 leading-snug ' + TITLE_STYLE}>
              {series.name}
            </p>
            {series.vote_average > 0 && (
              <RatingBadge rating={series.vote_average} className="text-[8px] sm:text-[9px] px-1 py-px mt-1.5" />
            )}
          </div>
        </div>
      </Link>
    </div>
  );
}
