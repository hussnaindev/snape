import { type PreferredProviderKey, preferredProviderMeta } from '@/lib/watch-providers';
import Image from 'next/image';

interface Props {
  providers: PreferredProviderKey[];
  reserveSpace?: boolean;
}

export function WatchProvidersRow({ providers, reserveSpace = true }: Props) {
  if (providers.length === 0) {
    return reserveSpace ? <div className="mt-2 h-8 md:h-16 shrink-0" aria-hidden="true" /> : null;
  }

  return (
    <div className="mt-2 shrink-0">
      <div className="flex flex-nowrap items-center overflow-x-auto">
        {providers.map((key, idx) => {
          const { label, assetPath } = preferredProviderMeta(key);
          if (!assetPath) return null;

          const imgSizeClass =
            key === 'netflix' || key === 'max' ? 'h-[14px] md:h-[24px]' : 'h-6 md:h-11';

          const imgMaxWidthClass =
            key === 'netflix' || key === 'max'
              ? 'max-w-[92px] md:max-w-[135px]'
              : 'max-w-[200px] md:max-w-[260px]';

          return (
            <span
              key={key}
              className="inline-flex items-center justify-center h-8 md:h-16 shrink-0 px-2 md:px-3 first:pl-0 last:pr-0 border-r border-white/0 last:border-r-0 relative"
              title={label}
            >
              {idx < providers.length - 1 && (
                <span
                  className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 h-6 md:h-10 w-px bg-gradient-to-b from-transparent via-white/35 to-transparent"
                  aria-hidden="true"
                />
              )}
              <Image
                src={assetPath}
                alt={label}
                width={170}
                height={56}
                className={`${imgSizeClass} ${imgMaxWidthClass} w-auto object-contain opacity-95 [filter:brightness(0)_invert(1)]`}
              />
            </span>
          );
        })}
      </div>
    </div>
  );
}
