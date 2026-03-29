import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ExpandableText } from '@/components/ui/expandable-text';
import { PersonCard } from '@/components/person-card';
import { Topbar } from '@/components/topbar';
import { SectionDivider } from '@/components/ui/section-divider';
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
        {/* Backdrop hero */}
        <div className="relative h-[calc(45vh+4rem)] md:h-[calc(55vh+9rem)] min-h-[200px] md:min-h-[320px] overflow-hidden">
          {photo ? (
            <Image
              src={photo}
              alt={person.name}
              fill
              priority
              sizes="100vw"
              className="object-cover object-top scale-110 blur-3xl"
            />
          ) : (
            <div className="absolute inset-0 bg-white/5" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-black/50" />

          {/* Back button — desktop only */}
          <Link
            href="/"
            className="absolute top-20 left-4 md:left-8 text-white/70 hover:text-white text-sm hidden md:flex items-center gap-1 transition-colors"
          >
            ← Back
          </Link>
        </div>

        {/* Info block */}
        <div className="px-4 md:px-8 -mt-36 md:-mt-60 relative z-10">
          <div className="flex gap-4 md:gap-8 h-36 md:h-60">
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
            <div className="flex flex-col divide-y divide-white/5">
              {filmography.map((credit) => (
                <Link
                  key={`${credit.id}-${credit.character}`}
                  href={`/movie/${credit.id}`}
                  className="flex items-center gap-4 py-3 hover:bg-white/5 -mx-2 px-2 rounded transition-colors"
                >
                  {credit.poster_path ? (
                    <div className="relative flex-none w-10 h-15 rounded overflow-hidden bg-white/5">
                      <Image
                        src={tmdbImage(credit.poster_path, 'w92')}
                        alt={credit.title}
                        fill
                        sizes="40px"
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <div className="flex-none w-10 h-15 rounded bg-white/5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{credit.title}</p>
                    {credit.character && (
                      <p className="text-white/40 text-xs truncate">{credit.character}</p>
                    )}
                  </div>
                  <span className="flex-none text-white/30 text-xs">
                    {credit.release_date?.slice(0, 4)}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
