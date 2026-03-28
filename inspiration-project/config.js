// ── Swan · config.js ──────────────────────────────────────────────────────────
// Set your Cloudflare Worker proxy URL here.
// This is the ONLY place in the codebase that contains the proxy base URL.
// All proxied URLs are constructed via proxy() in hero-urls.js.

var CFW_WORKER_PROXY_URL = 'https://swan.hussnain444all.workers.dev/';

/**
 * Prepend the CFW proxy to any absolute URL.
 * Usage:  proxy('https://cdn-sfw.vixen.com/...')
 *      →  'https://YOUR_WORKER.workers.dev/https://cdn-sfw.vixen.com/...'
 */
function proxy(url) {
  return CFW_WORKER_PROXY_URL + url;
}
