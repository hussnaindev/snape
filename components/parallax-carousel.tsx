'use client';

import { useEffect, useRef, type ReactNode } from 'react';

export function ParallaxCarousel({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const section = el.closest('section');
    if (!section) return;

    const update = () => {
      const { top, height } = section.getBoundingClientRect();
      const vh = window.innerHeight;
      const t = 1 - (top + height) / (vh + height);

      const translateX = (t - 0.5) * 120;
      const opacity = Math.max(0, Math.min(t / 0.25, (1 - t) / 0.2));

      el.style.transform = `translate3d(${translateX}px, 0, 0)`;
      el.style.opacity = String(opacity);
    };

    window.addEventListener('scroll', update, { passive: true });
    update();
    return () => window.removeEventListener('scroll', update);
  }, []);

  return (
    <div ref={ref} className={className} style={{ willChange: 'transform, opacity' }}>
      {children}
    </div>
  );
}
