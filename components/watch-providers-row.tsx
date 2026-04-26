import Image from 'next/image';
import { preferredProviderMeta, type PreferredProviderKey } from '@/lib/watch-providers';

interface Props {
  providers: PreferredProviderKey[];
  reserveSpace?: boolean;
}

export function WatchProvidersRow({ providers, reserveSpace = true }: Props) {
  if (providers.length === 0) {
    return reserveSpace ? (
      <div className="mt-2 h-8 md:h-16 shrink-0" aria-hidden="true" />
    ) : null;
  }

  return (
    <div className="flex flex-nowrap items-center gap-2 md:gap-3 mt-2 shrink-0 overflow-x-auto">
      {providers.map((key) => {
        const { label, assetPath } = preferredProviderMeta(key);
        if (!assetPath) return null;

        const imgSizeClass =
          key === 'netflix' || key === 'max'
            ? 'h-[14px] md:h-[24px]'
            : 'h-6 md:h-11';

        const imgMaxWidthClass =
          key === 'netflix' || key === 'max'
            ? 'max-w-[92px] md:max-w-[135px]'
            : 'max-w-[200px] md:max-w-[260px]';

        return (
          <span
            key={key}
            className="inline-flex items-center justify-center h-8 md:h-16 shrink-0"
            title={label}
          >
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
  );
}