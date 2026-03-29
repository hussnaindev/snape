import { tmdbImage } from '@/lib/tmdb-image';
import type { TMDBPersonMovieCredit } from '@/types/tmdb';
import Image from 'next/image';
import Link from 'next/link';

interface PersonCardProps {
  credit: TMDBPersonMovieCredit;
}

export function PersonCard({ credit }: PersonCardProps) {
  const poster = tmdbImage(credit.poster_path, 'w185');
  const backdrop = tmdbImage(credit.backdrop_path, 'w780') ?? poster;
  const year = credit.release_date?.slice(0, 4) ?? '';

  return (
    <Link href={`/movie/${credit.id}`} className="flex-none w-28 sm:w-64 group">
      {/* Mobile: portrait */}
      <div className="sm:hidden aspect-[2/3] rounded overflow-hidden bg-white/5 mb-2 relative">
        {poster ? (
          <Image
            src={poster}
            alt={credit.title}
            fill
            sizes="112px"
            className="object-cover group-hover:scale-105 transition-transform duration-200"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/20 text-xs text-center p-2">
            {credit.title}
          </div>
        )}
      </div>

      {/* Desktop: landscape */}
      <div className="hidden sm:block aspect-video rounded overflow-hidden bg-white/5 mb-2 relative">
        {backdrop ? (
          <Image
            src={backdrop}
            alt={credit.title}
            fill
            sizes="256px"
            className="object-cover group-hover:scale-105 transition-transform duration-200"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/20 text-xs text-center p-2">
            {credit.title}
          </div>
        )}
      </div>

      <p className="text-white text-xs font-medium leading-tight truncate">{credit.title}</p>
      {year && <p className="text-white/40 text-xs mt-0.5">{year}</p>}
    </Link>
  );
}
