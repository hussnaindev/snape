// Edge-runtime stream URL extractor.
// Uses only Web APIs (fetch, TextEncoder, atob) — no Node.js Buffer.
// Providers are tried in order; first success wins.
// Failures fall back to the existing iframe embed route automatically.

export type SubtitleTrack = {
  src: string;
  label: string;
  lang: string;
  kind: 'subtitles' | 'captions';
};

export type StreamResult =
  | { ok: true; streamUrl: string; subtitles: SubtitleTrack[]; provider: string }
  | { ok: false; error: string };

export const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'cross-site',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1',
} as const;

// Decode Dean Edwards P,A,C,K,E,R obfuscation.
// Handles: eval(function(p,a,c,k,e,d){while(c--)...return p}('packed',base,count,'k1|k2'.split('|')))
function unpackEvalPacker(html: string): string | null {
  const m = html.match(
    /eval\(function\(p,a,c,k,e,d\)\{[\s\S]*?return p\}\('([\s\S]+?)',\s*(\d+),\s*(\d+),\s*'([\s\S]+?)'\.split\('\|'\)\)\)/,
  );
  if (!m) return null;

  const packed = m[1] ?? '';
  const base = Number(m[2]);
  const count = Number(m[3]);
  const keys = (m[4] ?? '').split('|');

  const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
  function toBase(n: number, b: number): string {
    if (n === 0) return '0';
    let result = '';
    let remaining = n;
    while (remaining > 0) {
      result = (chars[remaining % b] ?? '') + result;
      remaining = Math.floor(remaining / b);
    }
    return result;
  }

  let decoded = packed;
  for (let i = count - 1; i >= 0; i--) {
    const key = i < keys.length ? keys[i] : '';
    if (key) {
      decoded = decoded.replace(new RegExp(`\\b${toBase(i, base)}\\b`, 'g'), key);
    }
  }
  return decoded;
}

// Extract JWPlayer caption/subtitle tracks from a decoded script (not thumbnails).
function extractJwTracks(decoded: string): SubtitleTrack[] {
  const tracks: SubtitleTrack[] = [];
  // Match individual track objects: {file:"...",kind:"captions",label:"English",...}
  for (const objMatch of decoded.matchAll(/\{[^{}]*?\.vtt[^{}]*?\}/g)) {
    const obj = objMatch[0] ?? '';
    const kindMatch = obj.match(/kind\s*:\s*["']([^"']+)["']/);
    const kind = kindMatch?.[1] ?? 'subtitles';
    if (kind === 'thumbnails') continue;
    const fileMatch = obj.match(/file\s*:\s*["']([^"']+\.vtt[^"']*?)["']/);
    const labelMatch = obj.match(/label\s*:\s*["']([^"']+)["']/);
    const src = fileMatch?.[1];
    const label = labelMatch?.[1];
    if (src && label) {
      const safeKind: 'subtitles' | 'captions' = kind === 'captions' ? 'captions' : 'subtitles';
      tracks.push({ src, label, lang: label.toLowerCase().slice(0, 2), kind: safeKind });
    }
  }
  return tracks;
}

// Find the first .m3u8 URL in any text (HTML, JS, JSON).
function findM3U8(text: string): string | null {
  const m = text.match(/["'`](https?:\/\/[^"'`\s\\]+\.m3u8[^"'`\s\\]*)/);
  return m?.[1] ?? null;
}

// ─── vidsrc.net (lestresolver algorithm) ──────────────────────────────────
// Chain: vidsrc.net embed → cloudnestra /rcp/{hash} → cloudnestra /prorcp/{hash} → HLS
// Requires IMDb ID — fetched from TMDB external_ids endpoint.

async function getImdbId(tmdbId: number, type: 'movie' | 'tv'): Promise<string | null> {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) return null;
  const endpoint =
    type === 'movie'
      ? `https://api.themoviedb.org/3/movie/${tmdbId}/external_ids?api_key=${apiKey}`
      : `https://api.themoviedb.org/3/tv/${tmdbId}/external_ids?api_key=${apiKey}`;
  try {
    const res = await fetch(endpoint);
    if (!res.ok) return null;
    const data = (await res.json()) as { imdb_id?: string };
    return data.imdb_id ?? null;
  } catch {
    return null;
  }
}

// Resolve {v1}, {v2}, … template vars in the prorcp file URL using the test_doms list.
function resolveVidsrcTemplate(fileUrl: string, prorpcHtml: string): string {
  if (!fileUrl.includes('{v')) return fileUrl;

  // Extract CDN domains from test_doms array: ["https://tmstr1.example.com", ...]
  const domMatches = prorpcHtml.matchAll(/"(https?:\/\/[a-z0-9]+\.([a-z0-9.]+))"/g);
  let idx = 1;
  let resolved = fileUrl;
  for (const dm of domMatches) {
    const domain = dm[2]; // e.g. "neonhorizonworkshops.com"
    if (domain && fileUrl.includes(`{v${idx}}`)) {
      resolved = resolved.replace(`{v${idx}}`, domain);
      idx++;
    }
  }
  // If still unresolved, fallback to cloudnestra.com
  resolved = resolved.replace(/\{v\d+\}/g, 'cloudnestra.com');
  return resolved;
}

async function tryVidsrcNet(
  tmdbId: number,
  type: 'movie' | 'tv',
  season?: number,
  episode?: number,
): Promise<StreamResult> {
  const tag = 'vidsrc.net';

  // Step 1 — resolve TMDB → IMDb ID
  const imdbId = await getImdbId(tmdbId, type);
  if (!imdbId) return { ok: false, error: `${tag}: could not resolve IMDb ID for TMDB ${tmdbId}` };

  // Step 2 — build vidsrc.net embed URL and fetch it
  const embedUrl =
    type === 'movie'
      ? `https://vidsrc.net/embed/movie?imdb=${imdbId}`
      : `https://vidsrc.net/embed/tv?imdb=${imdbId}&season=${season}&episode=${episode}`;
  const referer = 'https://vidsrc.net/';

  let embedHtml: string;
  try {
    const res = await fetch(embedUrl, { headers: { ...BROWSER_HEADERS, Referer: referer } });
    if (!res.ok) return { ok: false, error: `${tag}: embed HTTP ${res.status}` };
    embedHtml = await res.text();
  } catch (e) {
    return { ok: false, error: `${tag}: embed fetch: ${e instanceof Error ? e.message : String(e)}` };
  }

  // Step 3 — extract cloudnestra /rcp/{hash} iframe src
  const iframeMatch = embedHtml.match(/<iframe[^>]+src=["']([^"']+)["']/i);
  const rawRcpUrl = iframeMatch?.[1];
  if (!rawRcpUrl) return { ok: false, error: `${tag}: no iframe in embed page` };

  const rcpUrl = rawRcpUrl.startsWith('//') ? `https:${rawRcpUrl}` : rawRcpUrl;

  // Step 4 — fetch cloudnestra /rcp/{hash} page, extract /prorcp/{hash} src
  let rcpHtml: string;
  try {
    const res = await fetch(rcpUrl, { headers: { ...BROWSER_HEADERS, Referer: referer } });
    if (!res.ok) return { ok: false, error: `${tag}: rcp HTTP ${res.status}` };
    rcpHtml = await res.text();
  } catch (e) {
    return { ok: false, error: `${tag}: rcp fetch: ${e instanceof Error ? e.message : String(e)}` };
  }

  if (rcpHtml.includes('cf-turnstile')) {
    return { ok: false, error: `${tag}: cloudnestra rcp blocked by Turnstile CAPTCHA` };
  }

  const proRcpMatch = rcpHtml.match(/src:\s*['"]([^'"]+)['"]/);
  const proRcpPath = proRcpMatch?.[1];
  if (!proRcpPath) return { ok: false, error: `${tag}: no prorcp path in rcp page` };

  const proRcpUrl = `https://cloudnestra.com${proRcpPath}`;

  // Step 5 — fetch cloudnestra /prorcp/{hash}, extract file: '...' HLS URL
  let proRcpHtml: string;
  try {
    const res = await fetch(proRcpUrl, { headers: { ...BROWSER_HEADERS, Referer: rcpUrl } });
    if (!res.ok) return { ok: false, error: `${tag}: prorcp HTTP ${res.status}` };
    proRcpHtml = await res.text();
  } catch (e) {
    return { ok: false, error: `${tag}: prorcp fetch: ${e instanceof Error ? e.message : String(e)}` };
  }

  const fileMatch = proRcpHtml.match(/file:\s*['"]([^'"]+)['"]/);
  const rawFileUrl = fileMatch?.[1];
  if (!rawFileUrl) return { ok: false, error: `${tag}: no file URL in prorcp page` };

  const streamUrl = resolveVidsrcTemplate(rawFileUrl, proRcpHtml);
  if (!streamUrl.includes('://')) return { ok: false, error: `${tag}: could not resolve CDN template in file URL` };

  return { ok: true, streamUrl, subtitles: [], provider: tag };
}

// ─── embed.su ──────────────────────────────────────────────────────────────

async function tryEmbedSu(
  tmdbId: number,
  type: 'movie' | 'tv',
  season?: number,
  episode?: number,
): Promise<StreamResult> {
  const embedUrl =
    type === 'movie'
      ? `https://embed.su/embed/movie/${tmdbId}`
      : `https://embed.su/embed/tv/${tmdbId}/${season}/${episode}`;
  const referer = 'https://embed.su/';

  let html: string;
  try {
    const res = await fetch(embedUrl, { headers: { ...BROWSER_HEADERS, Referer: referer } });
    if (!res.ok) return { ok: false, error: `embed.su: HTTP ${res.status}` };
    html = await res.text();
  } catch (e) {
    return { ok: false, error: `embed.su: fetch: ${e instanceof Error ? e.message : String(e)}` };
  }

  // Strategy 1 — parse __NEXT_DATA__ (it's a Next.js SPA)
  const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/);
  if (nextDataMatch?.[1]) {
    try {
      const nextData = JSON.parse(nextDataMatch[1]) as Record<string, unknown>;
      const pageProps = (nextData.props as Record<string, unknown> | undefined)?.pageProps as
        | Record<string, unknown>
        | undefined;
      const sources = pageProps?.sources as { file?: string }[] | undefined;
      const streamUrl =
        (pageProps?.stream as string | undefined) ??
        (pageProps?.link as string | undefined) ??
        sources?.[0]?.file;
      if (
        typeof streamUrl === 'string' &&
        (streamUrl.includes('.m3u8') || streamUrl.includes('stream'))
      ) {
        return { ok: true, streamUrl, subtitles: [], provider: 'embed.su' };
      }
    } catch {
      // continue
    }
  }

  // Strategy 2 — direct M3U8 in the page HTML/JS
  const direct = findM3U8(html);
  if (direct) {
    return { ok: true, streamUrl: direct, subtitles: [], provider: 'embed.su' };
  }

  // Strategy 3 — inner iframe (embed.su may wrap another player)
  const iframeMatch = html.match(/<iframe[^>]+src=["']([^"']+)["']/i);
  const innerUrl = iframeMatch?.[1];
  if (innerUrl) {
    const origin = new URL(embedUrl).origin;
    const playerUrl = innerUrl.startsWith('http')
      ? innerUrl
      : `${origin}${innerUrl.startsWith('/') ? '' : '/'}${innerUrl}`;
    try {
      const res = await fetch(playerUrl, { headers: { ...BROWSER_HEADERS, Referer: referer } });
      if (res.ok) {
        const playerHtml = await res.text();
        const m3u8 = findM3U8(playerHtml);
        if (m3u8) {
          return { ok: true, streamUrl: m3u8, subtitles: [], provider: 'embed.su' };
        }
      }
    } catch {
      // continue
    }
  }

  return { ok: false, error: 'embed.su: no stream URL found' };
}

// ─── moviesapi.club ────────────────────────────────────────────────────────
// Chain: moviesapi.club → vidora.stream embed → Dean Edwards PACKER → JWPlayer M3U8 + VTT tracks

async function tryMoviesApiClub(
  tmdbId: number,
  type: 'movie' | 'tv',
  season?: number,
  episode?: number,
): Promise<StreamResult> {
  const embedUrl =
    type === 'movie'
      ? `https://moviesapi.club/movie/${tmdbId}`
      : `https://moviesapi.club/tv/${tmdbId}-${season}-${episode}`;
  const referer = 'https://moviesapi.club/';

  // Step 1 — fetch moviesapi.club page
  let html: string;
  try {
    const res = await fetch(embedUrl, { headers: { ...BROWSER_HEADERS, Referer: referer } });
    if (!res.ok) return { ok: false, error: `moviesapi.club: HTTP ${res.status}` };
    html = await res.text();
  } catch (e) {
    return {
      ok: false,
      error: `moviesapi.club: fetch: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  // Step 2 — extract the vidora.stream iframe src
  const iframeMatch = html.match(/<iframe[^>]+src=["'](https?:\/\/vidora\.stream\/[^"']+)["']/i);
  const vidoraUrl = iframeMatch?.[1];
  if (!vidoraUrl) return { ok: false, error: 'moviesapi.club: no vidora.stream iframe found' };

  // Step 3 — fetch the vidora.stream embed page
  let vidoraHtml: string;
  try {
    const res = await fetch(vidoraUrl, {
      headers: { ...BROWSER_HEADERS, Referer: referer },
    });
    if (!res.ok) return { ok: false, error: `moviesapi.club: vidora HTTP ${res.status}` };
    vidoraHtml = await res.text();
  } catch (e) {
    return {
      ok: false,
      error: `moviesapi.club: vidora fetch: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  // Step 4 — decode the Dean Edwards P,A,C,K,E,R obfuscated JWPlayer setup
  const decoded = unpackEvalPacker(vidoraHtml);
  if (!decoded) return { ok: false, error: 'moviesapi.club: no PACKER script in vidora page' };

  // Step 5 — extract M3U8 URL from the decoded JWPlayer sources
  const streamUrl = findM3U8(decoded);
  if (!streamUrl) return { ok: false, error: 'moviesapi.club: no M3U8 in decoded vidora script' };

  // Step 6 — extract subtitle VTT tracks
  const subtitles = extractJwTracks(decoded);

  return { ok: true, streamUrl, subtitles, provider: 'moviesapi.club' };
}

// ─── Public API ────────────────────────────────────────────────────────────

export async function extractMovieStream(tmdbId: number): Promise<StreamResult> {
  const providers = [
    () => tryMoviesApiClub(tmdbId, 'movie'),
    () => tryVidsrcNet(tmdbId, 'movie'),
    () => tryEmbedSu(tmdbId, 'movie'),
  ];

  const errors: string[] = [];
  for (const tryProvider of providers) {
    const result = await tryProvider();
    if (result.ok) return result;
    errors.push(result.error);
    console.error('[stream-extractor] movie', tmdbId, result.error);
  }

  return { ok: false, error: errors.join(' | ') };
}

export async function extractSeriesStream(
  tmdbId: number,
  season: number,
  episode: number,
): Promise<StreamResult> {
  const providers = [
    () => tryVidsrcNet(tmdbId, 'tv', season, episode),
    () => tryMoviesApiClub(tmdbId, 'tv', season, episode),
    () => tryEmbedSu(tmdbId, 'tv', season, episode),
  ];

  const errors: string[] = [];
  for (const tryProvider of providers) {
    const result = await tryProvider();
    if (result.ok) return result;
    errors.push(result.error);
    console.error('[stream-extractor] series', tmdbId, `S${season}E${episode}`, result.error);
  }

  return { ok: false, error: errors.join(' | ') };
}
