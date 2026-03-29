import { tmdbImage } from '@/lib/tmdb-image';
import type { TMDBMovie } from '@/types/tmdb';
import Image from 'next/image';
import Link from 'next/link';
import { RatingBadge } from './ui/rating-badge';

interface MovieCardProps {
  movie: TMDBMovie;
  qualityBadge?: '4K' | 'HD' | null;
  imageSize?: string;
  className?: string;
}

export function MovieCard({ movie, qualityBadge, imageSize = 'w780', className }: MovieCardProps) {
  const backdrop = tmdbImage(movie.backdrop_path, imageSize);
  const poster = tmdbImage(movie.poster_path, 'w342');
  const year = movie.release_date?.slice(0, 4) ?? '';

  return (
    <Link
      href={`/movie/${movie.id}`}
      className={`group relative block overflow-hidden rounded-md bg-white/5 transition-all duration-300 ease-out sm:hover:scale-105 sm:hover:shadow-[0_8px_30px_rgba(0,0,0,0.6)] sm:hover:brightness-110 sm:hover:z-10 ${className ?? ''}`}
    >
      {/* Mobile: Poster (portrait) */}
      <div className="aspect-[2/3] overflow-hidden sm:hidden">
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
      </div>

      {/* Desktop: Backdrop (landscape) */}
      <div className="hidden sm:block aspect-video overflow-hidden">
        {backdrop ? (
          <Image
            src={backdrop}
            alt={movie.title}
            fill
            sizes="(max-width: 1024px) 33vw, 25vw"
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-110"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-white/5 text-white/20 text-sm">
            No Image
          </div>
        )}
      </div>

      {/* Quality badge */}
      {qualityBadge && (
        <span className="absolute top-2 left-2 bg-black/70 border border-white/30 text-white/80 text-[10px] font-bold px-1.5 py-0.5 rounded">
          {qualityBadge}
        </span>
      )}

      {/* Always-visible title strip */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent flex flex-col justify-end px-2 py-1.5 sm:px-3 sm:py-2.5">
        <p className="text-white text-xs sm:text-sm font-medium leading-tight line-clamp-2 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
          {movie.title}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5">
          {year && <span className="text-white/50 text-[10px] sm:text-xs drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">{year}</span>}
          {movie.vote_average > 0 && <RatingBadge rating={movie.vote_average} className="text-[9px] px-1 py-0 sm:text-[11px] sm:px-1.5" />}
        </div>
      </div>
    </Link>
  );
}
