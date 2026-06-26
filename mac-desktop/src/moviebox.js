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
    const primary = variants.find((v) => isOriginal(v.corner)) || variants[0];
    return primary;
  });
}

function toCard(it) {
  return {
    subjectId: it.subjectId,
    subjectType: it.subjectType,
    isSeries: it.subjectType === 2,
    title: cleanTitle(it.title),
    year: (it.releaseDate || '').slice(0, 4),
    posterUrl: it.cover?.url || null,
    rating: it.imdbRatingValue ? Number.parseFloat(it.imdbRatingValue) || null : null,
    duration: it.duration || '',
    variantLabel: it.corner || 'Original',
  };
}

/**
 * Resolve an adaptive DASH stream for a card. Movies use se=0/ep=0; series start
 * at se=1/ep=1 ("simply play that video"), with a fallback to the other shape.
 * Returns { url, signCookie, format, resolutions } or null.
 */
async function playInfo(subjectId, isSeries) {
  const attempts = isSeries
    ? [
        [1, 1],
        [0, 0],
      ]
    : [
        [0, 0],
        [1, 1],
      ];
  for (const [se, ep] of attempts) {
    const data =
      (await signedGet(P_PLAY, [
        ['subjectId', subjectId],
        ['se', String(se)],
        ['ep', String(ep)],
      ])).data || {};
    const stream = (data.streams || []).find((s) => s.url && s.url.trim());
    if (stream) {
      return {
        url: stream.url,
        signCookie: stream.signCookie || '',
        format: (stream.format || 'DASH').toUpperCase(),
        resolutions: stream.resolutions || '',
        title: data.title || '',
      };
    }
  }
  return null;
}

module.exports = { search, playInfo, USER_AGENT };
