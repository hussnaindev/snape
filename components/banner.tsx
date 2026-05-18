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
            'linear-gradient(180deg, #070b08 0%, rgba(7,11,8,0.6) 25%, transparent 50%, transparent 100%)',
        }}
      />

      <div className="absolute bottom-0 left-0 right-0 px-4 pb-8">
        <h2
          className="text-white font-bold mb-3 leading-tight"
          style={{
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", Arial, sans-serif',
            fontSize: '1.75rem',
            letterSpacing: '-0.5px',
          }}
        >
          Watch anything. Completely free.
        </h2>
        <p
          className="text-white/80 mb-5 leading-relaxed"
          style={{
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", Arial, sans-serif',
            fontSize: '1rem',
          }}
        >
          Thousands of movies and shows, streaming instantly. New releases every week.
        </p>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push('/auth/login')}
            className="inline-flex items-center justify-center gap-1.5 text-white font-semibold cursor-pointer transition-all duration-200 hover:bg-white/25"
            style={{
              fontFamily:
                '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", Arial, sans-serif',
              fontSize: 14,
              height: 38,
              borderRadius: 38,
              background: 'rgba(255,255,255,0.15)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              paddingLeft: 16,
              paddingRight: 20,
              border: '1px solid rgba(255,255,255,0.2)',
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
              <polyline points="10 17 15 12 10 7" />
              <line x1="15" y1="12" x2="3" y2="12" />
            </svg>
            Sign In
          </button>

          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('pwa-install-trigger'))}
            className="inline-flex items-center justify-center gap-2 text-black font-semibold cursor-pointer transition-all duration-200 hover:bg-gray-100"
            style={{
              fontFamily:
                '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", Arial, sans-serif',
              fontSize: 14,
              height: 38,
              borderRadius: 38,
              backgroundColor: 'white',
              paddingLeft: 16,
              paddingRight: 20,
              border: 'none',
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
            </svg>
            Download App
          </button>
        </div>
      </div>
    </div>
  );
}