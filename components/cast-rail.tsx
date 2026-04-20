import { ActorProfileImage } from '@/components/actor-profile-image';
import { tmdbImage } from '@/lib/tmdb-image';
import type { TMDBCastMember } from '@/types/tmdb';
import Link from 'next/link';
import { SectionDivider } from './ui/section-divider';

interface CastRailProps {
  cast: TMDBCastMember[];
}

export function CastRail({ cast }: CastRailProps) {
  const visible = cast.slice(0, 12);
  if (visible.length === 0) return null;

  return (
    <section className="px-4 md:px-8">
      <SectionDivider label="Starring" className="mb-4" />
      <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
        {visible.map((member) => {
          const photo = tmdbImage(member.profile_path, 'w185');
          return (
            <Link
              key={member.id}
              href={`/person/${member.id}`}
              prefetch={false}
              className="flex-none w-24 group"
            >
              <div className="aspect-[2/3] rounded overflow-hidden bg-white/5 mb-2 relative">
                <ActorProfileImage
                  src={photo}
                  alt={member.name}
                  sizes="96px"
                  className="object-cover group-hover:scale-105 transition-transform duration-200"
                  fallbackSize="sm"
                />
              </div>
              <p className="text-white text-xs font-medium leading-tight truncate">{member.name}</p>
              <p className="text-white/40 text-xs leading-tight truncate mt-0.5">
                {member.character}
              </p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
