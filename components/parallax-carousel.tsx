'use client';

import { registerParallax } from '@/lib/parallax-controller';
import { useEffect, useRef, type ReactNode } from 'react';

export function ParallaxCarousel({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const section = el.closest('section');
    if (!section) return;
    return registerParallax(el, section, (t) => {
      const translateX = (t - 0.5) * 120;
      const opacity = Math.max(0, Math.min(t / 0.25, (1 - t) / 0.2));
      el.style.transform = `translate3d(${translateX}px, 0, 0)`;
      el.style.opacity = String(opacity);
    });
  }, []);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
