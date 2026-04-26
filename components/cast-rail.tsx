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
          const photo = tmdbImage(member.profile_path, 'w342');
          return (
            <Link
              key={member.id}
              href={`/person/${member.id}`}
              prefetch={false}
              className="flex-none w-28 md:w-32 group"
            >
              <div className="aspect-[2/3] rounded overflow-hidden bg-white/5 mb-2 relative">
                <ActorProfileImage
                  src={photo}
                  alt={member.name}
                  sizes="(max-width: 768px) 112px, 128px"
                  className="object-cover group-hover:scale-105 transition-transform duration-200"
                  fallbackSize="sm"
                />
                <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/95 via-black/80 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-1.5 drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)]">
                  <p className="text-white text-xs font-semibold leading-tight line-clamp-2">
                    {member.name}
                  </p>
                  {member.character && (
                    <p className="text-white/70 text-[11px] leading-tight truncate">
                      {member.character}
                    </p>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
