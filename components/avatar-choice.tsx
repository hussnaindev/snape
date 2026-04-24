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

export type PresetAvatarUrl = (typeof PRESET_AVATARS)[number];

export function isPresetAvatarUrl(v: string): v is PresetAvatarUrl {
  return (PRESET_AVATARS as readonly string[]).includes(v);
}

export function AvatarChoice({
  value,
  onChange,
  className,
  size = 44,
  label = 'Choose an avatar',
  allowClear = false,
}: {
  value: string | null;
  onChange: (next: string | null) => void;
  className?: string;
  size?: number;
  label?: string;
  allowClear?: boolean;
}) {
  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-white/60 text-xs font-medium">{label}</p>
        {allowClear && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-[11px] text-white/40 hover:text-white/70 transition-colors"
            disabled={!value}
          >
            Remove
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {PRESET_AVATARS.map((src) => {
          const selected = value === src;
          return (
            <button
              key={src}
              type="button"
              onClick={() => onChange(src)}
              aria-pressed={selected}
              className={cn(
                'relative rounded-full overflow-hidden border transition-colors',
                selected ? 'border-white' : 'border-white/15 hover:border-white/40',
              )}
              style={{ width: size, height: size }}
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
