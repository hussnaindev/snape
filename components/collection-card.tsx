import { tmdbImage } from '@/lib/tmdb-image';
import type { TMDBCollectionSearchHit } from '@/types/tmdb';
import Image from 'next/image';
import Link from 'next/link';

interface CollectionCardProps {
  collection: TMDBCollectionSearchHit;
  className?: string;
}

export function CollectionCard({ collection, className }: CollectionCardProps) {
  const backdrop = tmdbImage(collection.backdrop_path, 'w780');
  const poster = tmdbImage(collection.poster_path, 'w342');

  return (
    <Link
      href={`/collection/${collection.id}`}
      prefetch={false}
      className={`group relative block overflow-hidden rounded-md bg-white/5 transition-all duration-300 ease-out sm:hover:scale-105 sm:hover:shadow-[0_8px_30px_rgba(0,0,0,0.6)] sm:hover:brightness-110 sm:hover:z-10 ${className ?? ''}`}
    >
      {/* Mobile: Poster (portrait) */}
      <div className="aspect-[2/3] overflow-hidden sm:hidden relative">
        {poster ? (
          <Image
            src={poster}
            alt={collection.name}
            fill
            sizes="50vw"
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-110"
          />
        ) : backdrop ? (
          <Image
            src={backdrop}
            alt={collection.name}
            fill
            sizes="50vw"
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-110"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-white/5 text-white/20 text-sm">
            No Image
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2">
          <p className="text-white text-[11px] font-medium leading-tight line-clamp-2 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
            {collection.name}
          </p>
        </div>
      </div>

      {/* Desktop: Backdrop (landscape) */}
      <div className="hidden sm:block aspect-video overflow-hidden relative">
        {backdrop ? (
          <Image
            src={backdrop}
            alt={collection.name}
            fill
            sizes="(max-width: 1024px) 33vw, 25vw"
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-110"
          />
        ) : poster ? (
          <Image
            src={poster}
            alt={collection.name}
            fill
            sizes="(max-width: 1024px) 33vw, 25vw"
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-110"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-white/5 text-white/20 text-sm">
            No Image
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2.5">
          <p className="text-white text-sm font-medium leading-tight line-clamp-1 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
            {collection.name}
          </p>
        </div>
      </div>
    </Link>
  );
}
