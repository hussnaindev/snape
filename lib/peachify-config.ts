// Peachify reverse-engineered config.
//
// These values are extracted from Peachify's frontend bundle. If Peachify
// rotates them (anti-scraping), extraction breaks until these are refreshed.
// A maintenance script can re-scrape and patch this file when that happens.
//
// Last verified: 2026-06-07

/** AES-GCM key (hex) used to decrypt the `data` field of source responses. */
export const PEACHIFY_AES_KEY_HEX =
  'a8f2a1b5e9c470814f6b2c3a5d8e7f9c1a2b3c4d5e3f7a8b8cad1e2d0a4d5c5b';

/** Referer the upstream source APIs / media proxies allowlist. */
export const PEACHIFY_REFERER = 'https://peachify.top/';

/** Browser UA used for upstream requests. */
export const PEACHIFY_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

/**
 * Secret for HMAC-signing media-proxy URLs. The proxy will only fetch URLs
 * it minted (signature must verify), so it can safely forward to the arbitrary
 * CDN hosts that appear inside HLS manifests without being an open proxy.
 * Override in production via MEDIA_PROXY_SECRET.
 */
export const MEDIA_PROXY_SECRET = process.env.MEDIA_PROXY_SECRET ?? 'snape-media-proxy-dev-secret';

export interface PeachifyProvider {
  /** Display label from Peachify's UI. */
  label: string;
  /** Path segment in the source API URL. */
  path: string;
  /** Base API host for this provider. */
  api: string;
}

/** Source providers, in priority order. */
export const PEACHIFY_PROVIDERS: PeachifyProvider[] = [
  { label: 'Iron', path: 'moviebox', api: 'https://uwu.eat-peach.sbs' },
  { label: 'Spider', path: 'holly', api: 'https://usa.eat-peach.sbs' },
  { label: 'Wolf', path: 'air', api: 'https://usa.eat-peach.sbs' },
  { label: 'Multi', path: 'multi', api: 'https://usa.eat-peach.sbs' },
  { label: 'Dark', path: 'net', api: 'https://uwu.eat-peach.sbs' },
];
