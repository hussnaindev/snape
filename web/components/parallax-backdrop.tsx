'use client';

import { registerParallax } from '@/lib/parallax-controller';
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
    return registerParallax(el, section, (t) => {
      el.style.transform = `translate3d(0, ${(t - 0.5) * 360}px, 0)`;
    });
  }, []);

  return (
    <div
      ref={ref}
      className={wrapperClassName}
      style={{
        maskImage: 'linear-gradient(to right, transparent 8%, black 42%)',
        WebkitMaskImage: 'linear-gradient(to right, transparent 8%, black 42%)',
      }}
    >
      <Image
        src={src}
        alt=""
        fill
        sizes="(max-width: 640px) 70vw, 60vw"
        className={imageClassName}
        loading="lazy"
      />
    </div>
  );
}
