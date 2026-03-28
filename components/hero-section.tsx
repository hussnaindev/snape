'use client';

import { tmdbImage } from '@/lib/tmdb-image';
import type { TMDBMovie } from '@/types/tmdb';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { RatingBadge } from './ui/rating-badge';

interface HeroSectionProps {
  movies: TMDBMovie[];
}

export function HeroSection({ movies }: HeroSectionProps) {
  const [active, setActive] = useState(0);
  const [fading, setFading] = useState(false);
  const featured = movies.slice(0, 5);

  function goTo(index: number) {
    if (index === active) return;
    setFading(true);
    setTimeout(() => {
      setActive(index);
      setFading(false);
    }, 300);
  }

  // Auto-cycle every 7s
  useEffect(() => {
    const id = setInterval(() => {
      setFading(true);
      setTimeout(() => {
        setActive((prev) => (prev + 1) % featured.length);
        setFading(false);
      }, 300);
    }, 7000);
    return () => clearInterval(id);
  }, [featured.length]);

  const movie = featured[active];
  if (!movie) return null;

  const backdrop = tmdbImage(movie.backdrop_path, 'original');
  const poster = tmdbImage(movie.poster_path, 'w500');
  const year = movie.release_date?.slice(0, 4) ?? '';

  return (
    <div className="relative h-[80vh] min-h-[480px] overflow-hidden">
      {/* Backdrop / Poster */}
      <div
        className="absolute inset-0 transition-opacity duration-300"
        style={{ opacity: fading ? 0 : 1 }}
      >
        {/* Mobile: poster (portrait) */}
        {(poster || backdrop) && (
          <Image
            src={poster || backdrop!}
            alt={movie.title}
            fill
            priority
            sizes="100vw"
            className="object-cover object-top sm:hidden"
          />
        )}
        {/* Desktop: backdrop (landscape) */}
        {(backdrop || poster) && (
          <Image
            src={backdrop || poster!}
            alt={movie.title}
            fill
            priority
            sizes="100vw"
            className="object-cover hidden sm:block"
          />
        )}

        {!backdrop && !poster && <div className="absolute inset-0 bg-white/5" />}

        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent" />
      </div>

      {/* Content */}
      <div
        className="absolute bottom-0 left-0 right-0 p-6 md:p-12 pb-20 transition-opacity duration-300"
        style={{ opacity: fading ? 0 : 1 }}
      >
        <div className="max-w-xl">
          <h1 className="font-display text-4xl md:text-6xl font-semibold text-white leading-tight">
            {movie.title}
          </h1>
          <div className="flex items-center gap-3 mt-3">
            {year && <span className="text-white/60 text-sm">{year}</span>}
            {movie.vote_average > 0 && <RatingBadge rating={movie.vote_average} />}
          </div>
          {movie.overview && (
            <p className="mt-3 text-white/70 text-sm leading-relaxed line-clamp-3 max-w-md">
              {movie.overview}
            </p>
          )}
          <div className="flex gap-3 mt-5">
            <Link
              href={`/movie/${movie.id}`}
              className="inline-flex items-center gap-2 bg-sage text-black font-semibold text-sm px-5 py-2.5 rounded-full hover:bg-sage/90 transition-colors"
            >
              <span>▶</span> Watch
            </Link>
            <Link
              href={`/movie/${movie.id}`}
              className="inline-flex items-center gap-2 bg-white/10 text-white font-semibold text-sm px-5 py-2.5 rounded-full border border-white/20 hover:bg-white/20 transition-colors"
            >
              More Info
            </Link>
          </div>
        </div>
      </div>

      {/* Dot indicators */}
      <div className="absolute bottom-6 right-6 flex gap-2">
        {featured.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => goTo(i)}
            aria-label={`Go to slide ${i + 1}`}
            className={`w-2 h-2 rounded-full transition-all ${
              i === active ? 'bg-sage w-6' : 'bg-white/30 hover:bg-white/60'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
