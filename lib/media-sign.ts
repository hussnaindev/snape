import { MEDIA_PROXY_SECRET } from '@/lib/peachify-config';

// HMAC-SHA256 signing for media-proxy URLs. The proxy forwards to arbitrary
// upstream CDN hosts (after unwrapping Peachify's proxy layers), so instead of
// a host allowlist we sign every URL we mint — plus the per-source upstream
// headers it must send — and verify on the way in. This keeps the endpoint
// from being usable as an open proxy.

export type UpstreamHeaders = Record<string, string>;

let keyPromise: Promise<CryptoKey> | null = null;

function getKey(): Promise<CryptoKey> {
  if (keyPromise === null) {
    keyPromise = crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(MEDIA_PROXY_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign', 'verify'],
    );
  }
  return keyPromise;
}

function toHex(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let out = '';
  for (const b of bytes) out += b.toString(16).padStart(2, '0');
  return out;
}

async function hmac(payload: string): Promise<string> {
  const key = await getKey();
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return toHex(sig);
}

/** Keep only the upstream headers a CDN actually checks. */
function pickHeaders(h: UpstreamHeaders | undefined): UpstreamHeaders {
  const out: UpstreamHeaders = {};
  if (!h) return out;
  for (const k of ['referer', 'origin', 'user-agent']) {
    const v = h[k] ?? h[k.toLowerCase()];
    if (typeof v === 'string' && v) out[k] = v;
  }
  return out;
}

/** Encode upstream headers to a compact base64 blob (empty string if none). */
export function encodeHeaders(h: UpstreamHeaders | undefined): string {
  const picked = pickHeaders(h);
  return Object.keys(picked).length ? btoa(JSON.stringify(picked)) : '';
}

export function decodeHeaders(blob: string): UpstreamHeaders {
  if (!blob) return {};
  try {
    return JSON.parse(atob(blob)) as UpstreamHeaders;
  } catch {
    return {};
  }
}

/** Build a signed media-proxy path for an absolute URL + its upstream headers. */
export async function signedMediaUrl(
  absoluteUrl: string,
  headers?: UpstreamHeaders,
): Promise<string> {
  const h = encodeHeaders(headers);
  const sig = await hmac(`${absoluteUrl}\n${h}`);
  const hParam = h ? `&h=${encodeURIComponent(h)}` : '';
  return `/api/media-proxy?u=${encodeURIComponent(absoluteUrl)}${hParam}&s=${sig}`;
}

/** Verify a media-proxy request's signature over (url + headers blob). */
export async function verifyMediaUrl(
  absoluteUrl: string,
  headersBlob: string,
  sig: string,
): Promise<boolean> {
  if (!sig) return false;
  const expected = await hmac(`${absoluteUrl}\n${headersBlob}`);
  if (expected.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}
