// MovieBox mobile-BFF client — a faithful CommonJS port of the Android app's
// data/MovieBoxSign.kt + data/MovieBoxRepository.kt. Runs in Electron's MAIN
// process (Node), directly from the user's residential IP — no proxy, no
// Cloudflare/Netlify, no CORS. Search is unfiltered (returns DMCA-delisted
// titles); play-info returns an adaptive DASH .mpd + a CloudFront signCookie.
//
// Mirrors the proven signing in netlify/lib/moviebox.mjs.

const { createHash, createHmac, randomBytes, randomUUID } = require('node:crypto');

const BASE = 'https://api.inmoviebox.com';
const P_HOME = '/wefeed-mobile-bff/tab-operating';
const P_SEARCH = '/wefeed-mobile-bff/subject-api/search';
const P_PLAY = '/wefeed-mobile-bff/subject-api/play-info';
const P_SEASON = '/wefeed-mobile-bff/subject-api/season-info';
const P_RESOURCE = '/wefeed-mobile-bff/subject-api/resource';
const P_CAPTIONS = '/wefeed-mobile-bff/subject-api/get-ext-captions';

// HMAC key for x-tr-signature (base64 alphabet, decoded to bytes before use).
// Can rotate server-side; override via MOVIEBOX_SECRET_KEY if search starts 407ing.
const SECRET_KEY =
  process.env.MOVIEBOX_SECRET_KEY?.trim() || '76iRl07s0xSN9jqmEWAt79EBJZulIQIsV64FZr2O';
const BODY_MAX_BYTES = 102_400;
const PER_PAGE = 20; // BFF caps perPage at 20 (400 LIMIT_EXCEED "Up to 20" above it)

const USER_AGENT =
  'com.community.oneroom/50020044 (Linux; U; Android 13; en_US; 23078RKD5C; Build/TQ2A.230405.003; Cronet/135.0.7012.3)';
const APP_VERSION = '3.0.03.0529.03';

let runtimeToken = null;

// --- signing ----------------------------------------------------------------

function md5Hex(buf) {
  return createHash('md5').update(buf).digest('hex');
}

/** X-Client-Token = "<ts>,<md5(reverse(<ts>))>" */
function clientToken(ts) {
  const s = String(ts);
  return `${s},${md5Hex(Buffer.from([...s].reverse().join(''), 'utf8'))}`;
}

/**
 * x-tr-signature = "<ts>|2|<base64(HMAC-MD5(canonical, key))>".
 * canonical = METHOD\nAccept\nContentType\nbodyLen\nts\nbodyHash\ncanonicalUrl
 *  - GET: body null -> bodyLen/bodyHash empty; canonicalUrl = "<path>?<sortedQuery>"
 *    (query keys sorted, values NOT url-encoded).
 *  - POST (search): canonicalUrl = "<path>" (no query); bodyHash = md5hex(body bytes).
 */
function signature(method, path, sortedQuery, body, ts) {
  const canonicalUrl = sortedQuery ? `${path}?${sortedQuery}` : path;
  const bodyBytes = body == null ? null : Buffer.from(body, 'utf8');
  const bodyLen = bodyBytes ? String(bodyBytes.length) : '';
  const bodyHash = bodyBytes
    ? md5Hex(bodyBytes.subarray(0, Math.min(bodyBytes.length, BODY_MAX_BYTES)))
    : '';
  const canonical = [
    method.toUpperCase(),
    'application/json',
    'application/json',
    bodyLen,
    String(ts),
    bodyHash,
    canonicalUrl,
  ].join('\n');
  const mac = createHmac('md5', Buffer.from(SECRET_KEY, 'base64'))
    .update(canonical, 'utf8')
    .digest('base64');
  return `${ts}|2|${mac}`;
}

/** Per-request device fingerprint, mirroring the Android app payload. */
function clientInfo() {
  const deviceId = randomBytes(16).toString('hex');
  const gaid = randomUUID();
  return (
    `{"package_name":"com.community.oneroom","version_name":"${APP_VERSION}",` +
    `"version_code":50020044,"os":"android","os_version":"13","install_ch":"ps",` +
    `"device_id":"${deviceId}","install_store":"ps","gaid":"${gaid}","brand":"Redmi",` +
    `"model":"23078RKD5C","system_language":"en","net":"NETWORK_WIFI","region":"US",` +
    `"timezone":"America/New_York","sp_code":"40401","X-Play-Mode":"2"}`
  );
}

function commonHeaders(ts, sig) {
  const h = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    Connection: 'keep-alive',
    'User-Agent': USER_AGENT,
    'X-Client-Info': clientInfo(),
    'X-Client-Status': '0',
    'X-Client-Token': clientToken(ts),
    'x-tr-signature': sig,
    'X-Play-Mode': '2',
  };
  // No Authorization until a runtime token is absorbed — a stale bearer makes
  // the gateway 401 "signature is invalid" before it ever checks the signature.
  if (runtimeToken) h.Authorization = `Bearer ${runtimeToken}`;
  return h;
}

/** Pull the runtime bearer token out of an `x-user` response header, if present. */
function absorbToken(res) {
  const raw = res.headers.get('x-user');
  if (!raw) return;
  try {
    const t = JSON.parse(raw).token;
    if (t) runtimeToken = t;
  } catch {
    /* ignore */
  }
}

// --- requests ---------------------------------------------------------------

async function signedGet(path, params) {
  const ts = Date.now();
  const sortedQuery = [...params]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
  const query = params.map(([k, v]) => `${k}=${v}`).join('&');
  const sig = signature('GET', path, sortedQuery, null, ts);
  const res = await fetch(`${BASE}${path}?${query}`, { headers: commonHeaders(ts, sig) });
  absorbToken(res);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${await safeText(res)}`);
  return res.json();
}

async function safeText(res) {
  try {
    return (await res.text()).slice(0, 200);
  } catch {
    return '';
  }
}

/** Acquire a runtime bearer token from a GET endpoint before POSTing search. */
async function ensureToken() {
  if (runtimeToken) return;
  await signedGet(P_HOME, [
    ['tabId', '0'],
    ['page', '1'],
    ['version', APP_VERSION],
  ]);
}

// --- public API -------------------------------------------------------------

const cleanTitle = (t) => t.replace(/\s*\[[^\]]*]\s*$/, '').trim();
const isOriginal = (corner) => !corner || corner.toLowerCase() === 'original';

/**
 * Search movies + series. Drops trailers/music and resource-less hits, then
 * folds audio variants (Original / Hindi / Tamil …) of the same title into one
 * card — exactly like the Android app's groupVariants().
 */
async function search(keyword, page = 1) {
  await ensureToken();
  const body = JSON.stringify({ keyword: keyword.trim(), page, perPage: PER_PAGE, subjectType: 0 });
  const ts = Date.now();
  const sig = signature('POST', P_SEARCH, '', body, ts);
  // Send the body as bytes with an explicit bare "application/json" header.
  // A "; charset=utf-8" suffix (which string bodies add) breaks the signature
  // the BFF recomputes -> 407 "Signature invalid".
  const res = await fetch(`${BASE}${P_SEARCH}`, {
    method: 'POST',
    headers: commonHeaders(ts, sig),
    body: Buffer.from(body, 'utf8'),
  });
  absorbToken(res);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${await safeText(res)}`);
  const data = (await res.json()).data || {};
  const items = (data.items || []).filter(
    (it) =>
      (it.subjectType === 1 || it.subjectType === 2) &&
      it.subjectId &&
      it.subjectId.trim() &&
      it.hasResource,
  );
  return groupVariants(items).map(toCard);
}

/** Fold audio variants of the same title into one group (order preserved). */
function groupVariants(items) {
  const groups = new Map();
  for (const it of items) {
    const year = (it.releaseDate || '').slice(0, 4);
    const base = cleanTitle(it.title).toLowerCase();
    const key = `${it.subjectType}|${year}|${base}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(it);
  }
  return [...groups.values()].map((variants) => {
    // Prefer the original (un-badged) variant as the default; list all of them
    // (primary first) for the player's Audio menu, like the Android app.
    const primary = variants.find((v) => isOriginal(v.corner)) || variants[0];
    const ordered = [primary, ...variants.filter((v) => v.subjectId !== primary.subjectId)];
    return { primary, variants: ordered };
  });
}

function toCard({ primary, variants }) {
  return {
    subjectId: primary.subjectId,
    subjectType: primary.subjectType,
    isSeries: primary.subjectType === 2,
    title: cleanTitle(primary.title),
    year: (primary.releaseDate || '').slice(0, 4),
    posterUrl: primary.cover?.url || null,
    rating: primary.imdbRatingValue ? Number.parseFloat(primary.imdbRatingValue) || null : null,
    duration: primary.duration || '',
    variantLabel: primary.corner || 'Original',
    // Audio/language variants for the in-player Audio menu.
    variants: variants.map((v) => ({ id: v.subjectId, label: v.corner || 'Original' })),
  };
}

// --- home feed (tab-operating verticals) -------------------------------------
//
// The mobile app's home screen is the `tab-operating` feed. `tabId` selects a
// vertical: tab 0 = main home (Trending / Hollywood / Bollywood / Cinema),
// tab 2 = Movies (New Release …), tab 8 = Anime (plus an "Animated Film" row).
// We map the desktop's six categories onto those rows — 100% MovieBox, no TMDB.
// The feed doesn't paginate, so each category returns its whole (deduped) pool
// and the renderer reveals it progressively (carousel → see-all grid on scroll).

const HOME_CATEGORIES = [
  { key: 'latest', label: 'Latest', tab: '2', match: ['New Release', 'Trending in Cinema', 'Top 20 Movies'] },
  { key: 'trending', label: 'Trending', tab: '0', match: ['Trending', 'Cinema'] },
  // tab 5 = the TV-series vertical; take every row (all series) but drop the
  // anime one so it stays distinct from the Anime category below.
  { key: 'series', label: 'Top Series', tab: '5', match: ['*'], exclude: ['Anime'] },
  { key: 'hollywood', label: 'Hollywood', tab: '0', match: ['Hollywood'] },
  { key: 'bollywood', label: 'Bollywood', tab: '0', match: ['Bollywood'] },
  { key: 'anime', label: 'Anime', tab: '8', match: ['*'], exclude: ['Animated'] },
  { key: 'animated', label: 'Animated', tab: '8', match: ['Animated'] },
];

/** Home subjects carry `seconds`, not the `duration` string search hits use. */
function secToDuration(sec) {
  const n = Number(sec);
  if (!Number.isFinite(n) || n <= 0) return '';
  const h = Math.floor(n / 3600);
  const m = Math.round((n % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}

const includesCI = (hay, needle) => hay.toLowerCase().includes(needle.toLowerCase());

/** SUBJECTS_MOVIE rows of one vertical tab; subjects filtered to playable + normalized. */
async function homeRows(tabId) {
  const data =
    (await signedGet(P_HOME, [
      ['tabId', tabId],
      ['page', '1'],
      ['version', APP_VERSION],
    ])).data || {};
  return (data.items || [])
    .filter((r) => r.type === 'SUBJECTS_MOVIE' && (r.subjects || []).length)
    .map((r) => ({
      title: r.title || '',
      subjects: (r.subjects || [])
        .filter(
          (s) =>
            (s.subjectType === 1 || s.subjectType === 2) &&
            s.subjectId &&
            s.subjectId.trim() &&
            s.hasResource &&
            s.cover?.url,
        )
        // Normalize so the shared groupVariants()/toCard() (built for search
        // hits) read the same fields — home subjects lack `duration`.
        .map((s) => ({ ...s, duration: s.duration || secToDuration(s.seconds) })),
    }));
}

/**
 * Build the desktop home screen: the mobile app's curated sections minus the
 * hero, sourced purely from MovieBox. Returns one entry per category with its
 * full deduped card pool. Cards are identical in shape to search cards, so the
 * player/detail path is unchanged.
 */
async function home() {
  await ensureToken();
  const tabs = [...new Set(HOME_CATEGORIES.map((c) => c.tab))];
  const rowsByTab = {};
  await Promise.all(
    tabs.map(async (t) => {
      rowsByTab[t] = await homeRows(t).catch(() => []);
    }),
  );
  return HOME_CATEGORIES.map((spec) => {
    const rows = rowsByTab[spec.tab] || [];
    const matched = rows.filter((r) => {
      if (spec.exclude?.some((x) => includesCI(r.title, x))) return false;
      return spec.match.includes('*') || spec.match.some((x) => includesCI(r.title, x));
    });
    const subjects = matched.flatMap((r) => r.subjects);
    // Fold audio variants + dedupe across rows, then shape like a search card.
    const cards = groupVariants(subjects).map(toCard);
    return { key: spec.key, label: spec.label, cards };
  }).filter((c) => c.cards.length);
}

/** Seasons (with episode counts) for a series — `[{ se, maxEp }]`. */
async function seasons(subjectId) {
  const data =
    (await signedGet(P_SEASON, [['subjectId', subjectId]])).data || {};
  return (data.seasons || [])
    .map((s) => ({ se: s.se || 0, maxEp: s.maxEp || 0 }))
    .filter((s) => s.maxEp > 0);
}

/**
 * Resolve an adaptive DASH stream for a subject at a specific season/episode.
 * Movies use se=0/ep=0. Returns { url, signCookie, format, resolutions:[..],
 * title, se, ep } or null.
 */
async function playInfo(subjectId, se = 0, ep = 0) {
  const data =
    (await signedGet(P_PLAY, [
      ['subjectId', subjectId],
      ['se', String(se)],
      ['ep', String(ep)],
    ])).data || {};
  const stream = (data.streams || []).find((s) => s.url && s.url.trim());
  if (!stream) return null;
  const resolutions = (stream.resolutions || '')
    .split(',')
    .map((r) => Number.parseInt(r, 10))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => b - a);
  return {
    url: stream.url,
    signCookie: stream.signCookie || '',
    format: (stream.format || 'DASH').toUpperCase(),
    resolutions,
    title: data.title || '',
    se,
    ep,
  };
}

/** Sideloadable subtitle tracks for an episode (best-effort), like the app. */
async function captions(subjectId, se, ep) {
  const resourceId = await resolveResourceId(subjectId, se, ep).catch(() => null);
  if (!resourceId) return [];
  try {
    const data =
      (await signedGet(P_CAPTIONS, [
        ['subjectId', subjectId],
        ['resourceId', resourceId],
      ])).data || {};
    return (data.extCaptions || [])
      .filter((c) => c.url && c.url.trim())
      .map((c) => ({ id: c.id || '', lan: c.lan || '', lanName: c.lanName || c.lan || '', url: c.url }));
  } catch {
    return [];
  }
}

/** Walk the (paginated) resource list to find a resourceId for this se/ep. */
async function resolveResourceId(subjectId, se, ep) {
  let page = 1;
  for (let i = 0; i < 6; i++) {
    const data =
      (await signedGet(P_RESOURCE, [
        ['subjectId', subjectId],
        ['se', String(se)],
        ['ep', String(ep)],
        ['page', String(page)],
        ['perPage', '20'],
      ])).data || {};
    const list = data.list || [];
    const hit = se === 0 ? list[0] : list.find((r) => r.se === se && r.ep === ep);
    if (hit && hit.resourceId) return hit.resourceId;
    if (!data.pager || data.pager.hasMore !== true) return null;
    page++;
  }
  return null;
}

/** Fetch a signed .srt and convert it to WebVTT (browsers parse VTT natively). */
async function captionVtt(url) {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const srt = await res.text();
  return (
    'WEBVTT\n\n' +
    srt
      .replace(/\r+/g, '')
      .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')
  );
}

module.exports = { search, home, seasons, playInfo, captions, captionVtt, USER_AGENT };
