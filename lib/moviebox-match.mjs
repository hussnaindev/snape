/**
 * Pure MovieBox ↔ TMDB matching (Node / Netlify safe, no TS).
 */

const STOP_WORDS = new Set(['the', 'a', 'an', 'and', 'or', 'of', 'in', 'on', 'at', 'to', 'for']);

/** @param {string} s */
export function normalizeTitle(s) {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[''`]/g, '')
    .replace(/\[[^\]]*]|\([^)]*\)/g, ' ')
    .replace(/\bs\d+\s*-\s*s\d+\b/gi, ' ')
    .replace(/\bs\d+\b/gi, ' ')
    .replace(/\{CAM\}|_1080p|_720p|_480p/gi, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** @param {string} s */
export function titleTokens(s) {
  return normalizeTitle(s)
    .split(' ')
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));
}

/**
 * @param {string} tmdbTitle
 * @param {string} mbTitle
 * @param {string} [postTitle]
 */
export function titleMatchScore(tmdbTitle, mbTitle, postTitle = '') {
  const tmdbNorm = normalizeTitle(tmdbTitle);
  const mbNorm = normalizeTitle(mbTitle);
  const postNorm = normalizeTitle(postTitle);

  if (!tmdbNorm || !mbNorm) return 0;

  if (mbNorm === tmdbNorm || postNorm === tmdbNorm) return 1;
  if (mbNorm.includes(tmdbNorm) || postNorm.includes(tmdbNorm)) return 0.95;
  if (tmdbNorm.includes(mbNorm) && mbNorm.length >= 4) return 0.8;

  const tTokens = titleTokens(tmdbTitle);
  if (tTokens.length === 0) return 0;

  const mbSet = new Set([...titleTokens(mbTitle), ...titleTokens(postTitle)]);
  let matched = 0;
  for (const t of tTokens) {
    if (mbSet.has(t)) matched++;
    else if ([...mbSet].some((m) => m.includes(t) || t.includes(m))) matched += 0.85;
  }
  return matched / tTokens.length;
}

/**
 * @param {number | string | null | undefined} tmdbYear
 * @param {string | null | undefined} releaseDate
 */
export function yearMatchScore(tmdbYear, releaseDate) {
  const y = Number.parseInt(String(tmdbYear ?? ''), 10);
  const mbY = Number.parseInt(String(releaseDate ?? '').slice(0, 4), 10);
  if (!Number.isFinite(y) || !Number.isFinite(mbY)) return 0.5;
  const diff = Math.abs(y - mbY);
  if (diff === 0) return 1;
  if (diff === 1) return 0.7;
  return 0;
}

/**
 * @param {number | null | undefined} tmdbRuntimeMin
 * @param {number | null | undefined} mbDurationSec
 */
export function durationMatchScore(tmdbRuntimeMin, mbDurationSec) {
  const tmdb = Number(tmdbRuntimeMin);
  const mbMin = Number(mbDurationSec) / 60;
  if (!Number.isFinite(tmdb) || tmdb <= 0 || !Number.isFinite(mbMin) || mbMin <= 0) return 0.5;
  const diff = Math.abs(tmdb - mbMin);
  if (diff <= 10) return 1;
  if (diff <= 20) return 0.7;
  if (diff <= 35) return 0.4;
  return 0;
}

/**
 * @param {number | null | undefined} tmdbVote
 * @param {string | number | null | undefined} mbImdbRating
 */
export function ratingMatchScore(tmdbVote, mbImdbRating) {
  const tmdb = Number(tmdbVote);
  const mb = Number.parseFloat(String(mbImdbRating ?? ''));
  if (!Number.isFinite(tmdb) || tmdb <= 0 || !Number.isFinite(mb)) return 0.5;
  const diff = Math.abs(tmdb - mb);
  if (diff <= 0.4) return 1;
  if (diff <= 0.8) return 0.75;
  if (diff <= 1.2) return 0.45;
  return 0;
}

/**
 * @typedef {object} TmdbRef
 * @property {string} title
 * @property {number | null} [year]
 * @property {number | null} [runtime]
 * @property {number | null} [vote_average]
 * @property {'movie' | 'tv'} [type]
 */

/**
 * @typedef {object} MovieboxItem
 * @property {string} title
 * @property {string} [postTitle]
 * @property {string} [releaseDate]
 * @property {number} [duration]
 * @property {string | number} [imdbRatingValue]
 * @property {boolean} [hasResource]
 * @property {number} [subjectType]
 */

/**
 * Score and pick the best MovieBox search hit for a TMDB title.
 * @param {TmdbRef} tmdb
 * @param {MovieboxItem[]} items
 * @param {{ minScore?: number, minTitle?: number }} [opts]
 */
export function pickBestMovieboxMatch(tmdb, items, opts = {}) {
  const minScore = opts.minScore ?? 0.62;
  const minTitle = opts.minTitle ?? 0.55;
  let best = null;
  let bestScore = 0;

  for (const item of items) {
    if (!item?.hasResource) continue;

    const titleScore = titleMatchScore(tmdb.title, item.title, item.postTitle ?? '');
    if (titleScore < minTitle) continue;

    const postNorm = normalizeTitle(item.postTitle ?? '');
    const tmdbNorm = normalizeTitle(tmdb.title);
    if (postNorm && tmdbNorm && !postNorm.includes(tmdbNorm) && titleScore < 0.9) {
      const postTitleScore = titleMatchScore(tmdb.title, item.postTitle ?? '', '');
      if (postTitleScore < 0.5) continue;
    }

    if (tmdb.type === 'tv' && item.subjectType === 1) continue;
    if (tmdb.type === 'movie' && item.subjectType === 2) continue;

    const yearScore = yearMatchScore(tmdb.year, item.releaseDate);
    const durationScore = durationMatchScore(tmdb.runtime, item.duration);
    const ratingScore = ratingMatchScore(tmdb.vote_average, item.imdbRatingValue);

    const total = titleScore * 0.5 + yearScore * 0.2 + durationScore * 0.15 + ratingScore * 0.15;

    if (total > bestScore) {
      bestScore = total;
      best = { item, score: total, titleScore, yearScore, durationScore, ratingScore };
    }
  }

  if (!best || best.score < minScore) return null;
  return best;
}
