'use client';

import { registerParallax } from '@/lib/parallax-controller';
import { type ReactNode, useEffect, useRef } from 'react';

interface ParallaxContentProps {
  children: ReactNode;
  className?: string;
  speed?: number;
  direction?: 'left' | 'right' | 'vertical';
  fade?: boolean;
}

export function ParallaxContent({
  children,
  className,
  speed = 120,
  direction = 'right',
  fade = true,
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
      if (fade) {
        el.style.opacity = String(Math.max(0, Math.min(t / 0.25, (1 - t) / 0.2)));
      }
    });
  }, [speed, direction, fade]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
