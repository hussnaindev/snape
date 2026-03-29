import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ExpandableText } from '@/components/ui/expandable-text';
import { PersonCard } from '@/components/person-card';
import { Topbar } from '@/components/topbar';
import { SectionDivider } from '@/components/ui/section-divider';
import { RatingBadge } from '@/components/ui/rating-badge';
import { getPerson, getPersonMovieCredits } from '@/lib/tmdb';
import { tmdbImage } from '@/lib/tmdb-image';

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

  const [person, credits] = await Promise.all([
    getPerson(personId).catch(() => null),
    getPersonMovieCredits(personId).catch(() => ({ cast: [], crew: [] })),
  ]);

  if (!person) notFound();

  const photo = tmdbImage(person.profile_path, 'w342');

  // Known for: top 8 by popularity with a poster
  const knownFor = [...credits.cast]
    .filter((c) => c.poster_path)
    .sort((a, b) => b.popularity - a.popularity)
    .slice(0, 8);

  // Full filmography sorted by date desc
  const filmography = [...credits.cast]
    .filter((c) => c.release_date)
    .sort((a, b) => (b.release_date > a.release_date ? 1 : -1));

  return (
    <>
      <Topbar />
      <div>
        {/* Info block */}
        <div className="px-4 md:px-8 pt-24 relative z-10">
          <div className="flex gap-4 md:gap-8">
            {/* Photo */}
            <div className="flex-none w-24 md:w-40 rounded overflow-hidden shadow-2xl">
              {photo && (
                <div className="relative aspect-[2/3]">
                  <Image
                    src={photo}
                    alt={person.name}
                    fill
                    sizes="(max-width: 768px) 96px, 160px"
                    className="object-cover"
                  />
                </div>
              )}
            </div>

            {/* Details */}
            <div className="flex-1 min-w-0 overflow-hidden flex flex-col">
              <h1 className="font-syne text-xl md:text-4xl font-bold text-white leading-tight line-clamp-2">
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
        </div>

        {/* Known for */}
        {knownFor.length > 0 && (
          <section className="px-4 md:px-8 mt-10 mb-10">
            <SectionDivider label="Known For" className="mb-4" />
            <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
              {knownFor.map((credit) => (
                <PersonCard key={`${credit.id}-${credit.character}`} credit={credit} />
              ))}
            </div>
          </section>
        )}

        {/* Full filmography */}
        {filmography.length > 0 && (
          <section className="px-4 md:px-8 pb-16">
            <SectionDivider label="Filmography" className="mb-4" />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {filmography.map((credit) => {
                const img =
                  tmdbImage(credit.backdrop_path, 'w780') ??
                  tmdbImage(credit.poster_path, 'w780');
                const year = credit.release_date?.slice(0, 4);
                return (
                  <Link
                    key={`${credit.id}-${credit.character}`}
                    href={`/movie/${credit.id}`}
                    className="group relative block overflow-hidden rounded-md bg-white/5 transition-all duration-300 ease-out sm:hover:scale-105 sm:hover:shadow-[0_8px_30px_rgba(0,0,0,0.6)] sm:hover:brightness-110 sm:hover:z-10"
                  >
                    <div className="aspect-video overflow-hidden relative">
                      {img ? (
                        <Image
                          src={img}
                          alt={credit.title}
                          fill
                          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                          className="object-cover transition-transform duration-500 ease-out group-hover:scale-110"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center bg-white/5 text-white/20 text-xs text-center p-2">
                          {credit.title}
                        </div>
                      )}
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent flex flex-col justify-end px-2 py-1.5 sm:px-3 sm:py-2.5">
                      <p className="text-white text-xs sm:text-sm font-medium leading-tight line-clamp-1 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
                        {credit.title}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {year && <span className="text-white/50 text-[10px] sm:text-xs drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">{year}</span>}
                        {credit.vote_average > 0 && <RatingBadge rating={credit.vote_average} className="text-[9px] px-1 py-0 sm:text-[11px] sm:px-1.5" />}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
