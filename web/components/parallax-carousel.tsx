'use client';

import { registerParallax } from '@/lib/parallax-controller';
import { type ReactNode, useEffect, useRef } from 'react';

export function ParallaxCarousel({
  children,
  className,
}: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const section = el.closest('section');
    if (!section) return;
    return registerParallax(el, section, (t) => {
      el.style.transform = `translate3d(${(t - 0.5) * 120}px, 0, 0)`;
    });
  }, []);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
