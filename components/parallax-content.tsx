'use client';

import { registerParallax } from '@/lib/parallax-controller';
import { type ReactNode, useEffect, useRef } from 'react';

interface ParallaxContentProps {
  children: ReactNode;
  className?: string;
  speed?: number;
  direction?: 'left' | 'right' | 'vertical';
}

export function ParallaxContent({
  children,
  className,
  speed = 120,
  direction = 'right',
}: ParallaxContentProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const section = el.closest('section');
    if (!section) return;
    return registerParallax(el, section, (t) => {
      if (direction === 'vertical') {
        el.style.transform = `translate3d(0, ${(t - 0.5) * speed}px, 0)`;
      } else {
        const dir = direction === 'left' ? -1 : 1;
        el.style.transform = `translate3d(${(t - 0.5) * speed * dir}px, 0, 0)`;
      }
    });
  }, [speed, direction]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
