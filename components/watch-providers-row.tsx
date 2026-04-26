import Image from 'next/image';

import { preferredProviderMeta, type PreferredProviderKey } from '@/lib/watch-providers';

interface Props {
  providers: PreferredProviderKey[];
  /** Keep layout stable when providers are missing. */
  reserveSpace?: boolean;
}

export function WatchProvidersRow({ providers, reserveSpace = true }: Props) {
  if (providers.length === 0) {
    return reserveSpace ? (
      <div className="mt-1.5 md:mt-2 mb-2 md:mb-0 h-12 md:h-16" aria-hidden="true" />
    ) : null;
  }

  return (
    <div className="flex flex-nowrap items-center gap-3 mt-1.5 md:mt-2 mb-2 md:mb-0 overflow-x-auto overflow-y-visible">
      {providers.map((key) => {
        const { label, assetPath } = preferredProviderMeta(key);
        if (!assetPath) return null;

        // Wordmarks vary a lot in aspect ratio; tune the “big” ones down.
        const imgSizeClass =
          key === 'netflix'
            ? 'h-[18px] md:h-[24px]'
            : key === 'max'
              ? 'h-[18px] md:h-[24px]'
              : 'h-8 md:h-11';

        const imgMaxWidthClass =
          key === 'netflix'
            ? 'max-w-[100px] md:max-w-[135px]'
            : key === 'max'
              ? 'max-w-[100px] md:max-w-[135px]'
              : 'max-w-[220px] md:max-w-[260px]';

        // Some wordmark SVGs are tightly cropped; nudge down to avoid looking clipped.
        const imgNudgeClass = key === 'netflix' || key === 'max' ? 'mt-[1px]' : '';

        return (
          <span
            key={key}
            className="inline-flex items-center justify-center h-12 md:h-16 shrink-0"
            title={label}
          >
            <Image
              src={assetPath}
              alt={label}
              width={170}
              height={56}
              className={`${imgSizeClass} ${imgMaxWidthClass} ${imgNudgeClass} w-auto object-contain opacity-95 [filter:brightness(0)_invert(1)]`}
              priority={false}
            />
          </span>
        );
      })}
    </div>
  );
}

