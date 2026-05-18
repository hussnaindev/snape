'use client';

import { useEffect, useRef, type ReactNode } from 'react';

export function ParallaxCarousel({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const section = el.closest('section');
    if (!section) return;

    if (
      window.matchMedia('(max-width: 639px)').matches ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) return;

    el.style.willChange = 'transform, opacity';
    let rafId = 0;

    const update = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        const { top, height } = section.getBoundingClientRect();
        const vh = window.innerHeight;
        const t = 1 - (top + height) / (vh + height);

        const translateX = (t - 0.5) * 120;
        const opacity = Math.max(0, Math.min(t / 0.25, (1 - t) / 0.2));

        el.style.transform = `translate3d(${translateX}px, 0, 0)`;
        el.style.opacity = String(opacity);
      });
    };

    window.addEventListener('scroll', update, { passive: true });
    update();
    return () => {
      window.removeEventListener('scroll', update);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
