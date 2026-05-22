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
      <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
        {visible.map((member) => {
          const photo = tmdbImage(member.profile_path, 'w185');
          return (
            <Link
              key={member.id}
              href={`/person/${member.id}`}
              prefetch={false}
              className="flex-none w-24 sm:w-28 group"
            >
              <div className="aspect-square rounded-full overflow-hidden bg-white/5 mb-2 relative ring-2 ring-white/10 group-hover:ring-white/30 shadow-[0_8px_24px_rgba(255,255,255,0.06)] group-hover:shadow-[0_12px_32px_rgba(255,255,255,0.12)] transition-all duration-300 ease-out">
                <ActorProfileImage
                  src={photo}
                  alt={member.name}
                  sizes="(max-width: 640px) 96px, 112px"
                  className="object-cover group-hover:scale-105 transition-transform duration-200"
                  fallbackSize="sm"
                />
              </div>
              {/* Title bar below circle */}
              <div className="bg-black/70 sm:bg-black/60 sm:backdrop-blur-sm py-1.5 rounded-md px-2">
                <p className="text-[10px] sm:text-[11px] font-chesna-grotesk uppercase truncate tracking-[0.2em] font-light text-white/90 text-center leading-tight">
                  {member.name}
                </p>
                {member.character && (
                  <p className="text-white/50 text-[9px] text-center truncate leading-tight mt-0.5">
                    {member.character}
                  </p>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
