// Standalone Peachify extraction function for Netlify (AWS Lambda egress).
//
// Purpose: eat-peach.sbs blocks Cloudflare's egress IPs, so the source-API
// fetch can't run on Cloudflare Pages. Netlify runs on AWS, a different ASN —
// this function tests whether that IP range is allowed and, if so, performs the
// extraction (fetch all providers + AES-GCM decrypt) and returns clean sources.
//
// Deploy: connect this repo to Netlify (no build needed; it auto-detects
// netlify/functions), or run `npx netlify deploy`. Then hit:
//   https://<site>.netlify.app/.netlify/functions/extract?type=movie&id=1022789
//
// On success → { ok:true, sources:[...], subtitles:[...] }
// On block   → { ok:false, debug:{ "<provider>": <httpStatus> } }  (403 = IP blocked)

const AES_KEY_HEX = 'a8f2a1b5e9c470814f6b2c3a5d8e7f9c1a2b3c4d5e3f7a8b8cad1e2d0a4d5c5b';
const REFERER = 'https://peachify.top/';
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

const PROVIDERS = [
  { label: 'Iron', path: 'moviebox', api: 'https://uwu.eat-peach.sbs' },
  { label: 'Spider', path: 'holly', api: 'https://usa.eat-peach.sbs' },
  { label: 'Wolf', path: 'air', api: 'https://usa.eat-peach.sbs' },
  { label: 'Multi', path: 'multi', api: 'https://usa.eat-peach.sbs' },
  { label: 'Dark', path: 'net', api: 'https://uwu.eat-peach.sbs' },
];

function b64urlToBytes(input) {
  const norm = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = norm.length % 4 === 0 ? '' : '='.repeat(4 - (norm.length % 4));
  return new Uint8Array(Buffer.from(norm + pad, 'base64'));
}
function hexToBytes(hex) {
  return new Uint8Array(hex.match(/.{1,2}/g).map((h) => Number.parseInt(h, 16)));
}
async function decrypt(data) {
  const [iv, salt, ct] = data.split('.');
  const ivB = b64urlToBytes(iv);
  const saltB = b64urlToBytes(salt);
  const ctB = b64urlToBytes(ct);
  const sealed = new Uint8Array(saltB.length + ctB.length);
  sealed.set(saltB, 0);
  sealed.set(ctB, saltB.length);
  const key = await crypto.subtle.importKey('raw', hexToBytes(AES_KEY_HEX), { name: 'AES-GCM' }, false, [
    'decrypt',
  ]);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivB }, key, sealed);
  return JSON.parse(new TextDecoder().decode(plain));
}

function unwrap(rawUrl) {
  let url = rawUrl;
  const headers = {};
  for (let i = 0; i < 3; i++) {
    let u;
    try {
      u = new URL(url);
    } catch {
      break;
    }
    const isProxy =
      (u.hostname.endsWith('.workers.dev') || u.hostname.endsWith('.eat-peach.sbs')) &&
      u.pathname.includes('proxy');
    const inner = u.searchParams.get('url');
    if (!isProxy || !inner) break;
    const h = u.searchParams.get('headers');
    if (h) {
      try {
        Object.assign(headers, JSON.parse(h));
      } catch {}
    }
    url = inner;
  }
  return { url, headers };
}

export default async (req) => {
  const sp = new URL(req.url).searchParams;
  const type = sp.get('type') === 'tv' ? 'tv' : 'movie';
  const id = sp.get('id');
  const season = sp.get('season');
  const episode = sp.get('episode');

  const debug = {};
  const sources = [];
  let subtitles = [];

  await Promise.all(
    PROVIDERS.map(async (p) => {
      let url = `${p.api}/${p.path}/${type}/${id}`;
      if (type === 'tv') url += `/${season}/${episode}`;
      try {
        const res = await fetch(url, { headers: { Referer: REFERER, 'User-Agent': UA } });
        debug[p.label] = res.status;
        if (!res.ok) return;
        let json = await res.json();
        if (json.isEncrypted) json = await decrypt(json.data);
        for (const s of json.sources ?? []) {
          if (typeof s.url !== 'string') continue;
          const { url: real, headers } = unwrap(s.url);
          sources.push({
            type: s.type === 'hls' ? 'hls' : 'mp4',
            url: real,
            headers,
            quality: typeof s.quality === 'number' ? s.quality : null,
            dub: typeof s.dub === 'string' ? s.dub : null,
            provider: p.label,
          });
        }
        if (subtitles.length === 0 && Array.isArray(json.subtitles)) {
          subtitles = json.subtitles
            .filter((s) => typeof s.url === 'string')
            .map((s) => ({ url: s.url, label: s.label ?? s.language ?? null, lang: s.language ?? s.lang ?? null }));
        }
      } catch (e) {
        debug[p.label] = e instanceof Error ? e.message : String(e);
      }
    }),
  );

  sources.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'mp4' ? -1 : 1;
    return (b.quality ?? 0) - (a.quality ?? 0);
  });

  const body = sources.length ? { ok: true, sources, subtitles } : { ok: false, debug };
  return new Response(JSON.stringify(body), {
    status: sources.length ? 200 : 502,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
};
