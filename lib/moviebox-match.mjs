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

  if (!best) return null;
  // Exact normalized-title equality is strong evidence on its own — rescue it
  // even when secondary signals (year/duration/rating) are missing or weak, so
  // valid titles with sparse MovieBox metadata aren't excluded. Substring-only
  // matches (titleScore < 1, e.g. "Inception: The Cobol Job") keep the full bar,
  // and a hard year contradiction (wrong-year remake) is never rescued.
  const exactTitle = best.titleScore >= 1;
  const yearContradicts =
    tmdb.year != null && best.item.releaseDate != null && best.yearScore === 0;
  const effectiveMin = exactTitle && !yearContradicts ? Math.min(minScore, 0.5) : minScore;
  if (best.score < effectiveMin) return null;
  return best;
}

// Source/quality tags that appear in MovieBox bracket suffixes but are NOT a
// dub language. Anything else inside [...] is treated as the audio language.
const QUALITY_TAG =
  /^(cam|hd|hq|sd|hdr|4k|uhd|web-?dl|web-?rip|blu-?ray|dvd(?:rip)?|hd-?rip|hd-?cam|ts|tc|x264|x265|hevc|\d{3,4}p)$/i;

/**
 * Detect the audio language of a MovieBox item from its bracketed suffix.
 * "Inception [Hindi]" → "Hindi"; "Inception" / "Inception[CAM]_1080P" → "Original".
 * @param {MovieboxItem} item
 */
export function detectMovieboxLanguage(item) {
  const raw = `${item?.title ?? ''} ${item?.postTitle ?? ''}`;
  for (const m of raw.matchAll(/\[([^\]]+)\]/g)) {
    const tag = m[1].trim().replace(/\s+/g, ' ');
    if (tag && !QUALITY_TAG.test(tag)) return tag;
  }
  return 'Original';
}

function scoreItem(tmdb, item) {
  return (
    titleMatchScore(tmdb.title, item.title, item.postTitle ?? '') * 0.5 +
    yearMatchScore(tmdb.year, item.releaseDate) * 0.2 +
    durationMatchScore(tmdb.runtime, item.duration) * 0.15 +
    ratingMatchScore(tmdb.vote_average, item.imdbRatingValue) * 0.15
  );
}

/**
 * Pick the same film across audio languages (Original + dubs). The anchor is the
 * single best match; siblings are accepted only on EXACT normalized-title
 * equality to the anchor or the TMDB title (so "Inception" groups its
 * [Hindi]/[Tamil]/[Telugu] dubs but never "Inception: The Cobol Job"), with a
 * year-sanity guard. Returns at most `maxVariants` entries, Original first then
 * a preferred dub order, each as { item, score, language, isOriginal }.
 * @param {TmdbRef} tmdb
 * @param {MovieboxItem[]} items
 * @param {{ minScore?: number, minTitle?: number, maxVariants?: number }} [opts]
 */
export function pickMovieboxVariants(tmdb, items, opts = {}) {
  const anchor = pickBestMovieboxMatch(tmdb, items, opts);
  if (!anchor) return [];

  const anchorNorm = normalizeTitle(anchor.item.title);
  const tmdbNorm = normalizeTitle(tmdb.title);
  const byLang = new Map();

  for (const item of items) {
    if (!item?.hasResource) continue;
    if (tmdb.type === 'tv' && item.subjectType === 1) continue;
    if (tmdb.type === 'movie' && item.subjectType === 2) continue;

    const norm = normalizeTitle(item.title);
    if (norm !== anchorNorm && norm !== tmdbNorm) continue;
    // Year sanity: drop only hard contradictions (both years known, >1yr apart).
    if (tmdb.year != null && item.releaseDate && yearMatchScore(tmdb.year, item.releaseDate) === 0)
      continue;

    const language = detectMovieboxLanguage(item);
    const score = scoreItem(tmdb, item);
    const prev = byLang.get(language);
    if (!prev || score > prev.score) {
      byLang.set(language, { item, score, language, isOriginal: language === 'Original' });
    }
  }

  // The anchor always wins its language slot even if a sibling scored higher.
  const anchorLang = detectMovieboxLanguage(anchor.item);
  byLang.set(anchorLang, {
    item: anchor.item,
    score: anchor.score,
    language: anchorLang,
    isOriginal: anchorLang === 'Original',
  });

  const PREF = ['hindi', 'english', 'tamil', 'telugu'];
  const out = [...byLang.values()].sort((a, b) => {
    if (a.isOriginal !== b.isOriginal) return a.isOriginal ? -1 : 1;
    const ra = PREF.indexOf(a.language.toLowerCase());
    const rb = PREF.indexOf(b.language.toLowerCase());
    const pa = ra === -1 ? PREF.length : ra;
    const pb = rb === -1 ? PREF.length : rb;
    if (pa !== pb) return pa - pb;
    return b.score - a.score;
  });

  return out.slice(0, opts.maxVariants ?? 4);
}
