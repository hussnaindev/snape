'use client';

import { tmdbImage } from '@/lib/tmdb-image';
import type { TMDBMovie } from '@/types/tmdb';
import Image from 'next/image';
import Link from 'next/link';
interface MovieCardProps {
  movie: TMDBMovie;
  className?: string;
}

export function MovieCard({ movie, className }: MovieCardProps) {
  const poster = tmdbImage(movie.poster_path, 'w500');

  return (
    <div
      className={`group relative block overflow-hidden rounded-2xl sm:rounded-[28px] bg-white/5 ring-1 sm:ring-2 ring-white/25 shadow-[0_8px_24px_rgba(255,255,255,0.08),_0_2px_6px_rgba(255,255,255,0.05)] transition-all duration-300 ease-out hover:-translate-y-1 hover:ring-white/35 hover:shadow-[0_12px_36px_rgba(255,255,255,0.13)] hover:z-10 ${className ?? ''}`}
    >
      <Link href={`/movie/${movie.id}`} prefetch={false} className="block h-full w-full">
        {/* Poster (portrait) */}
        <div className="aspect-[2/3] overflow-hidden relative">
          {poster ? (
            <Image
              src={poster}
              alt={movie.title}
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

          {/* Type chip top-left */}
          <span className="absolute top-1.5 left-2 lg:top-2 lg:left-3 z-10 inline-flex items-center text-[8px] sm:text-[9px] lg:text-[10px] xl:text-[11px] 2xl:text-[12px] font-semibold leading-none tracking-widest uppercase text-white/80 border border-white/40 rounded-full px-2 py-1 lg:px-2.5 lg:py-1.5 bg-black/40 backdrop-blur-sm">
            Film
          </span>

          {/* Rating chip top-right */}
          {movie.vote_average > 0 && (
            <span className="absolute top-1.5 right-2 lg:top-2 lg:right-3 z-10 inline-flex items-center gap-1 rounded-full border border-white/40 px-2 py-1 lg:px-2.5 lg:py-1.5 text-[8px] sm:text-[9px] lg:text-[10px] xl:text-[11px] 2xl:text-[12px] font-semibold leading-none tabular-nums text-white bg-black/40 backdrop-blur-sm">
              ★ {movie.vote_average.toFixed(1)}
            </span>
          )}

          {/* Title at bottom */}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent px-2.5 sm:px-3 lg:px-4 pt-8 lg:pt-10 xl:pt-12 pb-2.5 lg:pb-3 xl:pb-4">
            <p className="text-[11px] sm:text-[13px] lg:text-[14px] xl:text-[15px] 2xl:text-[16px] font-chesna-grotesk uppercase truncate tracking-[0.2em] font-light text-white opacity-90">
              {movie.title}
            </p>
          </div>
        </div>
      </Link>
    </div>
  );
}
