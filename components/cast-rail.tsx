import { ActorProfileImage } from '@/components/actor-profile-image';
import { tmdbResponsive } from '@/lib/tmdb-image';
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
        {visible.map((member, idx) => {
          const photo = tmdbResponsive(member.profile_path, 'w185', 'w342');
          // First 6 fit on most viewports — load eagerly. Later cards lazy-load
          // as the user scrolls the rail horizontally.
          return (
            <Link
              key={member.id}
              href={`/person/${member.id}`}
              prefetch={false}
              className="flex-none w-24 sm:w-28 group lg:hover:scale-110 transition-transform duration-500 ease-out"
            >
              <div className="aspect-square rounded-full overflow-hidden bg-white/5 mb-2 relative ring-2 ring-white/10 shadow-[0_8px_24px_rgba(255,255,255,0.06)] transition-transform duration-500 ease-out">
                {photo ? (
                  <picture>
                    <source srcSet={photo.desktop} media="(min-width: 1024px)" />
                    <ActorProfileImage
                      src={photo.mobile}
                      alt={member.name}
                      sizes="(max-width: 640px) 96px, 112px"
                      className="object-cover will-change-transform transition-transform duration-500 lg:group-hover:animate-breath"
                      fallbackSize="sm"
                      loading={idx < 6 ? 'eager' : 'lazy'}
                    />
                  </picture>
                ) : (
                  <ActorProfileImage
                    src=""
                    alt={member.name}
                    sizes="(max-width: 640px) 96px, 112px"
                    className="object-cover will-change-transform transition-transform duration-500 lg:group-hover:animate-breath"
                    fallbackSize="sm"
                    loading={idx < 6 ? 'eager' : 'lazy'}
                  />
                )}
              </div>
              {/* Title bar below circle */}
              <div className="bg-gradient-to-t from-black/85 to-black/50 py-1.5 rounded-md px-2">
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
