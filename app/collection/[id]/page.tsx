import { AddCollectionToWatchlistButton } from '@/components/add-collection-to-watchlist-button';
import { MovieCard } from '@/components/movie-card';
import { Topbar } from '@/components/topbar';
import { ExpandableText } from '@/components/ui/expandable-text';
import { TagChip } from '@/components/ui/tag-chip';
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

  const startYear = collection.parts[0]?.release_date?.slice(0, 4) ?? '';
  const endYear = collection.parts.length > 1
    ? collection.parts[collection.parts.length - 1]?.release_date?.slice(0, 4) ?? ''
    : '';
  const yearRange = startYear && endYear && endYear !== startYear
    ? `${startYear} – ${endYear}`
    : startYear;

  return (
    <>
      <Topbar />

      <div>
        {/* Backdrop with gradient overlay - matches movie/series layout */}
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
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent pointer-events-none" />

          {/* Back button - desktop only, matches movie/series BackdropPlayer */}
          <Link
            href="/search"
            className="absolute top-20 left-4 md:left-8 text-white/70 hover:text-white text-sm hidden md:flex items-center gap-1 transition-colors z-10"
          >
            ← Back
          </Link>
        </div>

        {/* Content overlapping the backdrop - matches movie/series layout exactly */}
        <div className="px-4 md:px-8 -mt-36 md:-mt-60 relative z-10">
          {/* MAIN ROW */}
          <div className="flex gap-4 md:gap-8 items-stretch">
            {/* POSTER */}
            <div className="flex-none w-24 md:w-40">
              {poster && (
                <div className="relative aspect-[2/3] w-full h-full rounded overflow-hidden shadow-2xl">
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

            {/* DETAILS */}
            <div className="flex-1 min-w-0 flex flex-col justify-between">
              {/* TOP CONTENT */}
              <div className="min-w-0">
                <h1 className="font-body text-xl md:text-4xl font-bold text-white leading-tight line-clamp-2">
                  {collection.name}
                </h1>

                <div className="flex flex-wrap items-center gap-1 md:gap-2 mt-1 text-[10px] md:text-sm text-white/60">
                  {yearRange && <span>{yearRange}</span>}
                  {collection.parts.length > 0 && (
                    <>
                      <span className="text-white/20">·</span>
                      <span>{collection.parts.length} movies</span>
                    </>
                  )}
                </div>

                {collection.parts.length > 0 && (
                  <div className="flex flex-nowrap gap-1 md:gap-2 mt-2 overflow-x-auto no-scrollbar">
                    {Array.from(new Set(collection.parts.flatMap((m) => m.genre_ids || [])))
                      .slice(0, 3)
                      .map((genreId) => (
                        <TagChip key={genreId} label={getGenreName(genreId)} />
                      ))}
                  </div>
                )}
              </div>

              {/* BOTTOM ACTIONS */}
              <div className="pt-2 flex items-center gap-2 shrink-0">
                {collection.parts.length > 0 && collection.parts[0] && (
                  <Link
                    href={`/movie/${collection.parts[0].id}/watch`}
                    className="inline-flex items-center justify-center gap-2 flex-1 bg-white text-black font-semibold text-sm px-5 py-2 md:px-6 md:py-2.5 rounded-lg hover:bg-gray-200 transition-colors md:flex-none"
                  >
                    <span>▶</span> Watch
                  </Link>
                )}

                <AddCollectionToWatchlistButton
                  collection={collection}
                  iconOnly
                  className="md:hidden"
                />
                <AddCollectionToWatchlistButton
                  collection={collection}
                  className="hidden md:inline-flex"
                />
              </div>
            </div>
          </div>

          {/* SYNOPSIS - matches movie/series ExpandableText usage */}
          {collection.overview && (
            <div className="mt-5 md:mt-8 max-w-2xl">
              <ExpandableText text={collection.overview} />
            </div>
          )}
        </div>

        {/* Movies grid */}
        <div className="mt-10 mb-16">
          <div className="px-4 md:px-8">
            <h2 className="text-white font-body font-semibold text-base md:text-lg mb-4">
              Movies in this collection
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {collection.parts.map((movie) => (
                <MovieCard key={movie.id} movie={movie} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
