import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';

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
      <main className="pt-20 pb-16">
        {/* Back */}
        <div className="px-4 md:px-8 mb-6">
          <Link href="/" className="text-white/50 hover:text-white text-sm transition-colors">
            ← Home
          </Link>
        </div>

        {/* Profile hero */}
        <div className="px-4 md:px-8 flex flex-col sm:flex-row gap-6 mb-8">
          {photo && (
            <div className="flex-none w-36 md:w-48 rounded-lg overflow-hidden shadow-2xl">
              <div className="relative aspect-[2/3]">
                <Image
                  src={photo}
                  alt={person.name}
                  fill
                  sizes="(max-width: 768px) 144px, 192px"
                  className="object-cover"
                />
              </div>
            </div>
          )}

          <div className="flex-1 min-w-0">
            <h1 className="font-syne text-4xl md:text-5xl font-bold text-white">
              {person.name}
            </h1>
            {person.known_for_department && (
              <p className="text-gold text-sm mt-1 uppercase tracking-widest">
                {person.known_for_department}
              </p>
            )}
            <div className="mt-3 flex flex-col gap-1 text-sm text-white/50">
              {person.birthday && (
                <span>
                  Born:{' '}
                  {new Date(person.birthday).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </span>
              )}
              {person.place_of_birth && <span>{person.place_of_birth}</span>}
            </div>
            {person.biography && (
              <p className="mt-4 text-white/70 text-sm leading-relaxed max-w-2xl line-clamp-6">
                {person.biography}
              </p>
            )}
          </div>
        </div>

        {/* Known for */}
        {knownFor.length > 0 && (
          <section className="px-4 md:px-8 mb-10">
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
          <section className="px-4 md:px-8">
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
      </main>
    </>
  );
}
