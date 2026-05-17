'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

type Slide = {
  bgColor: string;
  desktopSrc: string;
  mobileSrc: string;
  title: string;
  logoSrc: string | null;
  logoAlt: string;
  badge: string | null;
  description: string;
  explainability: string | null;
  primaryLabel: string;
  moreInfo: boolean;
  metadata: string | null;
  rating: string | null;
};

const SLIDES: Slide[] = [
  {
    bgColor: 'rgb(29,15,11)',
    desktopSrc: '/apple-tv/slide-1-desktop.webp',
    mobileSrc: '/apple-tv/slide-1-mobile.webp',
    title: 'Watch anything. Completely free.',
    logoSrc: null,
    logoAlt: '',
    badge: null,
    description: 'Thousands of movies and shows, streaming instantly. New releases every week.',
    explainability: null,
    primaryLabel: 'Sign In',
    moreInfo: false,
    metadata: null,
    rating: null,
  },
  {
    bgColor: 'rgb(218,217,209)',
    desktopSrc: '/apple-tv/slide-4-desktop.webp',
    mobileSrc: '/apple-tv/slide-4-desktop.webp',
    title: 'Stick',
    logoSrc: '/apple-tv/slide-4-logo.webp',
    logoAlt: 'Stick',
    badge: null,
    description:
      'Owen Wilson is an ex–pro golfer taking a big swing at his second chance in this feel-good comeback story.',
    explainability: null,
    primaryLabel: 'Watch',
    moreInfo: true,
    metadata: 'TV Show',
    rating: 'TV-MA',
  },
  {
    bgColor: 'rgb(203,205,197)',
    desktopSrc: '/apple-tv/slide-5-desktop.webp',
    mobileSrc: '/apple-tv/slide-5-desktop.webp',
    title: 'Your Friends & Neighbors',
    logoSrc: '/apple-tv/slide-5-logo.webp',
    logoAlt: 'Your Friends & Neighbors',
    badge: 'New Episode Every Friday',
    description: 'Jon Hamm stars in the irresistible hit about affairs, money, and murder.',
    explainability: '#1 Show on Apple TV',
    primaryLabel: 'Watch',
    moreInfo: true,
    metadata: 'TV Show',
    rating: 'TV-MA',
  },
  {
    bgColor: 'rgb(181,149,95)',
    desktopSrc: '/apple-tv/slide-6-desktop.webp',
    mobileSrc: '/apple-tv/slide-6-desktop.webp',
    title: 'Margo’s Got Money Troubles',
    logoSrc: '/apple-tv/slide-6-logo.webp',
    logoAlt: 'Margo’s Got Money Troubles',
    badge: 'New Episode Every Wednesday',
    description:
      'Elle Fanning, Michelle Pfeiffer, Nick Offerman, and Nicole Kidman star in a story of family, dysfunction, and wrestling.',
    explainability: 'Top Rated on Rotten Tomatoes',
    primaryLabel: 'Watch',
    moreInfo: true,
    metadata: 'TV Show',
    rating: 'TV-MA',
  },
  {
    bgColor: 'rgb(25,24,23)',
    desktopSrc: '/apple-tv/slide-7-desktop.webp',
    mobileSrc: '/apple-tv/slide-7-desktop.webp',
    title: 'Imperfect Women',
    logoSrc: '/apple-tv/slide-7-logo.webp',
    logoAlt: 'Imperfect Women',
    badge: null,
    description:
      'The secret lives of three best friends turn deadly in this scandalous murder mystery.',
    explainability: null,
    primaryLabel: 'Watch',
    moreInfo: true,
    metadata: 'TV Show',
    rating: 'TV-MA',
  },
  {
    bgColor: 'rgb(5,16,32)',
    desktopSrc: '/apple-tv/slide-8-desktop.webp',
    mobileSrc: '/apple-tv/slide-8-desktop.webp',
    title: 'Monarch: Legacy of Monsters',
    logoSrc: '/apple-tv/slide-8-logo.webp',
    logoAlt: 'Monarch: Legacy of Monsters',
    badge: null,
    description:
      'A secret family legacy. A mysterious organization. And the legendary Titan that ties them together: Godzilla.',
    explainability: '#1 in Adventure on Apple TV',
    primaryLabel: 'Watch',
    moreInfo: true,
    metadata: 'TV Show',
    rating: 'TV-14',
  },
  {
    bgColor: 'rgb(230,236,227)',
    desktopSrc: '/apple-tv/slide-9-desktop.webp',
    mobileSrc: '/apple-tv/slide-9-desktop.webp',
    title: 'Widow’s Bay',
    logoSrc: '/apple-tv/slide-9-logo.webp',
    logoAlt: 'Widow’s Bay',
    badge: 'New Episode Every Wednesday',
    description:
      'Welcome to the island, please enjoy your stay. Just don’t ask too many questions.',
    explainability: null,
    primaryLabel: 'Watch',
    moreInfo: true,
    metadata: 'TV Show',
    rating: 'TV-MA',
  },
  {
    bgColor: 'rgb(47,45,32)',
    desktopSrc: '/apple-tv/slide-10-desktop.webp',
    mobileSrc: '/apple-tv/slide-10-desktop.webp',
    title: 'Shrinking',
    logoSrc: '/apple-tv/slide-10-logo.webp',
    logoAlt: 'Shrinking',
    badge: null,
    description:
      'Jason Segel, Harrison Ford, and Jessica Williams navigate life’s ups and downs in this heartwarming, hilarious hit.',
    explainability: null,
    primaryLabel: 'Watch',
    moreInfo: true,
    metadata: 'TV Show',
    rating: 'TV-MA',
  },
  {
    bgColor: 'rgb(220,206,199)',
    desktopSrc: '/apple-tv/slide-11-desktop.webp',
    mobileSrc: '/apple-tv/slide-11-desktop.webp',
    title: 'For All Mankind',
    logoSrc: '/apple-tv/slide-11-logo.webp',
    logoAlt: 'For All Mankind',
    badge: 'New Episode Every Friday',
    description: 'The fight to dominate space continues. Pick a side: Earth vs. Mars.',
    explainability: null,
    primaryLabel: 'Watch',
    moreInfo: true,
    metadata: 'TV Show',
    rating: 'TV-MA',
  },
];

const SLIDE_MS = 480;
const CYCLE_MS = 8000;
const WHEEL_DEBOUNCE_MS = 700;

const DESKTOP_GRADIENT = [
  'linear-gradient(0deg, rgba(0,0,0,.45) 0%, rgba(0,0,0,.36) 5%, rgba(0,0,0,.27) 9%, rgba(0,0,0,.18) 16%, rgba(0,0,0,.09) 22%, rgba(0,0,0,.02) 29%, transparent 36%)',
  'linear-gradient(80deg, rgba(0,0,0,.14), transparent 41%)',
  'radial-gradient(circle 100vmax at 66.7% 0%, transparent 0%, rgba(0,0,0,.04) 19%, rgba(0,0,0,.15) 36%, rgba(0,0,0,.3) 51%, rgba(0,0,0,.33) 53%, rgba(0,0,0,.49) 65%, rgba(0,0,0,.67) 77%, rgba(0,0,0,.85) 89%, #000 100%)',
].join(', ');

const MOBILE_MASK = 'linear-gradient(180deg, transparent 0%, transparent 50%, #000 75%, #000 100%)';

const APPLE_FONT =
  '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", Arial, sans-serif';

export function HeroSection() {
  const [current, setCurrent] = useState(0);
  const currentRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dotsRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const touchStartX = useRef<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const dragStartX = useRef<number | null>(null);
  const wheelDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function navigate(idx: number) {
    if (idx === currentRef.current) return;
    setCurrent(idx);
    currentRef.current = idx;
  }

  function resetTimer() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      navigate((currentRef.current + 1) % SLIDES.length);
    }, CYCLE_MS);
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once on mount; navigate/resetTimer read only refs
  useEffect(() => {
    resetTimer();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Touchpad horizontal swipe — fires WheelEvent with deltaX, not pointer events
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once on mount; navigate/resetTimer read only refs
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      if (Math.abs(e.deltaX) < 20) return;
      e.preventDefault();
      if (wheelDebounceRef.current) return;
      const next =
        e.deltaX > 0
          ? (currentRef.current + 1) % SLIDES.length
          : (currentRef.current - 1 + SLIDES.length) % SLIDES.length;
      navigate(next);
      resetTimer();
      wheelDebounceRef.current = setTimeout(() => {
        wheelDebounceRef.current = null;
      }, WHEEL_DEBOUNCE_MS);
    };
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', handleWheel);
      if (wheelDebounceRef.current) clearTimeout(wheelDebounceRef.current);
    };
  }, []);

  // Keep active dot visible in the pill
  useEffect(() => {
    const el = dotsRef.current;
    if (!el) return;
    const child = el.children[current] as HTMLElement | undefined;
    if (!child) return;
    el.scrollTo({
      left: child.offsetLeft - el.offsetWidth / 2 + child.offsetWidth / 2,
      behavior: 'smooth',
    });
  }, [current]);

  function handleDotClick(i: number) {
    navigate(i);
    resetTimer();
  }

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0]?.clientX ?? null;
    dragStartX.current = e.touches[0]?.clientX ?? null;
    setIsDragging(true);
    setDragOffset(0);
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (touchStartX.current === null || dragStartX.current === null) return;
    const currentX = e.touches[0]?.clientX ?? touchStartX.current;
    const dx = currentX - dragStartX.current;
    setDragOffset(dx);
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null || dragStartX.current === null) {
      setIsDragging(false);
      setDragOffset(0);
      return;
    }
    const dx = touchStartX.current - (e.changedTouches[0]?.clientX ?? touchStartX.current);
    if (Math.abs(dx) > 50) {
      const next =
        dx > 0
          ? (currentRef.current + 1) % SLIDES.length
          : (currentRef.current - 1 + SLIDES.length) % SLIDES.length;
      navigate(next);
      resetTimer();
    }
    setIsDragging(false);
    setDragOffset(0);
    touchStartX.current = null;
    dragStartX.current = null;
  }

  return (
    <div
      ref={containerRef}
      className="relative h-[30vh] sm:h-screen min-h-[260px] overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* ── Slide track: all slides side-by-side, translateX moves between them ── */}
      <div
        className="absolute inset-0 flex h-full"
        style={{
          transform: `translateX(calc(-${current * 100}% + ${dragOffset}px))`,
          transition: isDragging ? 'none' : `transform ${SLIDE_MS}ms cubic-bezier(0.25, 1, 0.5, 1)`,
          willChange: 'transform',
        }}
      >
        {SLIDES.map((s, i) => (
          <div
            key={s.desktopSrc}
            className="relative h-full w-full flex-shrink-0"
            style={{ backgroundColor: s.bgColor }}
          >
            {/* Background images */}
            <Image
              src={s.mobileSrc}
              alt=""
              fill
              priority={i === 0}
              sizes="100vw"
              className="sm:hidden object-cover object-top"
            />
            <Image
              src={s.desktopSrc}
              alt=""
              fill
              priority={i === 0}
              sizes="100vw"
              className="hidden sm:block object-cover object-center"
            />
            {/* Desktop gradient scrim */}
            <div
              className="absolute inset-0 hidden sm:block"
              style={{ background: DESKTOP_GRADIENT }}
            />

            {/* Mobile bottom blur scrim */}
            <div
              className="absolute inset-0 sm:hidden pointer-events-none"
              style={{
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                backgroundColor: 'rgba(0,0,0,.3)',
                WebkitMaskImage: MOBILE_MASK,
                maskImage: MOBILE_MASK,
              }}
            />

            {/* Desktop content — bottom-left */}
            <div
              className="absolute hidden sm:flex flex-col items-start"
              style={{ bottom: 75, left: 40, right: 40 }}
            >
              {s.badge && (
                <span
                  className="inline-flex items-center mb-3 text-white font-semibold"
                  style={{
                    fontFamily: APPLE_FONT,
                    fontSize: 13,
                    padding: '5px 12px',
                    borderRadius: 20,
                    background: 'rgba(255,255,255,0.15)',
                    backdropFilter: 'blur(10px)',
                    WebkitBackdropFilter: 'blur(10px)',
                  }}
                >
                  {s.badge}
                </span>
              )}

              {s.logoSrc ? (
                <div className="mb-3">
                  <Image
                    src={s.logoSrc}
                    alt={s.logoAlt}
                    width={432}
                    height={162}
                    className="object-contain object-left-bottom"
                    style={{ maxWidth: 216, height: 'auto' }}
                  />
                </div>
              ) : (
                <h1
                  className="text-white font-bold mb-3 leading-[1.1]"
                  style={{
                    fontFamily: APPLE_FONT,
                    fontSize: '2.125rem',
                    letterSpacing: '-0.5px',
                    maxWidth: 560,
                  }}
                >
                  {s.title}
                </h1>
              )}

              {(s.metadata ?? s.rating) && (
                <div className="flex items-center gap-2 mb-2">
                  {s.metadata && (
                    <span className="text-white/80 text-sm" style={{ fontFamily: APPLE_FONT }}>
                      {s.metadata}
                    </span>
                  )}
                  {s.rating && (
                    <span
                      className="text-white/80 font-medium"
                      style={{
                        fontFamily: APPLE_FONT,
                        fontSize: 10,
                        border: '1px solid rgba(255,255,255,0.5)',
                        borderRadius: 3,
                        padding: '1px 5px',
                      }}
                    >
                      {s.rating.replace('_', '-').toUpperCase()}
                    </span>
                  )}
                </div>
              )}

              <p
                className="text-white/80 leading-relaxed line-clamp-3"
                style={{ fontFamily: APPLE_FONT, fontSize: 17, maxWidth: 420 }}
              >
                {s.description}
              </p>

              {s.explainability && (
                <p className="text-white/60 mt-2" style={{ fontFamily: APPLE_FONT, fontSize: 14 }}>
                  {s.explainability}
                </p>
              )}

              <div className="flex items-center gap-2.5 mt-3.5">
                <button
                  type="button"
                  className="inline-flex items-center justify-center gap-1.5 text-black font-semibold cursor-pointer"
                  style={{
                    fontFamily: APPLE_FONT,
                    fontSize: 14,
                    height: 42,
                    borderRadius: 42,
                    backgroundColor: 'white',
                    minWidth: 120,
                    paddingLeft: 18,
                    paddingRight: 22,
                    border: 'none',
                  }}
                >
                  {s.primaryLabel === 'Sign In' ? (
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
                  ) : (
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 12 12"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M2 1.5a.5.5 0 0 1 .765-.424l8 4.5a.5.5 0 0 1 0 .848l-8 4.5A.5.5 0 0 1 2 10.5z" />
                    </svg>
                  )}
                  {s.primaryLabel}
                </button>
                {s.moreInfo && (
                  <button
                    type="button"
                    className="inline-flex items-center justify-center gap-1.5 font-semibold cursor-pointer text-white"
                    style={{
                      fontFamily: APPLE_FONT,
                      fontSize: 14,
                      height: 42,
                      borderRadius: 42,
                      background: 'rgba(255,255,255,0.15)',
                      backdropFilter: 'blur(60px) saturate(220%)',
                      WebkitBackdropFilter: 'blur(60px) saturate(220%)',
                      paddingLeft: 18,
                      paddingRight: 22,
                      border: 'none',
                    }}
                  >
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 12 12"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M6 1a.5.5 0 0 1 .5.5V5.5H10.5a.5.5 0 0 1 0 1H6.5V10.5a.5.5 0 0 1-1 0V6.5H1.5a.5.5 0 0 1 0-1H5.5V1.5A.5.5 0 0 1 6 1z" />
                    </svg>
                    More Info
                  </button>
                )}
              </div>
            </div>

            {/* Mobile content — bottom-center */}
            <div
              className="absolute sm:hidden left-0 right-0 flex flex-col items-center text-center px-4"
              style={{ bottom: 44 }}
            >
              {s.badge && (
                <span
                  className="inline-flex items-center mb-1.5 text-white font-semibold"
                  style={{
                    fontFamily: APPLE_FONT,
                    fontSize: 10,
                    padding: '3px 10px',
                    borderRadius: 20,
                    background: 'rgba(255,255,255,0.15)',
                  }}
                >
                  {s.badge}
                </span>
              )}

              {s.logoSrc ? (
                <div className="mb-1.5">
                  <Image
                    src={s.logoSrc}
                    alt={s.logoAlt}
                    width={216}
                    height={81}
                    className="object-contain"
                    style={{ maxHeight: 52, height: 'auto' }}
                  />
                </div>
              ) : (
                <h1
                  className="text-white font-bold text-base leading-tight mb-1.5"
                  style={{ fontFamily: APPLE_FONT }}
                >
                  {s.title}
                </h1>
              )}

              <p
                className="text-white/70 text-xs leading-relaxed line-clamp-2 mb-2"
                style={{ maxWidth: 260, fontFamily: APPLE_FONT }}
              >
                {s.description}
              </p>

              <button
                type="button"
                className="inline-flex items-center justify-center gap-1 font-semibold cursor-pointer text-black text-xs"
                style={{
                  fontFamily: APPLE_FONT,
                  height: 34,
                  borderRadius: 34,
                  backgroundColor: 'white',
                  paddingLeft: 16,
                  paddingRight: 16,
                  border: 'none',
                }}
              >
                {s.primaryLabel === 'Sign In' ? (
                  <svg
                    width="12"
                    height="12"
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
                ) : (
                  <svg
                    width="11"
                    height="11"
                    viewBox="0 0 12 12"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M2 1.5a.5.5 0 0 1 .765-.424l8 4.5a.5.5 0 0 1 0 .848l-8 4.5A.5.5 0 0 1 2 10.5z" />
                  </svg>
                )}
                {s.primaryLabel}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* ── Pagination indicator (fixed to container, above the track) ── */}
      <div className="absolute bottom-3 left-0 right-0 flex justify-center items-center pointer-events-none z-10">
        <div
          className="pointer-events-auto flex items-center"
          style={{
            borderRadius: 20,
            padding: '3px 6px',
            backdropFilter: 'saturate(180%) blur(10px)',
            WebkitBackdropFilter: 'saturate(180%) blur(10px)',
            backgroundColor: 'rgba(0,0,0,.3)',
          }}
        >
          <div
            ref={dotsRef}
            className="inline-flex items-center shrink-0 overflow-hidden"
            style={{ maxWidth: 160, scrollBehavior: 'smooth' }}
          >
            {SLIDES.map((s, i) => {
              const dist = Math.abs(i - current);
              const isActive = i === current;
              const scale = isActive ? 0.45 : dist === 1 ? 0.35 : dist === 2 ? 0.25 : 0.2;
              return (
                <button
                  key={s.desktopSrc}
                  type="button"
                  onClick={() => handleDotClick(i)}
                  aria-label={`Go to slide ${i + 1}`}
                  style={{
                    width: 20,
                    height: 20,
                    padding: 0,
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <span
                    style={{
                      display: 'block',
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      backgroundColor: isActive ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.3)',
                      transform: `scale3d(${scale},${scale},${scale})`,
                      transition: 'transform 0.1s, background-color 0.3s',
                      willChange: 'transform',
                    }}
                  />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
