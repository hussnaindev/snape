'use client';

import { cn } from '@/lib/utils';
import Image from 'next/image';

export const PRESET_AVATARS = [
  '/avatar1.png',
  '/avatar2.png',
  '/avatar3.png',
  '/avatar4.png',
  '/avatar5.png',
] as const;

export function AvatarChoice({
  value,
  onChange,
  className,
  size = 44,
  label = 'Choose an avatar',
  allowClear = false,
  variant = 'circle',
  portraitGridCols = 3,
}: {
  value: string | null;
  onChange: (next: string | null) => void;
  className?: string;
  size?: number;
  label?: string;
  allowClear?: boolean;
  variant?: 'circle' | 'portrait';
  /** Only applies when `variant` is `portrait`. */
  portraitGridCols?: 3 | 5;
}) {
  const itemStyle =
    variant === 'portrait'
      ? { width: size, height: Math.round(size * (4 / 3)) }
      : { width: size, height: size };

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-white/60 text-xs font-medium">{label}</p>
        {allowClear && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="text-[11px] text-white/40 hover:text-white/70 transition-colors cursor-pointer"
              disabled={!value}
            >
            Remove
          </button>
        )}
      </div>

      <div
        className={cn(
          variant === 'portrait'
            ? cn(
                'grid gap-2',
                portraitGridCols === 5 ? 'grid-cols-5' : 'grid-cols-3',
              )
            : 'flex flex-wrap gap-2',
        )}
      >
        {PRESET_AVATARS.map((src) => {
          const selected = value === src;
          return (
              <button
                key={src}
                type="button"
                onClick={() => onChange(src)}
                aria-pressed={selected}
                className={cn(
                  'relative overflow-hidden border transition-colors cursor-pointer',
                  variant === 'portrait' ? 'rounded-xl' : 'rounded-full',
                  selected ? 'border-white' : 'border-white/15 hover:border-white/40',
                )}
                style={itemStyle}
                title={selected ? 'Selected' : 'Select'}
              >
              <Image
                src={src}
                alt="Avatar option"
                fill
                sizes={`${size}px`}
                className="object-cover"
              />
              {selected && <div className="absolute inset-0 ring-2 ring-white/70" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
