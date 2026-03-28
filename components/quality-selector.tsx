'use client';

import { cn } from '@/lib/utils';
import type { ParsedStream, StreamQuality } from '@/types/torrentio';

interface QualitySelectorProps {
  groups: Partial<Record<StreamQuality, ParsedStream[]>>;
  selected: StreamQuality | null;
  onSelect: (quality: StreamQuality) => void;
}

const ORDER: StreamQuality[] = ['4K', '1080p', '720p', '480p', 'other'];

export function QualitySelector({ groups, selected, onSelect }: QualitySelectorProps) {
  const available = ORDER.filter((q) => (groups[q]?.length ?? 0) > 0);
  if (available.length === 0) return null;

  return (
    <div className="flex gap-2 flex-wrap">
      {available.map((q) => (
        <button
          key={q}
          type="button"
          onClick={() => onSelect(q)}
          className={cn(
            'px-4 py-1.5 rounded-full text-sm font-semibold border transition-colors',
            selected === q
              ? 'bg-sage text-black border-sage'
              : 'bg-white/5 text-white/70 border-white/15 hover:border-sage hover:text-sage',
          )}
        >
          {q}
        </button>
      ))}
    </div>
  );
}
