'use client';

import { tmdbImage } from '@/lib/tmdb-image';
import Image from 'next/image';
import Link from 'next/link';
export type MediaItem = {
  kind: 'movie' | 'series';
  id: number;
  title: string;
  poster_path: string | null;
  vote_average: number;
  popularity: number;
};

interface ProviderCardProps {
  item: MediaItem;
  rank: number;
}

export function ProviderCard({ item, rank }: ProviderCardProps) {
  const href = item.kind === 'movie' ? `/movie/${item.id}` : `/series/${item.id}`;
  const poster = tmdbImage(item.poster_path, 'w500');
  const isTen = rank === 10;

  return (
    <Link
      href={href}
      prefetch={false}
      className="group relative flex-none w-[130px] sm:w-[175px] overflow-hidden rounded-2xl bg-white/5 transition-all duration-300 ease-out -translate-y-3 ring-1 ring-white/25 shadow-[0_8px_24px_rgba(255,255,255,0.08),_0_2px_6px_rgba(255,255,255,0.05)] hover:scale-[1.04] hover:-translate-y-5 hover:ring-white/35 hover:shadow-[0_12px_36px_rgba(255,255,255,0.13)] hover:z-10"
    >
      <div className="aspect-[2/3] relative overflow-hidden">
        {poster ? (
          <Image
            src={poster}
            alt={item.title}
            fill
            sizes="(max-width: 640px) 130px, 175px"
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-110"
          />
        ) : (
          <div className="absolute inset-0 bg-white/5 flex items-center justify-center text-white/20 text-xs">
            No Image
          </div>
        )}

        {/* Rank number hidden — kept for future use */}

        {/* Play overlay on hover */}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
          <div className="w-12 h-12 rounded-full border border-white/50 bg-black/30 flex items-center justify-center shadow-[0_0_20px_rgba(255,255,255,0.12)]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white" aria-hidden="true">
              <polygon points="6,4 20,12 6,20" />
            </svg>
          </div>
        </div>

        {/* Type chip top-left */}
        <span className="absolute top-1.5 left-2 lg:top-2 lg:left-3 z-10 inline-flex items-center text-[8px] sm:text-[9px] lg:text-[9px] xl:text-[9px] 2xl:text-[9px] font-semibold leading-none tracking-widest uppercase text-white/80 border border-white/40 rounded-full px-2 py-1 lg:px-2 lg:py-1 bg-black/40 backdrop-blur-sm">
          {item.kind === 'movie' ? 'Film' : 'Series'}
        </span>

        {/* Rating chip top-right */}
        {item.vote_average > 0 && (
          <span className="absolute top-1.5 right-2 lg:top-2 lg:right-3 z-10 inline-flex items-center gap-1 rounded-full border border-white/40 px-2 py-1 lg:px-2 lg:py-1 text-[8px] sm:text-[9px] lg:text-[9px] xl:text-[9px] 2xl:text-[9px] font-semibold leading-none tabular-nums text-white bg-black/40 backdrop-blur-sm">
            ★ {item.vote_average.toFixed(1)}
          </span>
        )}

        {/* Title at bottom */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent px-2.5 sm:px-3 lg:px-3 pt-8 lg:pt-8 xl:pt-8 pb-2 lg:pb-2.5 xl:pb-3">
          <p className="text-[11px] sm:text-[12px] lg:text-[12px] xl:text-[12px] 2xl:text-[12px] font-chesna-grotesk uppercase truncate tracking-[0.2em] font-light text-white opacity-90">
              {item.title}
          </p>
        </div>
      </div>
    </Link>
  );
}
