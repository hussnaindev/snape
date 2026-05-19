import { MovieCard } from '@/components/movie-card';
import { Topbar } from '@/components/topbar';
import { APP_NAME } from '@/lib/config';
import { getCollection } from '@/lib/tmdb';
import { tmdbImage } from '@/lib/tmdb-image';
import { getMovieEmbedUrl } from '@/lib/vsembed';
import type { Metadata } from 'next';

import { CollectionDetailHero } from './collection-detail-hero';

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
  const endYear =
    collection.parts.length > 1
      ? (collection.parts[collection.parts.length - 1]?.release_date?.slice(0, 4) ?? '')
      : '';
  const yearRange =
    startYear && endYear && endYear !== startYear ? `${startYear} – ${endYear}` : startYear;

  const genres = Array.from(new Set(collection.parts.flatMap((m) => m.genre_ids ?? [])))
    .slice(0, 3)
    .map((id) => GENRE_MAP[id] ?? 'Unknown');

  const firstMovie = collection.parts[0] ?? null;
  const embedUrl = firstMovie ? getMovieEmbedUrl(firstMovie.id) : null;

  return (
    <>
      <Topbar />

      <div>
        <CollectionDetailHero
          collection={collection}
          backdropUrl={backdrop}
          poster={poster}
          yearRange={yearRange}
          genres={genres}
          embedUrl={embedUrl}
          firstMovieId={firstMovie?.id ?? null}
          firstMoviePosterPath={firstMovie?.poster_path ?? null}
          firstMovieBackdropPath={firstMovie?.backdrop_path ?? null}
          firstMovieTitle={firstMovie?.title ?? null}
          firstMovieYear={firstMovie?.release_date?.slice(0, 4) ?? ''}
          firstMovieVoteAverage={firstMovie?.vote_average ?? 0}
        />

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
