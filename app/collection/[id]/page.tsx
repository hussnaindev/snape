import { AddCollectionToWatchlistButton } from '@/components/add-collection-to-watchlist-button';
import { MovieCard } from '@/components/movie-card';
import { TagChip } from '@/components/ui/tag-chip';
import { Topbar } from '@/components/topbar';
import { APP_NAME } from '@/lib/config';
import { getCollection } from '@/lib/tmdb';
import { tmdbImage } from '@/lib/tmdb-image';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

const GENRE_MAP: Record<number, string> = {
  28: 'Action',
  12: 'Adventure',
  16: 'Animation',
  35: 'Comedy',
  80: 'Crime',
  99: 'Documentary',
  18: 'Drama',
  10751: 'Family',
  14: 'Fantasy',
  36: 'History',
  27: 'Horror',
  10402: 'Music',
  9648: 'Mystery',
  10749: 'Romance',
  878: 'Sci-Fi',
  53: 'Thriller',
  10752: 'War',
  37: 'Western',
};

function getGenreName(genreId: number): string {
  return GENRE_MAP[genreId] || 'Unknown';
}

interface Props {
  params: Promise<{ id: string }>;
}

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  try {
    const collection = await getCollection(Number(id));
    return {
      title: `${collection.name} — ${APP_NAME}`,
      description: collection.overview || `Movies in the ${collection.name} collection`,
    };
  } catch {
    return { title: `Collection — ${APP_NAME}` };
  }
}

export default async function CollectionPage({ params }: Props) {
  const { id } = await params;

  let collection: Awaited<ReturnType<typeof getCollection>> | null = null;
  try {
    collection = await getCollection(Number(id));
  } catch {
    return (
      <>
        <Topbar />
        <main className="pt-24 pb-16 px-4 md:px-8 text-center">
          <p className="text-white/50">Collection not found.</p>
        </main>
      </>
    );
  }

  const backdrop = tmdbImage(collection.backdrop_path, 'original');
  const poster = tmdbImage(collection.poster_path, 'w342');

  return (
    <>
      <Topbar />

      <div>
        {/* Hero backdrop - matches movie/series detail page height */}
        <div className="relative h-[calc(45vh+4rem)] md:h-[calc(55vh+9rem)] min-h-[200px] md:min-h-[320px] overflow-hidden">
          {backdrop ? (
            <Image
              src={backdrop}
              alt={collection.name}
              fill
              priority
              sizes="100vw"
              className="object-cover object-top"
            />
          ) : (
            <div className="absolute inset-0 bg-white/5" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-[#141414]/60 to-transparent pointer-events-none" />

          {/* Back button - desktop */}
          <Link
            href="/search"
            className="absolute top-20 left-4 md:left-8 text-white/70 hover:text-white text-sm hidden md:flex items-center gap-1 transition-colors z-10"
          >
            ← Back
          </Link>
        </div>

        {/* Content overlapping the backdrop */}
        <div className="px-4 md:px-8 -mt-36 md:-mt-60 relative z-10">
          <div className="flex gap-4 md:gap-8 items-end">
            {/* Poster */}
            <div className="flex-none w-24 md:w-40">
              {poster && (
                <div className="relative aspect-[2/3] w-full rounded overflow-hidden shadow-2xl">
                  <Image
                    src={poster}
                    alt={collection.name}
                    fill
                    sizes="(max-width: 768px) 96px, 160px"
                    className="object-cover"
                  />
                </div>
              )}
            </div>

            {/* Details */}
            <div className="flex-1 min-w-0 flex flex-col justify-between">
              {/* TOP CONTENT */}
              <div className="min-w-0">
                <h1 className="font-body text-xl md:text-4xl font-bold text-white leading-tight line-clamp-2">
                  {collection.name}
                </h1>

                {collection.overview && (
                  <p className="hidden md:block mt-1 text-sm text-white/70 line-clamp-3 max-w-2xl">
                    {collection.overview}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <TagChip label={`${collection.parts.length} movies`} />
                  {collection.parts.length > 0 && (
                    <>
                      <span className="text-white/20">·</span>
                      <span className="text-xs text-white/50">
                        {collection.parts[0]?.release_date?.slice(0, 4)}
                        {collection.parts.length > 1 &&
                          ` - ${collection.parts[collection.parts.length - 1]?.release_date?.slice(0, 4)}`}
                      </span>
                    </>
                  )}
                </div>

                {/* Genre tags from collection movies */}
                {collection.parts.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-3">
                    {Array.from(new Set(collection.parts.flatMap((m) => m.genre_ids || [])))
                      .slice(0, 5)
                      .map((genreId) => (
                        <TagChip key={genreId} label={getGenreName(genreId)} />
                      ))}
                  </div>
                )}
              </div>

              {/* BOTTOM ACTIONS */}
              <div className="pt-2 pb-4 flex items-center gap-3 shrink-0">
                {collection.parts.length > 0 && collection.parts[0] && (
                  <Link
                    href={`/movie/${collection.parts[0].id}`}
                    className="inline-flex items-center gap-2 bg-white text-black font-semibold text-sm px-5 py-2 md:px-6 md:py-2.5 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    <span>▶</span> Watch
                  </Link>
                )}
                <AddCollectionToWatchlistButton collection={collection} className="md:inline-flex" />
              </div>
            </div>
          </div>

          {/* Mobile overview */}
          {collection.overview && (
            <p className="md:hidden mt-4 text-sm text-white/70">{collection.overview}</p>
          )}
        </div>

        {/* Movies grid - add padding top for content separation from banner */}
        <div className="mt-16 md:mt-20 mb-16 px-4 md:px-8">
          <h2 className="text-lg font-semibold text-white mb-6">Movies in this collection</h2>
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {collection.parts.map((movie) => (
              <MovieCard key={movie.id} movie={movie} />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
