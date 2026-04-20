import { ActorProfileImage } from '@/components/actor-profile-image';
import { tmdbImage } from '@/lib/tmdb-image';
import type { TMDBPersonSearchHit } from '@/types/tmdb';
import Link from 'next/link';

interface SearchActorGridProps {
  people: TMDBPersonSearchHit[];
}

export function SearchActorGrid({ people }: SearchActorGridProps) {
  if (people.length === 0) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 px-4 md:px-8">
      {people.map((person) => {
        const photo = tmdbImage(person.profile_path, 'w185');
        return (
          <Link
            key={person.id}
            href={`/person/${person.id}`}
            prefetch={false}
            className="group block"
          >
            <div className="aspect-[2/3] rounded overflow-hidden bg-white/5 mb-2 relative">
              <ActorProfileImage
                src={photo}
                alt={person.name}
                sizes="(max-width: 640px) 50vw, 16vw"
                className="object-cover group-hover:scale-105 transition-transform duration-200"
                fallbackSize="sm"
              />
            </div>
            <p className="text-white text-xs font-medium leading-tight line-clamp-2">
              {person.name}
            </p>
            {person.known_for_department && (
              <p className="text-white/40 text-xs leading-tight truncate mt-0.5">
                {person.known_for_department}
              </p>
            )}
          </Link>
        );
      })}
    </div>
  );
}
