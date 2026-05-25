'use client';

import Hls from 'hls.js';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

type Slide = {
  id: string | null;
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
  trailerUrl: string;
};

const SLIDES: Slide[] = [
  {
    id: '248830',
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
    trailerUrl: 'https://play-edge.itunes.apple.com/WebObjects/MZPlayLocal.woa/hls/subscription/playlist.m3u8?cc=US&svcId=tvs.vds.4105&a=1815366977&isExternal=true&brandId=tvs.sbd.4000&id=1131292652&l=en-US&aec=UHD',
  },
  {
    id: '241609',
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
    trailerUrl: 'https://play-edge.itunes.apple.com/WebObjects/MZPlayLocal.woa/hls/subscription/playlist.m3u8?cc=US&svcId=tvs.vds.4105&a=1875429673&isExternal=true&brandId=tvs.sbd.4000&id=1283390014&l=en-US&aec=UHD',
  },
  {
    id: '202411',
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
    trailerUrl: 'https://play-edge.itunes.apple.com/WebObjects/MZPlayLocal.woa/hls/subscription/playlist.m3u8?cc=US&svcId=tvs.vds.4105&a=1867658901&isExternal=true&brandId=tvs.sbd.4000&id=1283929122&l=en-US&aec=UHD',
  },
  {
    id: '270476',
    bgColor: 'rgb(230,236,227)',
    desktopSrc: '/apple-tv/slide-9-desktop.webp',
    mobileSrc: '/apple-tv/slide-9-desktop.webp',
    title: "Widow's Bay",
    logoSrc: '/apple-tv/slide-9-logo.webp',
    logoAlt: "Widow's Bay",
    badge: 'New Episode Every Wednesday',
    description:
      "Welcome to the island, please enjoy your stay. Just don't ask too many questions.",
    explainability: null,
    primaryLabel: 'Watch',
    moreInfo: true,
    metadata: 'TV Show',
    rating: 'TV-MA',
    trailerUrl: 'https://play-edge.itunes.apple.com/WebObjects/MZPlayLocal.woa/hls/subscription/playlist.m3u8?cc=US&svcId=tvs.vds.4105&a=1888549019&isExternal=true&brandId=tvs.sbd.4000&id=1327736478&l=en-US&aec=UHD',
  },
  {
    id: '136311',
    bgColor: 'rgb(47,45,32)',
    desktopSrc: '/apple-tv/slide-10-desktop.webp',
    mobileSrc: '/apple-tv/slide-10-desktop.webp',
    title: 'Shrinking',
    logoSrc: '/apple-tv/slide-10-logo.webp',
    logoAlt: 'Shrinking',
    badge: null,
    description:
      "Jason Segel, Harrison Ford, and Jessica Williams navigate life's ups and downs in this heartwarming, hilarious hit.",
    explainability: null,
    primaryLabel: 'Watch',
    moreInfo: true,
    metadata: 'TV Show',
    rating: 'TV-MA',
    trailerUrl: 'https://play-edge.itunes.apple.com/WebObjects/MZPlayLocal.woa/hls/subscription/playlist.m3u8?cc=US&svcId=tvs.vds.4105&a=1855667906&isExternal=true&brandId=tvs.sbd.4000&id=1235227606&l=en-US&aec=UHD',
  },
  {
    id: '87917',
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
    trailerUrl: 'https://play-edge.itunes.apple.com/WebObjects/MZPlayLocal.woa/hls/subscription/playlist.m3u8?cc=US&svcId=tvs.vds.4105&a=1873096122&isExternal=true&brandId=tvs.sbd.4000&id=1269359171&l=en-US&aec=UHD',
  },
];

const SLIDE_MS = 380;
const WHEEL_DEBOUNCE_MS = SLIDE_MS + 100;

const DESKTOP_GRADIENT = [
  'linear-gradient(0deg, rgba(0,0,0,.45) 0%, rgba(0,0,0,.36) 5%, rgba(0,0,0,.27) 9%, rgba(0,0,0,.18) 16%, rgba(0,0,0,.09) 22%, rgba(0,0,0,.02) 29%, transparent 36%)',
  'linear-gradient(80deg, rgba(0,0,0,.14), transparent 41%)',
  'radial-gradient(circle 100vmax at 66.7% 0%, transparent 0%, rgba(7,11,8,.04) 19%, rgba(7,11,8,.15) 36%, rgba(7,11,8,.3) 51%, rgba(7,11,8,.33) 53%, rgba(7,11,8,.49) 65%, rgba(7,11,8,.67) 77%, rgba(7,11,8,.85) 89%, #070b08 100%)',
].join(', ');


const APPLE_FONT =
  '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", Arial, sans-serif';

export function HeroSection() {
  const router = useRouter();
  const [current, setCurrent] = useState(0);
  const currentRef = useRef(0);
  const dotsRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const dragStartX = useRef<number | null>(null);
  const dragBaseOffset = useRef(0);
  const wheelDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const hlsRef = useRef<Hls | null>(null);
  const trailerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showVideo, setShowVideo] = useState(false);
  const heroVisibleRef = useRef(true);

  function trackWidth() {
    return containerRef.current?.offsetWidth ?? 0;
  }

  function setTrackStyle(px: number, animated: boolean) {
    const el = trackRef.current;
    if (!el) return;
    el.style.transition = animated
      ? `transform ${SLIDE_MS}ms cubic-bezier(0.25, 1, 0.5, 1)`
      : 'none';
    el.style.transform = `translateX(${px}px)`;
  }

  function attachHls(idx: number) {
    const video = videoRefs.current[idx];
    const slide = SLIDES[idx];
    if (!video || !slide) return;
    hlsRef.current?.destroy();
    hlsRef.current = null;
    if (Hls.isSupported()) {
      // Adaptive bitrate selection — let HLS pick a rendition that matches
      // the bandwidth + viewport. Forcing the top rendition (UHD) on mobile
      // burns multiple MB before the hero is even past slide 1.
      const hls = new Hls({ autoStartLoad: true, capLevelToPlayerSize: true });
      hlsRef.current = hls;
      hls.loadSource(slide.trailerUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        hls.currentLevel = -1;
        video.play().catch(() => {});
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = slide.trailerUrl;
      video.play().catch(() => {});
    }
  }

  function resetTrailerTimer(idx: number) {
    if (trailerTimerRef.current) clearTimeout(trailerTimerRef.current);
    setShowVideo(false);
    for (const v of videoRefs.current) v?.pause();
    trailerTimerRef.current = setTimeout(() => {
      // Skip trailer load if user has already scrolled past the hero —
      // saves several MB of HLS segment fetches on mobile.
      if (!heroVisibleRef.current) return;
      setShowVideo(true);
      attachHls(idx);
    }, 2000);
  }

  function navigate(idx: number) {
    if (idx === currentRef.current) return;
    setTrackStyle(-(idx * trackWidth()), true);
    setCurrent(idx);
    currentRef.current = idx;
    resetTrailerTimer(idx);
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once on mount; resetTrailerTimer reads only refs
  useEffect(() => {
    resetTrailerTimer(0);
    return () => {
      if (trailerTimerRef.current) clearTimeout(trailerTimerRef.current);
      hlsRef.current?.destroy();
    };
  }, []);

  // Pause + tear down trailer when hero scrolls out of view; resume when back.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        heroVisibleRef.current = entry.isIntersecting;
        if (!entry.isIntersecting) {
          for (const v of videoRefs.current) v?.pause();
          hlsRef.current?.destroy();
          hlsRef.current = null;
          if (trailerTimerRef.current) {
            clearTimeout(trailerTimerRef.current);
            trailerTimerRef.current = null;
          }
          setShowVideo(false);
        } else {
          // Re-arm the trailer when user scrolls back to hero.
          resetTrailerTimer(currentRef.current);
        }
      },
      { threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Touchpad horizontal swipe — fires WheelEvent with deltaX, not pointer events
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once on mount; navigate reads only refs
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

  // Recalculate pixel offset on resize so the track stays on the right slide
  // biome-ignore lint/correctness/useExhaustiveDependencies: only needs to read refs
  useEffect(() => {
    const handleResize = () => {
      setTrackStyle(-(currentRef.current * trackWidth()), false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  function handleDotClick(i: number) {
    navigate(i);
  }

  function handlePrimaryClick(s: Slide) {
    if (s.primaryLabel === 'Sign In') {
      router.push('/auth/login');
    } else if (s.id) {
      router.push(`/series/${s.id}`);
    }
  }

  function handleMoreInfoClick(s: Slide) {
    if (s.id) {
      router.push(`/series/${s.id}`);
    }
  }

  function handleTouchStart(e: React.TouchEvent) {
    const x = e.touches[0]?.clientX;
    if (x === undefined) return;
    dragStartX.current = x;
    dragBaseOffset.current = -(currentRef.current * trackWidth());
    // Kill transition so the track follows the finger instantly
    const el = trackRef.current;
    if (el) el.style.transition = 'none';
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (dragStartX.current === null) return;
    const dx = (e.touches[0]?.clientX ?? dragStartX.current) - dragStartX.current;
    // Direct DOM write — no React re-render on every frame
    const el = trackRef.current;
    if (el) el.style.transform = `translateX(${dragBaseOffset.current + dx}px)`;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (dragStartX.current === null) return;
    const dx = (e.changedTouches[0]?.clientX ?? dragStartX.current) - dragStartX.current;
    dragStartX.current = null;

    const w = trackWidth();
    const threshold = w * 0.2;
    let nextIdx = currentRef.current;
    if (dx < -threshold) nextIdx = Math.min(currentRef.current + 1, SLIDES.length - 1);
    else if (dx > threshold) nextIdx = Math.max(currentRef.current - 1, 0);

    // Snap to target with transition
    setTrackStyle(-(nextIdx * w), true);

    if (nextIdx !== currentRef.current) {
      setCurrent(nextIdx);
      currentRef.current = nextIdx;
      resetTrailerTimer(nextIdx);
    }
  }

  return (
    <div
      ref={containerRef}
      className="relative h-[55vh] sm:h-screen min-h-[320px] overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* ── Slide track: all slides side-by-side; transform managed via trackRef (no re-renders during drag) ── */}
      <div
        ref={trackRef}
        className="absolute inset-0 flex h-full"
        style={{ willChange: 'transform' }}
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
            {/* Trailer video */}
            <video
              ref={(el) => { videoRefs.current[i] = el; }}
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${i === current && showVideo ? 'opacity-100' : 'opacity-0'}`}
              muted
              playsInline
              onEnded={() => { if (i === currentRef.current) navigate((i + 1) % SLIDES.length); }}
            />
            {/* Desktop gradient scrim */}
            <div
              className="absolute inset-0 hidden sm:block"
              style={{ background: DESKTOP_GRADIENT }}
            />

            {/* Mobile gradient scrim — fades image into the section below */}
            <div
              className="absolute inset-0 sm:hidden pointer-events-none"
              style={{
                background: 'linear-gradient(180deg, transparent 0%, transparent 38%, rgba(7,11,8,0.55) 65%, #070b08 90%)',
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
                  onClick={() => handlePrimaryClick(s)}
                  className="relative top-0 inline-flex items-center justify-center gap-2 text-nowrap rounded-full border py-0.5 text-xs font-semibold uppercase leading-tight tracking-widest transition-all duration-300 ease-out cursor-pointer active:top-0.5 h-10 px-3 md:h-12 md:px-5 min-w-36 border-transparent bg-white text-black lg:hover:bg-white/80 active:bg-white/70"
                >
                  {s.primaryLabel === 'Sign In' ? (
                    <svg
                      className="w-3 h-3 sm:w-3.5 sm:h-3.5"
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
                      className="w-3 h-3 sm:w-3.5 sm:h-3.5"
                      viewBox="0 0 12 12"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M2 1.5a.5.5 0 0 1 .765-.424l8 4.5a.5.5 0 0 1 0 .848l-8 4.5A.5.5 0 0 1 2 10.5z" />
                    </svg>
                  )}
                  <span className="px-2">{s.primaryLabel}</span>
                </button>
                {s.moreInfo && (
                  <button
                    type="button"
                    onClick={() => handleMoreInfoClick(s)}
                    className="relative top-0 inline-flex items-center justify-center gap-2 text-nowrap rounded-full border py-0.5 text-xs font-semibold uppercase leading-tight tracking-widest transition-all duration-300 ease-out cursor-pointer active:top-0.5 h-10 px-3 md:h-12 md:px-5 min-w-36 border-white/20 bg-white/10 text-white lg:hover:border-transparent lg:hover:bg-white/20 lg:hover:text-white active:border-transparent active:bg-white/20"
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
                    <span className="px-2">More Info</span>
                  </button>
                )}
              </div>
            </div>

            {/* Mobile content — bottom-left */}
            <div
              className="absolute sm:hidden left-0 right-0 flex flex-col items-start px-5"
              style={{ bottom: 44 }}
            >
              {s.badge && (
                <span
                  className="inline-flex items-center mb-2 text-white font-semibold"
                  style={{
                    fontFamily: APPLE_FONT,
                    fontSize: 9,
                    padding: '2px 8px',
                    borderRadius: 20,
                    background: 'rgba(255,255,255,0.15)',
                  }}
                >
                  {s.badge}
                </span>
              )}

              {s.logoSrc ? (
                <div className="mb-2">
                  <Image
                    src={s.logoSrc}
                    alt={s.logoAlt}
                    width={216}
                    height={81}
                    className="object-contain object-left"
                    style={{ maxHeight: 42, height: 'auto' }}
                  />
                </div>
              ) : (
                <h1
                  className="text-white font-bold text-sm leading-tight mb-2"
                  style={{ fontFamily: APPLE_FONT }}
                >
                  {s.title}
                </h1>
              )}

              {(s.metadata ?? s.rating) && (
                <div className="flex items-center gap-1.5 mb-2.5">
                  {s.metadata && (
                    <span className="text-white/70" style={{ fontFamily: APPLE_FONT, fontSize: 10 }}>
                      {s.metadata}
                    </span>
                  )}
                  {s.rating && (
                    <span
                      className="text-white/70 font-medium"
                      style={{
                        fontFamily: APPLE_FONT,
                        fontSize: 9,
                        border: '1px solid rgba(255,255,255,0.4)',
                        borderRadius: 2,
                        padding: '0px 4px',
                      }}
                    >
                      {s.rating.replace('_', '-').toUpperCase()}
                    </span>
                  )}
                </div>
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handlePrimaryClick(s)}
                  className="relative top-0 inline-flex items-center justify-center gap-1 text-nowrap rounded-full border py-0.5 text-[10px] sm:text-xs font-semibold uppercase tracking-widest transition-all duration-300 ease-out cursor-pointer active:top-0.5 h-9 px-2.5 sm:h-10 sm:px-3 md:h-12 md:px-5 min-w-28 sm:min-w-32 md:min-w-36 border-transparent bg-white text-black lg:hover:bg-white/80 active:bg-white/70"
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
                      className="w-3 h-3 sm:w-3.5 sm:h-3.5"
                      viewBox="0 0 12 12"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M2 1.5a.5.5 0 0 1 .765-.424l8 4.5a.5.5 0 0 1 0 .848l-8 4.5A.5.5 0 0 1 2 10.5z" />
                    </svg>
                  )}
                  <span className="px-2">{s.primaryLabel}</span>
                </button>

                {s.moreInfo && (
                  <button
                    type="button"
                    onClick={() => handleMoreInfoClick(s)}
                    className="relative top-0 inline-flex items-center justify-center gap-1 text-nowrap rounded-full border py-0.5 text-[10px] sm:text-xs font-semibold uppercase tracking-widest transition-all duration-300 ease-out cursor-pointer active:top-0.5 h-9 px-2.5 sm:h-10 sm:px-3 md:h-12 md:px-5 min-w-28 sm:min-w-32 md:min-w-36 border-white/20 bg-white/10 text-white lg:hover:border-transparent lg:hover:bg-white/20 lg:hover:text-white active:border-transparent active:bg-white/20"
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
                    <span className="px-2">More Info</span>
                  </button>
                )}
              </div>
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
