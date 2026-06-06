import {
  PEACHIFY_AES_KEY_HEX,
  PEACHIFY_PROVIDERS,
  PEACHIFY_REFERER,
  PEACHIFY_UA,
  type PeachifyProvider,
} from '@/lib/peachify-config';

export interface StreamSource {
  type: 'mp4' | 'hls';
  url: string;
  /** Upstream headers the real CDN requires (referer/origin/user-agent). */
  headers: Record<string, string>;
  quality: number | null;
  dub: string | null;
  provider: string;
}

export interface StreamSubtitle {
  url: string;
  label: string | null;
  lang: string | null;
}

export interface ExtractResult {
  sources: StreamSource[];
  subtitles: StreamSubtitle[];
}

type MediaType = 'movie' | 'tv';

/** base64url → bytes (Peachify uses URL-safe base64 without padding). */
function b64urlToBytes(input: string): Uint8Array {
  const norm = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = norm.length % 4 === 0 ? '' : '='.repeat(4 - (norm.length % 4));
  const bin = atob(norm + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function hexToBytes(hex: string): Uint8Array {
  const m = hex.match(/.{1,2}/g);
  if (!m) return new Uint8Array(0);
  return new Uint8Array(m.map((h) => Number.parseInt(h, 16)));
}

/** Copy into a fresh ArrayBuffer so Web Crypto accepts it under strict TS. */
function toArrayBuffer(u: Uint8Array): ArrayBuffer {
  const ab = new ArrayBuffer(u.byteLength);
  new Uint8Array(ab).set(u);
  return ab;
}

/**
 * Decrypt a Peachify encrypted payload. Format: `iv.salt.ciphertext`, each
 * part base64url. AES-GCM with the (salt+ciphertext) as the sealed message —
 * the GCM auth tag is the trailing 16 bytes of the ciphertext part.
 */
async function decryptPayload(data: string, keyHex: string): Promise<unknown> {
  const [ivPart, saltPart, ctPart] = data.split('.');
  if (!ivPart || !saltPart || !ctPart) throw new Error('malformed payload');

  const iv = b64urlToBytes(ivPart);
  const salt = b64urlToBytes(saltPart);
  const ct = b64urlToBytes(ctPart);

  const sealed = new Uint8Array(salt.length + ct.length);
  sealed.set(salt, 0);
  sealed.set(ct, salt.length);

  const key = await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(hexToBytes(keyHex)),
    { name: 'AES-GCM' },
    false,
    ['decrypt'],
  );
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(sealed),
  );
  return JSON.parse(new TextDecoder().decode(plain));
}

interface RawSource {
  type?: unknown;
  url?: unknown;
  quality?: unknown;
  dub?: unknown;
}

interface RawSubtitle {
  url?: unknown;
  label?: unknown;
  language?: unknown;
  lang?: unknown;
}

interface RawResult {
  sources?: RawSource[];
  subtitles?: RawSubtitle[];
}

function buildSourceUrl(p: PeachifyProvider, type: MediaType, tmdbId: number, season?: number, episode?: number): string {
  let url = `${p.api}/${p.path}/${type}/${tmdbId}`;
  if (type === 'tv' && season != null && episode != null) url += `/${season}/${episode}`;
  return url;
}

async function fetchProvider(
  p: PeachifyProvider,
  type: MediaType,
  tmdbId: number,
  season?: number,
  episode?: number,
): Promise<RawResult | null> {
  try {
    const res = await fetch(buildSourceUrl(p, type, tmdbId, season, episode), {
      headers: { Origin: PEACHIFY_REFERER.replace(/\/$/, ''), Referer: PEACHIFY_REFERER, 'User-Agent': PEACHIFY_UA },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { isEncrypted?: boolean; data?: string } | RawResult;
    if (json && typeof json === 'object' && 'isEncrypted' in json && json.isEncrypted && typeof json.data === 'string') {
      return (await decryptPayload(json.data, PEACHIFY_AES_KEY_HEX)) as RawResult;
    }
    return json as RawResult;
  } catch {
    return null;
  }
}

/**
 * Peachify wraps real CDN URLs in proxy layers (e.g.
 * `*.workers.dev/mp4-proxy?url=<cdn>&headers=<json>` or
 * `*.eat-peach.sbs/m3u8-proxy?url=<cdn>&headers=<json>`). Those proxy workers
 * are flaky throwaways. Unwrap to the real CDN URL + the headers it requires so
 * we can hit it directly through our own (reliable) media proxy.
 */
function unwrapProxy(rawUrl: string): { url: string; headers: Record<string, string> } {
  let url = rawUrl;
  const headers: Record<string, string> = {};
  for (let i = 0; i < 3; i++) {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      break;
    }
    const isProxyHost =
      parsed.hostname.endsWith('.workers.dev') || parsed.hostname.endsWith('.eat-peach.sbs');
    const inner = parsed.searchParams.get('url');
    if (!isProxyHost || !parsed.pathname.includes('proxy') || !inner) break;
    const h = parsed.searchParams.get('headers');
    if (h) {
      try {
        Object.assign(headers, JSON.parse(h) as Record<string, string>);
      } catch {
        // ignore malformed header blob
      }
    }
    url = inner;
  }
  return { url, headers };
}

function normalizeSources(raw: RawResult | null, providerLabel: string): StreamSource[] {
  if (!raw?.sources) return [];
  const out: StreamSource[] = [];
  for (const s of raw.sources) {
    if (typeof s.url !== 'string') continue;
    const type = s.type === 'hls' ? 'hls' : 'mp4';
    const { url, headers } = unwrapProxy(s.url);
    out.push({
      type,
      url,
      headers,
      quality: typeof s.quality === 'number' ? s.quality : null,
      dub: typeof s.dub === 'string' ? s.dub : null,
      provider: providerLabel,
    });
  }
  return out;
}

function normalizeSubtitles(raw: RawResult | null): StreamSubtitle[] {
  if (!raw?.subtitles) return [];
  const out: StreamSubtitle[] = [];
  for (const s of raw.subtitles) {
    if (typeof s.url !== 'string') continue;
    const lang = typeof s.language === 'string' ? s.language : typeof s.lang === 'string' ? s.lang : null;
    out.push({
      url: s.url,
      label: typeof s.label === 'string' ? s.label : lang,
      lang,
    });
  }
  return out;
}

/**
 * Extract playable sources for a title by querying all providers in parallel
 * and merging results. Sources are ordered hls-first (adaptive), then by
 * descending quality.
 */
export async function extractStreams(
  type: MediaType,
  tmdbId: number,
  season?: number,
  episode?: number,
): Promise<ExtractResult> {
  const results = await Promise.all(
    PEACHIFY_PROVIDERS.map((p) => fetchProvider(p, type, tmdbId, season, episode).then((r) => ({ p, r }))),
  );

  const sources: StreamSource[] = [];
  let subtitles: StreamSubtitle[] = [];
  for (const { p, r } of results) {
    sources.push(...normalizeSources(r, p.label));
    if (subtitles.length === 0) subtitles = normalizeSubtitles(r);
  }

  // mp4 first: single predictable host (workers.dev), supports byte-range
  // seeking, and is less prone to upstream rate-limiting than the HLS CDNs.
  // Within a type, highest quality first.
  sources.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'mp4' ? -1 : 1;
    return (b.quality ?? 0) - (a.quality ?? 0);
  });

  return { sources, subtitles };
}
