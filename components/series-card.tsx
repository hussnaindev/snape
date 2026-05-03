'use client';

import { tmdbImage } from '@/lib/tmdb-image';
import type { TMDBSeries } from '@/types/tmdb';
import Image from 'next/image';
import Link from 'next/link';
import { RatingBadge } from './ui/rating-badge';

interface SeriesCardProps {
  series: TMDBSeries;
  imageSize?: string;
  className?: string;
}

export function SeriesCard({ series, imageSize = 'w780', className }: SeriesCardProps) {
  const backdrop = tmdbImage(series.backdrop_path, imageSize);
  const poster = tmdbImage(series.poster_path, 'w342');
  const year = series.first_air_date?.slice(0, 4) ?? '';

  return (
    <div
      className={`group relative block overflow-hidden rounded-md bg-white/5 transition-all duration-300 ease-out sm:hover:scale-105 sm:hover:shadow-[0_8px_30px_rgba(0,0,0,0.6)] sm:hover:brightness-110 sm:hover:z-10 ${className ?? ''}`}
    >
      <Link href={`/series/${series.id}`} prefetch={false} className="block h-full w-full">
        {/* Mobile: Poster (portrait) */}
        <div className="aspect-[2/3] overflow-hidden sm:hidden relative">
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

          {/* Mobile: rating top-right with gradient */}
          {series.vote_average > 0 && (
            <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/70 to-transparent p-1.5">
              <div className="flex justify-end">
                <RatingBadge rating={series.vote_average} className="text-[9px] px-1 py-0" />
              </div>
            </div>
          )}

          {/* Mobile: title + play icon at bottom */}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2">
            <div className="flex items-center gap-1.5">
              <div className="flex items-center justify-center w-5 h-5 flex-none overflow-hidden rounded-full bg-white/15 border border-white/25 opacity-100 group-hover:w-0 group-hover:h-0 group-hover:opacity-0 group-hover:border-0 transition-all duration-300">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="white" aria-hidden="true" className="flex-none">
                  <polygon points="6,4 20,12 6,20" />
                </svg>
              </div>
              <p className="text-white text-[11px] font-medium leading-tight line-clamp-1 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
                {series.name}
              </p>
            </div>
          </div>
        </div>

        {/* Desktop: Backdrop (landscape) */}
        <div className="hidden sm:block aspect-video overflow-hidden relative">
          {backdrop ? (
            <Image
              src={backdrop}
              alt={series.name}
              fill
              sizes="(max-width: 1024px) 33vw, 25vw"
              className="object-cover transition-transform duration-500 ease-out group-hover:scale-110"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-white/5 text-white/20 text-sm">
              No Image
            </div>
          )}

          {/* Play button overlay (desktop only) */}
          <div className="hidden sm:flex absolute inset-0 items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
            <div className="relative w-14 h-14 rounded-full overflow-hidden bg-black/30 border-[1.5px] border-white/40 shadow-[0_0_12px_rgba(255,255,255,0.15)] group-hover:bg-black/40 group-hover:shadow-[0_0_14px_rgba(255,255,255,0.2)] transition-all duration-300 flex items-center justify-center">
              {/* Shine sweep */}
              <div
                className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out"
                style={{ background: 'linear-gradient(105deg, transparent 38%, rgba(255,255,255,0.1) 45%, rgba(255,255,255,0.15) 50%, rgba(255,255,255,0.1) 55%, transparent 62%)' }}
              />
              <svg width="26" height="26" viewBox="0 0 24 24" fill="white" aria-hidden="true">
                <polygon points="6,4 20,12 6,20" />
              </svg>
            </div>
          </div>

          {/* Desktop: metadata overlay — top edge */}
          <div className="hidden sm:block absolute top-0 left-0 right-0 bg-gradient-to-b from-black/70 to-transparent p-2.5">
            <div className="flex justify-end">
              {series.vote_average > 0 && (
                <RatingBadge
                  rating={series.vote_average}
                  className="text-[11px] px-1.5"
                />
              )}
            </div>
          </div>

          {/* Desktop: title + play icon at bottom */}
          <div className="hidden sm:block absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2.5">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-5 h-5 flex-none overflow-hidden rounded-full bg-white/15 border border-white/25 opacity-100 group-hover:w-0 group-hover:h-0 group-hover:opacity-0 group-hover:border-0 transition-all duration-300">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="white" aria-hidden="true" className="flex-none">
                  <polygon points="6,4 20,12 6,20" />
                </svg>
              </div>
              <p className="text-white text-sm font-medium leading-tight line-clamp-1 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
                {series.name}
              </p>
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
}
