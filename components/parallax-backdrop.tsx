'use client';

import Image from 'next/image';
import { useEffect, useRef } from 'react';

interface ParallaxBackdropProps {
  src: string;
  wrapperClassName: string;
  imageClassName: string;
}

export function ParallaxBackdrop({ src, wrapperClassName, imageClassName }: ParallaxBackdropProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const section = el.closest('section');
    if (!section) return;

    const update = () => {
      const { top, height } = section.getBoundingClientRect();
      const vh = window.innerHeight;
      // t: 0 when section bottom enters viewport, 1 when section top exits
      const t = 1 - (top + height) / (vh + height);
      el.style.transform = `translate3d(0, ${(t - 0.5) * 360}px, 0)`;
    };

    window.addEventListener('scroll', update, { passive: true });
    update();
    return () => window.removeEventListener('scroll', update);
  }, []);

  return (
    <div
      ref={ref}
      className={wrapperClassName}
      style={{
        maskImage: 'linear-gradient(to right, transparent 8%, black 42%)',
        willChange: 'transform',
      }}
    >
      <Image
        src={src}
        alt=""
        fill
        sizes="(max-width: 640px) 70vw, 60vw"
        className={imageClassName}
        style={{ filter: 'drop-shadow(-32px 0 56px rgba(0,0,0,0.9))' }}
      />
    </div>
  );
}
