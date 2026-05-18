'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';

export function Banner() {
  const router = useRouter();

  return (
    <div className="relative w-full h-[350px] sm:h-[400px] -mt-16 mt-8 overflow-hidden">
      <Image
        src="/apple-tv/slide-1-desktop.webp"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, #070b08 0%, rgba(7,11,8,0.6) 25%, transparent 50%, #070b08 100%)',
        }}
      />

      <div className="absolute bottom-0 left-0 right-0 px-4 pb-8">
        <h2
          className="text-white font-bold mb-2 leading-tight sm:mb-3"
          style={{
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", Arial, sans-serif',
            fontSize: 'clamp(1.125rem, 5vw, 1.75rem)',
            letterSpacing: '-0.5px',
          }}
        >
          <span className="sm:hidden">Free streaming.</span>
          <span className="hidden sm:inline">Watch anything. Completely free.</span>
        </h2>
        <p
          className="text-white/80 mb-4 leading-snug sm:mb-5 sm:leading-relaxed"
          style={{
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", Arial, sans-serif',
            fontSize: 'clamp(0.8125rem, 3.5vw, 1rem)',
          }}
        >
          <span className="sm:hidden">Thousands of movies & shows, free.</span>
          <span className="hidden sm:inline">Thousands of movies and shows, streaming instantly. New releases every week.</span>
        </p>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push('/auth/login')}
            className="px-4 sm:px-6 py-1.5 sm:py-2 rounded-full bg-white text-black text-xs sm:text-sm font-semibold hover:bg-white/90 transition-colors cursor-pointer"
          >
            Login
          </button>

          <button
            type="button"
            onClick={() => router.push('/auth/signup')}
            className="px-4 sm:px-6 py-1.5 sm:py-2 rounded-full border border-white/70 bg-white/15 text-white text-xs sm:text-sm font-semibold hover:bg-white/25 transition-colors sm:border-white/30 sm:bg-transparent cursor-pointer"
          >
            Sign Up
          </button>
        </div>
      </div>
    </div>
  );
}