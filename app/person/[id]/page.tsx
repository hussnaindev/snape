import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { BackdropPlayer } from '@/app/movie/[id]/backdrop-player';
import { ActorProfileImage } from '@/components/actor-profile-image';
import { ParallaxContent } from '@/components/parallax-content';
import { PersonCard } from '@/components/person-card';
import { Topbar } from '@/components/topbar';
import { ExpandableText } from '@/components/ui/expandable-text';
import { SectionDivider } from '@/components/ui/section-divider';
import {
  getEmbeddableTrailerKey,
  getMovieDetail,
  getMovieVideos,
  getPerson,
  getPersonMovieCredits,
  getPersonSeriesCredits,
  getSeriesDetail,
  getSeriesVideos,
} from '@/lib/tmdb';
import { chunk } from '@/lib/utils';
import { filterHasImages } from '@/lib/tmdb-filters';
import { tmdbImage, tmdbResponsive } from '@/lib/tmdb-image';

const ROW_SIZE = 6;

export const runtime = 'edge';
export const revalidate = 3600;

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const personId = Number(id);
  if (Number.isNaN(personId)) return {};
  try {
    const person = await getPerson(personId);
    return { title: person.name };
  } catch {
    return {};
  }
}

export default async function PersonPage({ params }: Props) {
  const { id } = await params;
  const personId = Number(id);
  if (Number.isNaN(personId)) notFound();

  const [person, movieCredits, seriesCredits] = await Promise.all([
    getPerson(personId).catch(() => null),
    getPersonMovieCredits(personId).catch(() => ({ cast: [], crew: [] })),
    getPersonSeriesCredits(personId).catch(() => ({ cast: [], crew: [] })),
  ]);

  if (!person) notFound();

  const photo = tmdbImage(person.profile_path, 'w342');

  // Combine all credits and find the latest release
  const allMovieCredits = [...movieCredits.cast];
  const allSeriesCredits = [...seriesCredits.cast];

  // Fetch backdrop and trailer for release with a backdrop
  let backdropUrl: string | null = null;
  let trailerKey: string | null = null;
  let releaseWithBackdrop: {
    id: number;
    title: string;
    type: 'movie' | 'series';
    backdropPath: string | null;
    releaseDate: string;
  } | null = null;

  // Try to find a release with a backdrop, working backwards from the latest.
  // We fetch the top N candidates in parallel and pick the first chronological
  // hit — sequential awaits here used to cost 5–15 round-trips of TTFB.
  const movieReleases = allMovieCredits
    .filter((m) => m.release_date)
    .map((m) => ({ ...m, type: 'movie' as const, airDate: m.release_date }));

  const seriesReleases = allSeriesCredits
    .filter((s) => s.first_air_date)
    .map((s) => ({ ...s, type: 'series' as const, airDate: s.first_air_date }));

  const allReleases = [...movieReleases, ...seriesReleases].sort((a, b) =>
    b.airDate > a.airDate ? 1 : -1,
  );

  const candidates = allReleases.slice(0, 6);
  const resolved = await Promise.all(
    candidates.map(async (release) => {
      try {
        if (release.type === 'movie') {
          const [detail, videos] = await Promise.all([
            getMovieDetail(release.id).catch(() => null),
            getMovieVideos(release.id).catch(() => ({ results: [] })),
          ]);
          if (!detail?.backdrop_path) return null;
          return {
            backdropPath: detail.backdrop_path,
            videos,
            info: {
              id: release.id,
              title: release.title,
              type: 'movie' as const,
              backdropPath: detail.backdrop_path,
              releaseDate: release.release_date,
            },
          };
        }
        const [detail, videos] = await Promise.all([
          getSeriesDetail(release.id).catch(() => null),
          getSeriesVideos(release.id).catch(() => ({ results: [] })),
        ]);
        if (!detail?.backdrop_path) return null;
        return {
          backdropPath: detail.backdrop_path,
          videos,
          info: {
            id: release.id,
            title: release.name,
            type: 'series' as const,
            backdropPath: detail.backdrop_path,
            releaseDate: release.first_air_date,
          },
        };
      } catch {
        return null;
      }
    }),
  );

  const winner = resolved.find((r) => r !== null);
  if (winner) {
    backdropUrl = tmdbImage(winner.backdropPath, 'original');
    releaseWithBackdrop = winner.info;
    if (winner.videos.results.length > 0) {
      trailerKey = await getEmbeddableTrailerKey(winner.videos);
    }
  }

  // Known for: top 8 by popularity (same image rule as homepage)
  const knownFor = filterHasImages([...movieCredits.cast])
    .sort((a, b) => b.popularity - a.popularity)
    .slice(0, 8);

  // Full filmography sorted by date desc
  const filmography = filterHasImages([...movieCredits.cast])
    .filter((c) => c.release_date)
    .sort((a, b) => (b.release_date > a.release_date ? 1 : -1));

  return (
    <>
      <Topbar />
      <div>
        {/* Backdrop hero */}
        {backdropUrl && releaseWithBackdrop && (
          <section>
            <ParallaxContent direction="vertical" speed={360} fade={false}>
              <BackdropPlayer
                backdropUrl={backdropUrl}
                trailerKey={trailerKey}
                alt={releaseWithBackdrop.title}
              />
            </ParallaxContent>
          </section>
        )}

        {/* Info block */}
        <div
          className={`px-4 md:px-8 ${backdropUrl ? '-mt-36 md:-mt-60 relative z-10' : 'pt-24 relative z-10'}`}
        >
          <section>
            <ParallaxContent direction="left" speed={120}>
              <div className={`flex gap-4 md:gap-8 ${backdropUrl ? 'h-36 md:h-60' : ''}`}>
                {/* Photo */}
                <div className="flex-none w-24 md:w-40 rounded overflow-hidden shadow-2xl">
                  <div className="relative aspect-[2/3]">
                    <ActorProfileImage
                      src={photo}
                      alt={person.name}
                      sizes="(max-width: 768px) 96px, 160px"
                      className="object-cover"
                      fallbackSize="lg"
                    />
                  </div>
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0 overflow-hidden flex flex-col justify-end">
                  <h1 className="font-body text-xl md:text-4xl font-bold text-white leading-tight line-clamp-2">
                    {person.name}
                  </h1>
                  {person.known_for_department && (
                    <p className="text-gold text-[10px] md:text-xs mt-0.5 uppercase tracking-widest truncate">
                      {person.known_for_department}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-1 md:gap-2 mt-0.5 md:mt-2 text-[10px] md:text-sm text-white/60">
                    {person.birthday && (
                      <span>
                        {new Date(person.birthday).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </span>
                    )}
                    {person.place_of_birth && (
                      <>
                        {person.birthday && <span className="text-white/20">·</span>}
                        <span className="truncate">{person.place_of_birth}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Biography */}
              {person.biography && (
                <div className="mt-5 md:mt-8 max-w-2xl">
                  <ExpandableText text={person.biography} />
                </div>
              )}
            </ParallaxContent>
          </section>
        </div>

        {/* Known for */}
        {knownFor.length > 0 && (
          <section className="px-4 md:px-8 mt-10 mb-10">
            <ParallaxContent direction="right" speed={120}>
              <SectionDivider label="Known For" className="mb-4" />
              <div className="flex gap-3 overflow-x-auto no-scrollbar py-12 px-1">
                {knownFor.map((credit) => (
                  <PersonCard key={`${credit.id}-${credit.character}`} credit={credit} />
                ))}
              </div>
            </ParallaxContent>
          </section>
        )}

        {/* Full filmography */}
        {filmography.length > 0 && (
          <section className="pb-16">
            <div className="px-4 md:px-8">
              <SectionDivider label="Filmography" className="mb-4" />
            </div>
            {chunk(filmography, ROW_SIZE).map((row, i) => (
              <section key={i} className="relative z-0 hover:z-50 px-4 md:px-8">
                <ParallaxContent direction={i % 2 === 0 ? 'left' : 'right'} speed={120}>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3 py-8">
                    {row.map((credit) => {
                      const poster = tmdbResponsive(credit.poster_path, 'w342', 'w500');
                      return (
                        <Link
                          key={`${credit.id}-${credit.character}`}
                          href={`/movie/${credit.id}`}
                          prefetch={false}
                          className="group relative block overflow-hidden rounded-2xl sm:rounded-[28px] bg-white/5 ring-1 sm:ring-2 ring-white/25 shadow-[0_8px_24px_rgba(255,255,255,0.08),_0_2px_6px_rgba(255,255,255,0.05)] transition-transform duration-500 ease-out lg:hover:scale-110 lg:hover:z-40"
                        >
                          <div className="aspect-[2/3] overflow-hidden relative">
                            {poster ? (
                              <picture>
                                <source srcSet={poster.desktop} media="(min-width: 1024px)" />
                                <Image
                                  src={poster.mobile}
                                  alt={credit.title}
                                  fill
                                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 240px"
                                  className="object-cover will-change-transform transition-transform duration-500 lg:group-hover:animate-breath"
                                />
                              </picture>
                            ) : (
                              <div className="absolute inset-0 flex items-center justify-center bg-white/5 text-white/20 text-xs text-center p-2">
                                {credit.title}
                              </div>
                            )}

                            <span className="absolute top-1.5 left-2 lg:top-2 lg:left-3 z-10 inline-flex items-center text-[8px] sm:text-[9px] lg:text-[9px] xl:text-[9px] 2xl:text-[9px] font-semibold leading-none tracking-widest uppercase text-white/80 border border-white/40 rounded-full px-2 py-1 lg:px-2 lg:py-1 bg-black/60">
                              Film
                            </span>

                            {credit.vote_average > 0 && (
                              <span className="absolute top-1.5 right-2 lg:top-2 lg:right-3 z-10 inline-flex items-center gap-1 rounded-full border border-white/40 px-2 py-1 lg:px-2 lg:py-1 text-[8px] sm:text-[9px] lg:text-[9px] xl:text-[9px] 2xl:text-[9px] font-semibold leading-none tabular-nums text-white bg-black/60">
                                ★ {credit.vote_average.toFixed(1)}
                              </span>
                            )}

                            <div className="absolute inset-x-0 bottom-0 flex items-center pointer-events-none z-0">
                              <div className="w-full bg-gradient-to-t from-black/85 to-black/50 py-1.5 sm:py-2 rounded-t-md px-3">
                                <p className="text-[10px] sm:text-[11px] font-chesna-grotesk uppercase truncate tracking-[0.2em] font-light text-white/90 text-center">
                                  {credit.title}
                                </p>
                              </div>
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </ParallaxContent>
              </section>
            ))}
          </section>
        )}
      </div>
    </>
  );
}
