'use client';

import { useState } from 'react';

interface Props {
  text: string;
  className?: string;
}

export function ExpandableText({ text, className }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <p
        className={`text-white/70 text-xs md:text-sm leading-relaxed ${expanded ? '' : 'line-clamp-3'} ${className ?? ''}`}
      >
        {text}
      </p>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="mt-1 text-white/50 hover:text-white text-xs transition-colors"
      >
        {expanded ? 'See less' : 'See more'}
      </button>
    </div>
  );
}
