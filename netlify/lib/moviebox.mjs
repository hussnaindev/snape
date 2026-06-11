// MovieBox fetch + TMDB-validated match. Used by extract.mjs (primary source).
import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto';
import { ProxyAgent, fetch as uFetch } from 'undici';
import { pickBestMovieboxMatch, pickMovieboxVariants } from '../../lib/moviebox-match.mjs';

const H5_API = 'https://h5-api.aoneroom.com/wefeed-h5api-bff';
const SITE = 'https://movie-box.co';
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36';
const CLIENT_INFO = '{"timezone":"Asia/Karachi"}';
export const MOVIEBOX_CDN_HEADERS = { referer: `${SITE}/`, 'user-agent': UA };

// --- Mobile (app) BFF -------------------------------------------------------
// The web /wefeed-h5api-bff/subject/search index DELISTS certain titles
// (Inception, Interstellar, The Dark Knight, …) for DMCA/licensing reasons:
// it returns totalCount > 0 but filters the subject itself out of `items`.
// The native app hits a different, UNFILTERED backend (wefeed-mobile-bff) that
// requires a signed request. We resolve the subjectId here, then reuse the
// proven web play/captions flow below.
const MOBILE_API = 'https://api.inmoviebox.com/wefeed-mobile-bff';
const MOBILE_SEARCH_PATH = '/wefeed-mobile-bff/subject-api/search';
// HMAC key for x-tr-signature (base64 alphabet, decoded to bytes before use).
const MOBILE_SECRET_KEY =
  process.env.MOVIEBOX_SECRET_KEY?.trim() || '76iRl07s0xSN9jqmEWAt79EBJZulIQIsV64FZr2O';
const SIGNATURE_BODY_MAX_BYTES = 102_400;

function md5Hex(buf) {
  return createHash('md5').update(buf).digest('hex');
}

function b64DecodeKey(value) {
  return Buffer.from(value, 'base64');
}

/** token = "<ts>,<md5(reverse(<ts>))>" */
function xClientToken(ts) {
  const s = String(ts);
  return `${s},${md5Hex(Buffer.from([...s].reverse().join(''), 'utf8'))}`;
}

/** x-tr-signature = "<ts>|2|<base64(hmac-md5(canonical, key))>" for a POST with JSON body. */
function xTrSignature(path, body, ts) {
  const bodyBytes = Buffer.from(body, 'utf8');
  const bodyHash = md5Hex(bodyBytes.subarray(0, SIGNATURE_BODY_MAX_BYTES));
  const canonical = [
    'POST',
    'application/json',
    'application/json',
    String(bodyBytes.length),
    String(ts),
    bodyHash,
    path, // no query string on the search POST
  ].join('\n');
  const mac = createHmac('md5', b64DecodeKey(MOBILE_SECRET_KEY))
    .update(canonical, 'utf8')
    .digest('base64');
  return `${ts}|2|${mac}`;
}

function mobileClientInfo() {
  const deviceId = randomBytes(16).toString('hex');
  const gaid = randomUUID();
  return `{"package_name":"com.community.oneroom","version_name":"3.0.03.0529.03","version_code":50020044,"os":"android","os_version":"13","install_ch":"ps","device_id":"${deviceId}","install_store":"ps","gaid":"${gaid}","brand":"Redmi","model":"23078RKD5C","system_language":"en","net":"NETWORK_WIFI","region":"US","timezone":"America/New_York","sp_code":"40401","X-Play-Mode":"2"}`;
}

const MOBILE_UA =
  'com.community.oneroom/50020044 (Linux; U; Android 13; en_US; 23078RKD5C; Build/TQ2A.230405.003; Cronet/135.0.7012.3)';

const AUTH_FALLBACK = {
  bearer:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOjE0NzcyODEwNzg1NDQ2OTEyMjQsImF0cCI6MywiZXh0IjoiMTc4MTEyMjUxNSIsImV4cCI6MTc4ODg5ODUxNSwiaWF0IjoxNzgxMTIyMjE1fQ.AHGiW26zLlTYHRWqQ4-CnE64WWoMHIaM2FvqAvGN3pA',
  mbToken:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOjE0NzcyODEwNzg1NDQ2OTEyMjQsImF0cCI6MywiZXh0IjoiMTc4MTEyMjUxNSIsImV4cCI6MTc4ODg5ODUxNSwiaWF0IjoxNzgxMTIyMjE1fQ.AHGiW26zLlTYHRWqQ4-CnE64WWoMHIaM2FvqAvGN3pA',
  token:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOjE0NzcyODEwNzg1NDQ2OTEyMjQsImF0cCI6MywiZXh0IjoiMTc4MTEyMjUxNSIsImV4cCI6MTc4ODg5ODUxNSwiaWF0IjoxNzgxMTIyMjE1fQ.AHGiW26zLlTYHRWqQ4-CnE64WWoMHIaM2FvqAvGN3pA',
};

function auth() {
  const bearer = process.env.MOVIEBOX_BEARER?.trim();
  const mbToken = (process.env.MOVIEBOX_MB_TOKEN ?? bearer)?.trim();
  const token = (process.env.MOVIEBOX_TOKEN ?? bearer)?.trim();
  if (bearer && mbToken && token) return { bearer, mbToken, token };
  return AUTH_FALLBACK;
}

function parseProxies() {
  const raw = process.env.PROXY_LIST ?? '';
  return raw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((entry) => {
      const [host, port, user, pass] = entry.split(':');
      if (!host || !port) return null;
      const a = user && pass ? `${encodeURIComponent(user)}:${encodeURIComponent(pass)}@` : '';
      return `http://${a}${host}:${port}`;
    })
    .filter(Boolean);
}

export function movieboxProxyCount() {
  return parseProxies().length;
}

function pickProxyAgent() {
  const proxies = parseProxies();
  if (proxies.length === 0) return undefined;
  return new ProxyAgent(proxies[Math.floor(Math.random() * proxies.length)]);
}

const ATTEMPT_TIMEOUT_MS = 8000;
const MAX_ATTEMPTS = 4;

async function proxyFetch(url, init = {}) {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), ATTEMPT_TIMEOUT_MS);
    try {
      const res = await uFetch(url, {
        ...init,
        signal: ac.signal,
        dispatcher: pickProxyAgent(),
      });
      if (res.status === 429 || res.status >= 500) {
        if (attempt < MAX_ATTEMPTS - 1) {
          await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
          continue;
        }
      }
      return res;
    } catch {
      if (attempt < MAX_ATTEMPTS - 1) {
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
        continue;
      }
      throw new Error('MovieBox upstream fetch failed');
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error('MovieBox upstream fetch failed');
}

function playCookie(a) {
  return `mb_token=%22${encodeURIComponent(a.mbToken)}%22; i18n_lang=en; token=${a.token}`;
}

/** @param {1 | 2} subjectType — 1 movie, 2 TV series */
async function webSearch(keyword, a, subjectType) {
  const res = await proxyFetch(`${H5_API}/subject/search`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${a.bearer}`,
      'content-type': 'application/json',
      origin: SITE,
      referer: `${SITE}/web/searchResult?keyword=${encodeURIComponent(keyword)}`,
      'user-agent': UA,
      'x-client-info': CLIENT_INFO,
      'x-request-lang': 'en',
    },
    body: JSON.stringify({ keyword, page: 1, perPage: 28, subjectType }),
  });
  if (!res.ok) throw new Error(`search HTTP ${res.status}`);
  const json = await res.json();
  if (json.code !== 0) throw new Error(`search API ${json.code}`);
  return json.data?.items ?? [];
}

/**
 * Signed search against the app's mobile BFF. Unfiltered — returns titles the
 * web index delists. NOTE: sent WITHOUT an Authorization bearer; including the
 * (possibly stale) token makes the gateway reject with 401 before the
 * signature is checked. Items are normalized to the same shape webSearch
 * returns (subjectId, detailPath, duration-in-seconds, …) so the matcher and
 * the web play/caption flow below work unchanged.
 * @param {1 | 2} subjectType
 */
async function mobileSearch(keyword, subjectType) {
  const body = JSON.stringify({ keyword, page: 1, perPage: 20, subjectType });
  const ts = Date.now();
  const res = await proxyFetch(`${MOBILE_API}/subject-api/search`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Connection: 'keep-alive',
      'Content-Type': 'application/json',
      'User-Agent': MOBILE_UA,
      'X-Client-Info': mobileClientInfo(),
      'X-Client-Status': '0',
      'X-Client-Token': xClientToken(ts),
      'x-tr-signature': xTrSignature(MOBILE_SEARCH_PATH, body, ts),
    },
    body,
  });
  if (!res.ok) throw new Error(`mobile search HTTP ${res.status}`);
  const json = await res.json();
  if (json.code !== 0) throw new Error(`mobile search API ${json.code}`);
  return (json.data?.items ?? []).map((it) => ({
    ...it,
    // detailUrl: "https://moviebox.ph/detail/<slug>" → web play needs the slug.
    detailPath:
      it.detailPath ??
      (it.detailUrl ? String(it.detailUrl).split('/').filter(Boolean).pop() : undefined),
    // Matcher expects duration in seconds (web uses `duration`; mobile splits it out).
    duration: typeof it.duration === 'number' ? it.duration : it.durationSeconds,
  }));
}

/**
 * Resolve search hits. Try the unfiltered mobile BFF first; on any failure
 * fall back to the legacy web index so a key rotation can't take extraction
 * fully offline.
 * @param {1 | 2} subjectType
 */
async function search(keyword, a, subjectType, debug) {
  try {
    const items = await mobileSearch(keyword, subjectType);
    if (items.length > 0) {
      if (debug) debug.searchSource = 'mobile';
      return items;
    }
  } catch (e) {
    if (debug) debug.mobileSearchError = e instanceof Error ? e.message : String(e);
  }
  if (debug) debug.searchSource = 'web';
  return webSearch(keyword, a, subjectType);
}

async function play(subjectId, detailPath, a, se, ep) {
  const url = new URL(`${SITE}/wefeed-h5api-bff/subject/play`);
  url.searchParams.set('subjectId', subjectId);
  url.searchParams.set('se', String(se));
  url.searchParams.set('ep', String(ep));
  url.searchParams.set('detailPath', detailPath);

  const res = await proxyFetch(url.toString(), {
    headers: {
      accept: 'application/json',
      cookie: playCookie(a),
      referer: `${SITE}/movies/${detailPath}?id=${subjectId}&type=/movie/detail&detailSe=&detailEp=&lang=en`,
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-origin',
      'user-agent': UA,
      'x-client-info': CLIENT_INFO,
      'x-source': '',
    },
  });
  if (!res.ok) throw new Error(`play HTTP ${res.status}`);
  const json = await res.json();
  if (json.code !== 0) throw new Error(`play API ${json.code}`);
  return json.data?.streams ?? [];
}

async function captions(streamId, subjectId, detailPath) {
  const url = new URL(`${H5_API}/subject/caption`);
  url.searchParams.set('format', 'MP4');
  url.searchParams.set('id', streamId);
  url.searchParams.set('subjectId', subjectId);
  url.searchParams.set('detailPath', detailPath);

  const res = await proxyFetch(url.toString(), {
    headers: {
      accept: 'application/json',
      origin: SITE,
      referer: `${SITE}/movies/${detailPath}?id=${subjectId}`,
      'user-agent': UA,
      'x-client-info': CLIENT_INFO,
    },
  });
  if (!res.ok) throw new Error(`caption HTTP ${res.status}`);
  const json = await res.json();
  if (json.code !== 0) throw new Error(`caption API ${json.code}`);
  return json.data?.captions ?? [];
}

export async function fetchTmdbRef(type, id, season, episode) {
  const key = process.env.TMDB_API_KEY?.trim();
  if (!key) return null;

  const base = 'https://api.themoviedb.org/3';
  try {
    if (type === 'movie') {
      const res = await fetch(`${base}/movie/${id}?api_key=${key}`);
      if (!res.ok) return null;
      const m = await res.json();
      return {
        type: 'movie',
        title: m.title,
        originalTitle: m.original_title && m.original_title !== m.title ? m.original_title : null,
        year: m.release_date ? Number.parseInt(m.release_date.slice(0, 4), 10) : null,
        runtime: m.runtime ?? null,
        vote_average: m.vote_average ?? null,
      };
    }

    const sRes = await fetch(`${base}/tv/${id}?api_key=${key}`);
    if (!sRes.ok) return null;
    const show = await sRes.json();
    let runtime = null;
    let vote = show.vote_average ?? null;
    let year = show.first_air_date ? Number.parseInt(show.first_air_date.slice(0, 4), 10) : null;

    if (season && episode) {
      const eRes = await fetch(
        `${base}/tv/${id}/season/${season}/episode/${episode}?api_key=${key}`,
      );
      if (eRes.ok) {
        const ep = await eRes.json();
        runtime = ep.runtime ?? null;
        if (ep.vote_average) vote = ep.vote_average;
        if (ep.air_date) year = Number.parseInt(ep.air_date.slice(0, 4), 10);
      }
    }

    return {
      type: 'tv',
      title: show.name,
      originalTitle:
        show.original_name && show.original_name !== show.name ? show.original_name : null,
      year,
      runtime,
      vote_average: vote,
    };
  } catch {
    return null;
  }
}

/**
 * Try MovieBox: search → validate against TMDB → play → captions.
 * Returns { sources, subtitles, debug } — empty sources if no confident match.
 */
export async function fetchMoviebox(type, id, season, episode) {
  const debug = { stage: 'init' };
  if (movieboxProxyCount() === 0) {
    debug.stage = 'no-proxy';
    return { sources: [], subtitles: [], debug };
  }

  const tmdb = await fetchTmdbRef(type, id, season, episode);
  if (!tmdb?.title) {
    debug.stage = 'no-tmdb';
    return { sources: [], subtitles: [], debug };
  }
  debug.tmdb = { title: tmdb.title, year: tmdb.year, runtime: tmdb.runtime };

  try {
    const a = auth();
    const subjectType = type === 'tv' ? 2 : 1;
    let items = await search(tmdb.title, a, subjectType, debug);
    debug.searchHits = items.length;
    debug.subjectType = subjectType;

    let match = pickBestMovieboxMatch(tmdb, items);
    if (!match && tmdb.originalTitle) {
      const altItems = await search(tmdb.originalTitle, a, subjectType, debug);
      debug.altSearchHits = altItems.length;
      match = pickBestMovieboxMatch(tmdb, altItems);
      if (match) items = altItems;
    }
    if (!match) {
      debug.stage = 'no-match';
      return { sources: [], subtitles: [], debug };
    }

    // Group the same film across audio languages (Original + Hindi/Tamil/…).
    const variants = pickMovieboxVariants(tmdb, items);
    debug.stage = 'matched';
    debug.variants = variants.map((v) => ({
      language: v.language,
      isOriginal: v.isOriginal,
      subjectId: v.item.subjectId,
      title: v.item.title,
      score: v.score,
    }));

    // MovieBox TV play uses 1-based se/ep (TMDB S1E1 → se=1, ep=1). Movies always se=0 ep=0.
    const tmdbSeason = Number.parseInt(String(season ?? '1'), 10) || 1;
    const tmdbEpisode = Number.parseInt(String(episode ?? '1'), 10) || 1;
    const se = type === 'tv' ? tmdbSeason : 0;
    const ep = type === 'tv' ? tmdbEpisode : 0;
    debug.play = { se, ep, tmdbSeason, tmdbEpisode };

    // Resolve every language variant in parallel; a failed dub just drops out.
    const played = await Promise.allSettled(
      variants.map((v) => play(v.item.subjectId, v.item.detailPath, a, se, ep)),
    );

    const sources = [];
    let captionAnchor = null; // prefer the Original track's captions
    played.forEach((res, i) => {
      if (res.status !== 'fulfilled' || res.value.length === 0) return;
      const v = variants[i];
      for (const s of res.value) {
        sources.push({
          type: 'mp4',
          url: s.url,
          headers: MOVIEBOX_CDN_HEADERS,
          quality: Number.parseInt(s.resolutions, 10) || null,
          dub: v.language,
          provider: 'MovieBox',
        });
      }
      if (!captionAnchor || v.isOriginal) captionAnchor = { streams: res.value, item: v.item };
    });

    if (sources.length === 0) {
      debug.stage = 'no-streams';
      return { sources: [], subtitles: [], debug };
    }

    // Order: Original first (variants[] is already Original-first), then quality desc.
    const langRank = new Map(variants.map((v, i) => [v.language, i]));
    sources.sort((x, y) => {
      const rx = langRank.get(x.dub) ?? 99;
      const ry = langRank.get(y.dub) ?? 99;
      if (rx !== ry) return rx - ry;
      return (y.quality ?? 0) - (x.quality ?? 0);
    });
    debug.streams = sources.length;

    let subtitles = [];
    if (captionAnchor) {
      const primary = captionAnchor.streams[0];
      const caps = await captions(
        primary.id,
        captionAnchor.item.subjectId,
        captionAnchor.item.detailPath,
      );
      subtitles = caps.map((c) => ({
        url: c.url,
        headers: MOVIEBOX_CDN_HEADERS,
        label: c.lanName,
        lang: c.lan,
      }));
    }

    return { sources, subtitles, debug };
  } catch (e) {
    debug.stage = 'error';
    debug.error = e instanceof Error ? e.message : String(e);
    return { sources: [], subtitles: [], debug };
  }
}
