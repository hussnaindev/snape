// HMAC-SHA256 sign/verify for media-proxy URLs.
//
// ⚠️ This MUST stay algorithm-identical to `lib/media-sign.ts` (the Next.js
// edge route) and to the mirrored signing inside `netlify/functions/extract.mjs`.
// extract.mjs mints the signed URLs; this Worker verifies them. Same algorithm +
// same MEDIA_PROXY_SECRET on both sides, or every media request 403s.
//
// The only difference from `lib/media-sign.ts` is the secret source: a plain
// Worker can't read `process.env`, so the secret is injected from `env` on each
// request via initSecret().

export type UpstreamHeaders = Record<string, string>;

let keyPromise: Promise<CryptoKey> | null = null;
let currentSecret = '';

/** Inject the HMAC secret (from the Worker `env` binding). Rebuilds the key if it changed. */
export function initSecret(secret: string): void {
  if (secret !== currentSecret) {
    currentSecret = secret;
    keyPromise = null;
  }
}

function getKey(): Promise<CryptoKey> {
  if (keyPromise === null) {
    keyPromise = crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(currentSecret),
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

function pickHeaders(h: UpstreamHeaders | undefined): UpstreamHeaders {
  const out: UpstreamHeaders = {};
  if (!h) return out;
  for (const k of ['referer', 'origin', 'user-agent']) {
    const v = h[k] ?? h[k.toLowerCase()];
    if (typeof v === 'string' && v) out[k] = v;
  }
  return out;
}

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

/** One HMAC for an entire HLS manifest — child segment URLs reuse this scope. */
export async function signManifestScope(
  manifestUrl: string,
  headers?: UpstreamHeaders,
): Promise<{ mb: string; mh: string; ms: string }> {
  const mh = encodeHeaders(headers);
  const ms = await hmac(`manifest:${manifestUrl}\n${mh}`);
  return { mb: manifestUrl, mh, ms };
}

/** Verify a manifest-scoped child URL (same CDN origin as the manifest). */
export async function verifyManifestChild(
  childUrl: string,
  manifestUrl: string,
  headersBlob: string,
  scopeSig: string,
): Promise<boolean> {
  const expected = await hmac(`manifest:${manifestUrl}\n${headersBlob}`);
  if (scopeSig !== expected) return false;
  try {
    return new URL(childUrl).origin === new URL(manifestUrl).origin;
  } catch {
    return false;
  }
}

export function manifestScopedProxyUrl(
  childAbsoluteUrl: string,
  scope: { mb: string; mh: string; ms: string },
): string {
  const mh = scope.mh ? `&mh=${encodeURIComponent(scope.mh)}` : '';
  return `/api/media-proxy?mu=${encodeURIComponent(childAbsoluteUrl)}&mb=${encodeURIComponent(scope.mb)}${mh}&ms=${scope.ms}`;
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
