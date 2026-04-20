'use client';

import Image from 'next/image';
import { useState } from 'react';

import { Logo } from '@/components/ui/logo';

const fallbackLogoClass = {
  sm: 'w-10 h-10',
  md: 'w-14 h-14',
  lg: 'w-20 h-20 md:w-28 md:h-28',
} as const;

export type ActorProfileFallbackSize = keyof typeof fallbackLogoClass;

function ActorProfileFallback({ size }: { size: ActorProfileFallbackSize }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-white/5">
      <Logo className={`${fallbackLogoClass[size]} text-white/35 shrink-0`} aria-hidden />
    </div>
  );
}

interface ActorProfileImageProps {
  src: string;
  alt: string;
  sizes: string;
  className?: string;
  fallbackSize: ActorProfileFallbackSize;
}

export function ActorProfileImage({
  src,
  alt,
  sizes,
  className,
  fallbackSize,
}: ActorProfileImageProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return <ActorProfileFallback size={fallbackSize} />;
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
