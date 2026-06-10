// MovieBox extraction on Netlify — routes h5-api / movie-box.co through a
// residential proxy because Cloudflare egress IPs get HTTP 429 from MovieBox.
// Returns signed media-proxy URLs (same HMAC as lib/media-sign.ts / extract.mjs).
//
// Env: PROXY_LIST, MEDIA_PROXY_SECRET, MEDIA_PROXY_BASE (optional),
//      MOVIEBOX_BEARER, MOVIEBOX_MB_TOKEN, MOVIEBOX_TOKEN (optional overrides)
//
// GET ?q=o+romeo  |  ?subjectId=…&detailPath=…  [&se=0&ep=0]

import { fetch as uFetch, ProxyAgent } from 'undici';

const H5_API = 'https://h5-api.aoneroom.com/wefeed-h5api-bff';
const SITE = 'https://movie-box.co';
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36';
const CLIENT_INFO = '{"timezone":"Asia/Karachi"}';
const CDN_HEADERS = { referer: `${SITE}/`, 'user-agent': UA };

const AUTH_FALLBACK = {
  bearer:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOjczNDAzNTIwNjY4Njk1MjI0NTYsImF0cCI6MywiZXh0IjoiMTc4MTEyMDcwNiIsImV4cCI6MTc4ODg5NjcwNiwiaWF0IjoxNzgxMTIwNDA2fQ.gZ3d-RXw--3L9gkP-d0HEQJw4v9yF4kKBCib2O65S_U',
  mbToken:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOjczNDAzNTIwNjY4Njk1MjI0NTYsImF0cCI6MywiZXh0IjoiMTc4MTEyMDcwNiIsImV4cCI6MTc4ODg5NjcwNiwiaWF0IjoxNzgxMTIwNDA2fQ.gZ3d-RXw--3L9gkP-d0HEQJw4v9yF4kKBCib2O65S_U',
  token:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOjg1MTUwOTQyODc1ODIzNzM2OCwiYXRwIjozLCJleHQiOiIxNzgxMTIwNzI2IiwiZXhwIjoxNzg4ODk2NzI2LCJpYXQiOjE3ODExMjA0MjZ9.LznAOxQ-2ziRIxOmYht7GSWXaGf0BM1DPBN0EAfe6d0',
};

function auth() {
  const bearer = process.env.MOVIEBOX_BEARER?.trim();
  const mbToken = (process.env.MOVIEBOX_MB_TOKEN ?? bearer)?.trim();
  const token = (process.env.MOVIEBOX_TOKEN ?? bearer)?.trim();
  if (bearer && mbToken && token) return { bearer, mbToken, token };
  return AUTH_FALLBACK;
}

function parseProxies() {
  const raw = process.env.PROXY_LIST ?? '';
  return raw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((entry) => {
      const [host, port, user, pass] = entry.split(':');
      if (!host || !port) return null;
      const a = user && pass ? `${encodeURIComponent(user)}:${encodeURIComponent(pass)}@` : '';
      return `http://${a}${host}:${port}`;
    })
    .filter(Boolean);
}
const PROXIES = parseProxies();
function pickProxyAgent() {
  if (PROXIES.length === 0) return undefined;
  return new ProxyAgent(PROXIES[Math.floor(Math.random() * PROXIES.length)]);
}

const SECRET = process.env.MEDIA_PROXY_SECRET ?? 'snape-media-proxy-dev-secret';
const MEDIA_PROXY_BASE = (process.env.MEDIA_PROXY_BASE ?? '').replace(/\/+$/, '');
let signKey;
async function getSignKey() {
  if (!signKey) {
    signKey = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
  }
  return signKey;
}
function pickHeaders(h) {
  const out = {};
  for (const k of ['referer', 'origin', 'user-agent']) {
    const v = h?.[k] ?? h?.[k.toLowerCase()];
    if (typeof v === 'string' && v) out[k] = v;
  }
  return out;
}
function encodeHeaders(h) {
  const picked = pickHeaders(h);
  return Object.keys(picked).length ? btoa(JSON.stringify(picked)) : '';
}
async function signedMediaUrl(absoluteUrl, headers) {
  const h = encodeHeaders(headers);
  const key = await getSignKey();
  const sigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${absoluteUrl}\n${h}`));
  const sig = [...new Uint8Array(sigBuf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  const hParam = h ? `&h=${encodeURIComponent(h)}` : '';
  return `${MEDIA_PROXY_BASE}/api/media-proxy?u=${encodeURIComponent(absoluteUrl)}${hParam}&s=${sig}`;
}

const ATTEMPT_TIMEOUT_MS = 8000;
const MAX_ATTEMPTS = 4;

async function proxyFetch(url, init = {}) {
  let lastStatus = 0;
  let lastBody = '';
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), ATTEMPT_TIMEOUT_MS);
    try {
      const res = await uFetch(url, {
        ...init,
        signal: ac.signal,
        dispatcher: pickProxyAgent(),
      });
      lastStatus = res.status;
      if (res.status === 429 || res.status >= 500) {
        lastBody = await res.text().catch(() => '');
        if (attempt < MAX_ATTEMPTS - 1) {
          await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
          continue;
        }
      }
      return res;
    } catch (e) {
      lastBody = String(e);
      if (attempt < MAX_ATTEMPTS - 1) {
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
        continue;
      }
      throw new Error(`upstream fetch failed: ${lastBody}`);
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(`upstream HTTP ${lastStatus}${lastBody ? `: ${lastBody.slice(0, 120)}` : ''}`);
}

function playCookie(a) {
  return `mb_token=%22${encodeURIComponent(a.mbToken)}%22; i18n_lang=en; token=${a.token}`;
}

async function search(keyword, a) {
  const res = await proxyFetch(`${H5_API}/subject/search`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${a.bearer}`,
      'content-type': 'application/json',
      origin: SITE,
      referer: `${SITE}/web/searchResult?keyword=${encodeURIComponent(keyword)}`,
      'user-agent': UA,
      'x-client-info': CLIENT_INFO,
      'x-request-lang': 'en',
    },
    body: JSON.stringify({ keyword, page: 1, perPage: 28, subjectType: 0 }),
  });
  if (!res.ok) throw new Error(`search HTTP ${res.status}`);
  const json = await res.json();
  if (json.code !== 0) throw new Error(`search API ${json.code}: ${json.message}`);
  return json.data?.items ?? [];
}

async function play(subjectId, detailPath, a, se, ep) {
  const url = new URL(`${SITE}/wefeed-h5api-bff/subject/play`);
  url.searchParams.set('subjectId', subjectId);
  url.searchParams.set('se', String(se));
  url.searchParams.set('ep', String(ep));
  url.searchParams.set('detailPath', detailPath);

  const res = await proxyFetch(url.toString(), {
    headers: {
      accept: 'application/json',
      cookie: playCookie(a),
      referer: `${SITE}/movies/${detailPath}?id=${subjectId}&type=/movie/detail&lang=en`,
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-origin',
      'user-agent': UA,
      'x-client-info': CLIENT_INFO,
      'x-source': '',
    },
  });
  if (!res.ok) throw new Error(`play HTTP ${res.status}`);
  const json = await res.json();
  if (json.code !== 0) throw new Error(`play API ${json.code}: ${json.message}`);
  return json.data?.streams ?? [];
}

async function captions(streamId, subjectId, detailPath) {
  const url = new URL(`${H5_API}/subject/caption`);
  url.searchParams.set('format', 'MP4');
  url.searchParams.set('id', streamId);
  url.searchParams.set('subjectId', subjectId);
  url.searchParams.set('detailPath', detailPath);

  const res = await proxyFetch(url.toString(), {
    headers: {
      accept: 'application/json',
      origin: SITE,
      referer: `${SITE}/movies/${detailPath}?id=${subjectId}`,
      'user-agent': UA,
      'x-client-info': CLIENT_INFO,
    },
  });
  if (!res.ok) throw new Error(`caption HTTP ${res.status}`);
  const json = await res.json();
  if (json.code !== 0) throw new Error(`caption API ${json.code}: ${json.message}`);
  return json.data?.captions ?? [];
}

export default async (req) => {
  const url = new URL(req.url);
  const keyword = url.searchParams.get('q') ?? url.searchParams.get('keyword') ?? '';
  const subjectId = url.searchParams.get('subjectId') ?? '';
  const detailPath = url.searchParams.get('detailPath') ?? '';
  const se = Number.parseInt(url.searchParams.get('se') ?? '0', 10);
  const ep = Number.parseInt(url.searchParams.get('ep') ?? '0', 10);

  if (!keyword && !(subjectId && detailPath)) {
    return Response.json({ ok: false, error: 'Provide q or subjectId+detailPath' }, { status: 400 });
  }
  if (PROXIES.length === 0) {
    return Response.json({ ok: false, error: 'PROXY_LIST not configured' }, { status: 500 });
  }

  try {
    const a = auth();
    let subject;
    if (subjectId && detailPath) {
      subject = { subjectId, detailPath, title: '', hasResource: true };
    } else {
      const items = await search(keyword, a);
      subject = items.find((i) => i.hasResource) ?? items[0];
      if (!subject) return Response.json({ ok: false, error: 'No search results' }, { status: 200 });
    }

    const streams = await play(subject.subjectId, subject.detailPath, a, se, ep);
    if (streams.length === 0) {
      return Response.json({ ok: false, error: 'No streams returned' }, { status: 200 });
    }

    const sources = await Promise.all(
      streams.map(async (s) => {
        const quality = Number.parseInt(s.resolutions, 10) || null;
        const signed = await signedMediaUrl(s.url, CDN_HEADERS);
        return {
          type: 'mp4',
          url: `${signed}&v=1`,
          quality,
          dub: 'Original Audio',
          provider: 'MovieBox',
        };
      }),
    );
    sources.sort((x, y) => (y.quality ?? 0) - (x.quality ?? 0));

    const primary = streams[0];
    const caps = await captions(primary.id, subject.subjectId, subject.detailPath);
    const subtitles = await Promise.all(
      caps.map(async (c) => ({
        url: `${await signedMediaUrl(c.url, CDN_HEADERS)}&sub=1`,
        label: c.lanName,
        lang: c.lan,
      })),
    );

    return Response.json(
      { ok: true, data: { sources, subtitles, subject } },
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 's-maxage=300, stale-while-revalidate=600',
        },
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'MovieBox resolve failed';
    return Response.json({ ok: false, error: message }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
  }
};
