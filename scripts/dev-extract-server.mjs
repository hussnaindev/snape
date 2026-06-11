// Local-only extract server for `bun run dev`. Cloudflare Pages can't run
// MovieBox extraction (needs Node + residential HTTP proxy), so this stays
// out of the Next.js app bundle.
//
// Listens on EXTRACT_PORT (default 8787). Point NETLIFY_EXTRACT_URL at:
//   http://localhost:8787/extract
//
// Requires PROXY_LIST in .env.local (same host:port:user:pass list as Netlify).

import { createServer } from 'node:http';
import { proxyCount } from './load-env.mjs';

const PORT = Number(process.env.EXTRACT_PORT ?? 8787);
const proxies = proxyCount();
if (proxies === 0) {
  console.warn(
    '[dev-extract] PROXY_LIST is empty — MovieBox will 403. Copy the value from Netlify into .env.local, or point NETLIFY_EXTRACT_URL at your deployed Netlify function.',
  );
} else {
  console.log(`[dev-extract] ${proxies} proxies loaded`);
}

const extractPath = new URL('../netlify/functions/extract.mjs', import.meta.url);
const { default: extract } = await import(extractPath.href);

const server = createServer(async (req, res) => {
  if (req.method !== 'GET') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: 'Method not allowed' }));
    return;
  }

  try {
    const url = new URL(req.url ?? '/', `http://127.0.0.1:${PORT}`);
    const extractReq = new Request(`http://local/extract${url.search}`);
    const extractRes = await extract(extractReq);
    const body = await extractRes.text();
    res.writeHead(extractRes.status, {
      'Content-Type': extractRes.headers.get('Content-Type') ?? 'application/json',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(body);
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }));
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[dev-extract] http://127.0.0.1:${PORT}/extract`);
});
