// Provider test suite: sweep many movie/series titles and validate, per provider,
//   1) detection/extraction (does the provider return playable sources?)
//   2) playback (does the source actually stream through our media proxy?)
//
// Uses the REAL prod extraction code (extract.mjs exports) + prod proxy pool
// (.env.prod) and routes playback through the locally-running media Worker
// (wrangler dev on :8787) — i.e. the exact prod pipeline, end to end.
//
// Usage: node scripts/provider-suite.mjs [movieCount] [tvCount]
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
function loadEnv(file) {
  try {
    for (const line of readFileSync(join(root, file), 'utf8').split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      const k = t.slice(0, eq).trim();
      if (process.env[k] === undefined) process.env[k] = t.slice(eq + 1).trim();
    }
  } catch {}
}
loadEnv('.env.prod');
loadEnv('.env');

const LOCAL = process.env.TEST_PROXY_BASE || 'http://localhost:8787';
const TMDB_KEY = process.env.TMDB_API_KEY;
const MOVIE_N = Number(process.argv[2] || 28);
const TV_N = Number(process.argv[3] || 24);

const ex = await import('../netlify/functions/extract.mjs');
const { PROVIDERS, fetchProvider, collectProviderSources, signedMediaUrl, isClientDirectHost } = ex;

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
const toLocal = (signedPath) => LOCAL + signedPath; // signedMediaUrl returns MEDIA_PROXY_BASE + /api/... ; strip base
const stripBase = (u) => u.replace(/^https?:\/\/[^/]+/, '');

// fetch with a timeout so a single hung CDN/segment can't stall the whole sweep.
async function fetchT(url, init = {}, ms = 15000) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ac.signal });
  } finally {
    clearTimeout(timer);
  }
}
// Read only the first ~64 KB of a body, then cancel — proves the segment is
// reachable + real bytes without pulling a multi-MB .png/.ts through the Worker.
async function readHead(res, max = 64 * 1024) {
  const reader = res.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks = [];
  let n = 0;
  try {
    while (n < max) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        n += value.length;
      }
    }
  } finally {
    reader.cancel().catch(() => {});
  }
  const out = new Uint8Array(n);
  let o = 0;
  for (const c of chunks) {
    out.set(c.subarray(0, Math.min(c.length, max - o)), o);
    o += c.length;
  }
  return out;
}

// ---- TMDB title list -----------------------------------------------------
async function tmdb(path) {
  const r = await fetch(
    `https://api.themoviedb.org/3${path}${path.includes('?') ? '&' : '?'}api_key=${TMDB_KEY}`,
  );
  return r.json();
}
async function pickTitles() {
  const movies = [];
  const tv = [];
  const seen = new Set();
  for (let page = 1; movies.length < MOVIE_N && page <= 12; page++) {
    const j = await tmdb(`/movie/popular?page=${page}`);
    for (const m of j.results || []) {
      if (movies.length >= MOVIE_N || seen.has(`m${m.id}`)) continue;
      seen.add(`m${m.id}`);
      movies.push({ type: 'movie', id: m.id, name: m.title });
    }
  }
  for (let page = 1; tv.length < TV_N && page <= 12; page++) {
    const j = await tmdb(`/tv/popular?page=${page}`);
    for (const s of j.results || []) {
      if (tv.length >= TV_N || seen.has(`t${s.id}`)) continue;
      seen.add(`t${s.id}`);
      tv.push({ type: 'tv', id: s.id, name: s.name, season: 1, episode: 1 });
    }
  }
  return [...movies, ...tv];
}

// ---- playability probe ---------------------------------------------------
// Returns { ok, reason }. Walks HLS manifest hops to a real segment; for mp4
// issues a Range request. Mirrors what hls.js / the <video> element would do.
async function probePlayable(src) {
  try {
    if (src.direct || isClientDirectHost(src.url)) {
      // Browser-equivalent: fetch the RAW url and let it follow keymi's 302, with
      // our origin as Referer (what the real player's request carries). No
      // server-side pre-resolve — that lands on an edge URL the browser can't use.
      const r = await fetchT(src.url, {
        headers: { Referer: 'https://snape.hussnainraza.cv/', 'User-Agent': UA },
        redirect: 'follow',
      });
      if (!r.ok) return { ok: false, reason: `direct ${r.status}` };
      if (r.headers.get('access-control-allow-origin') == null)
        return { ok: false, reason: 'direct no-ACAO' };
      const txt = await r.text();
      return txt.includes('#EXTM3U')
        ? { ok: true, reason: 'direct-hls' }
        : { ok: false, reason: 'direct not-hls' };
    }
    const signed = stripBase(await signedMediaUrl(src.url, src.headers));
    if (src.type === 'mp4') {
      const r = await fetchT(toLocal(`${signed}&v=1`), { headers: { Range: 'bytes=0-65535' } });
      if (r.status !== 200 && r.status !== 206) return { ok: false, reason: `mp4 ${r.status}` };
      const buf = await readHead(r);
      if (buf.length < 1024) return { ok: false, reason: `mp4 tiny ${buf.length}` };
      return { ok: true, reason: `mp4 ${r.status}` };
    }
    // hls: walk up to 3 hops to a segment
    let url = toLocal(signed);
    for (let hop = 0; hop < 4; hop++) {
      const r = await fetchT(url, { headers: { Range: 'bytes=0-65535' } });
      const ctype = r.headers.get('content-type') || '';
      if (!/mpegurl/i.test(ctype)) {
        // reached a segment (binary) — verify real bytes (head only)
        if (r.status !== 200 && r.status !== 206) return { ok: false, reason: `seg ${r.status}` };
        const buf = await readHead(r);
        if (buf.length < 256) return { ok: false, reason: `seg tiny ${buf.length}` };
        return { ok: true, reason: `seg 0x${buf[0]?.toString(16)}` };
      }
      const body = await r.text();
      if (!body.includes('#EXTM3U')) return { ok: false, reason: 'manifest not-hls' };
      const children = body.split('\n').filter((l) => l && !l.startsWith('#'));
      const leaked = children.filter(
        (l) => /letsgocdn|goodstream\.cc|\.shop/i.test(l) && !l.includes('/api/media-proxy'),
      );
      if (leaked.length) return { ok: false, reason: `LEAK ${leaked.length} raw seg urls` };
      const next = children[0];
      if (!next) return { ok: false, reason: 'manifest empty' };
      url = next.startsWith('http') ? toLocal(stripBase(next)) : LOCAL + next;
    }
    return { ok: false, reason: 'hls too many hops' };
  } catch (e) {
    return { ok: false, reason: `throw ${e?.message || e}` };
  }
}

// ---- per-title run --------------------------------------------------------
const stats = {};
for (const p of PROVIDERS)
  stats[p.label] = {
    titlesWith: 0,
    mp4: 0,
    hls: 0,
    statuses: {},
    playPass: 0,
    playFail: 0,
    playReasons: {},
  };
const titleResults = [];

async function runTitleSafe(t) {
  try {
    await runTitle(t);
  } catch (e) {
    console.log(`[ERR] ${t.type} ${t.id} ${t.name}: ${e?.message || e}`);
  }
}
async function runTitle(t) {
  const res = { ...t, providers: {}, playable: false };
  const tasks = PROVIDERS.map(async (p) => {
    const r = await fetchProvider(p, t.type, String(t.id), t.season, t.episode);
    const st = stats[p.label];
    if (!r.raw || !(r.raw.sources ?? []).some((s) => typeof s.url === 'string')) {
      const key = String(r.status);
      st.statuses[key] = (st.statuses[key] || 0) + 1;
      res.providers[p.label] = { status: r.status, mp4: 0, hls: 0 };
      return;
    }
    const { sources } = collectProviderSources(r.raw, p.label);
    const mp4 = sources.filter((s) => s.type === 'mp4');
    const hls = sources.filter((s) => s.type === 'hls');
    st.titlesWith++;
    if (mp4.length) st.mp4++;
    if (hls.length) st.hls++;
    st.statuses['200ok'] = (st.statuses['200ok'] || 0) + 1;
    // Try this provider's sources in the player's failover order (mp4 first, then
    // a non-keymi hls, then keymi/goodstream) until one PLAYS — mirrors how the
    // real player auto-advances within a provider (e.g. mp4 451 → hls fallback).
    // Dedupe identical URLs (keymi often returns the same URL 4-6×).
    const ordered = [...mp4, ...hls];
    const tried = new Set();
    let play = { ok: false, reason: 'no-sources' };
    for (const cand of ordered) {
      if (tried.has(cand.url)) continue;
      tried.add(cand.url);
      play = await probePlayable(cand);
      if (play.ok) break;
    }
    if (play.ok) st.playPass++;
    else st.playFail++;
    st.playReasons[play.reason] = (st.playReasons[play.reason] || 0) + 1;
    if (play.ok) res.playable = true;
    res.providers[p.label] = {
      status: r.status,
      mp4: mp4.length,
      hls: hls.length,
      play: play.ok ? 'PASS' : `FAIL:${play.reason}`,
    };
  });
  await Promise.all(tasks);
  titleResults.push(res);
  const summ = Object.entries(res.providers)
    .map(([k, v]) => `${k}:${v.mp4 + v.hls > 0 ? `${v.mp4}m/${v.hls}h ${v.play || ''}` : v.status}`)
    .join('  ');
  console.log(
    `[${res.playable ? 'OK ' : 'XX '}] ${t.type} ${t.id} ${(t.name || '').slice(0, 28).padEnd(28)} ${summ}`,
  );
}

// limited concurrency over titles
async function pool(items, n, fn) {
  let i = 0;
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (i < items.length) {
        const idx = i++;
        await fn(items[idx]);
      }
    }),
  );
}

const rawTitles = await pickTitles();
const seen = new Set();
const titles = rawTitles.filter((t) => {
  const k = `${t.type}:${t.id}`;
  if (seen.has(k)) return false;
  seen.add(k);
  return true;
});
console.log(
  `Testing ${titles.length} unique titles (${MOVIE_N} movies, ${TV_N} tv) via ${LOCAL}\n`,
);
const t0 = Date.now();
await pool(titles, 3, runTitleSafe);

// ---- report ---------------------------------------------------------------
console.log(
  `\n===== PROVIDER REPORT (${titles.length} titles, ${((Date.now() - t0) / 1000).toFixed(0)}s) =====`,
);
for (const p of PROVIDERS) {
  const s = stats[p.label];
  console.log(`\n${p.label} (${p.path}@${p.api.replace('https://', '')})`);
  console.log(
    `  titles with sources: ${s.titlesWith}/${titles.length}   (mp4:${s.mp4}  hls:${s.hls})`,
  );
  console.log(`  extraction statuses: ${JSON.stringify(s.statuses)}`);
  console.log(
    `  playback: PASS ${s.playPass} / FAIL ${s.playFail}   reasons: ${JSON.stringify(s.playReasons)}`,
  );
}
const anyPlayable = titleResults.filter((r) => r.playable).length;
const noSourceTitles = titleResults.filter((r) =>
  Object.values(r.providers).every((v) => v.mp4 + v.hls === 0),
);
console.log('\n===== OVERALL =====');
console.log(`titles with >=1 PLAYABLE source: ${anyPlayable}/${titles.length}`);
console.log(`titles with NO source from any provider: ${noSourceTitles.length}/${titles.length}`);
console.log(
  `titles that HAD sources but NONE played: ${titles.length - anyPlayable - noSourceTitles.length}`,
);
if (titles.length - anyPlayable - noSourceTitles.length > 0) {
  console.log('  ^ these are the real bugs (source exists but playback failed):');
  for (const r of titleResults) {
    const had = Object.values(r.providers).some((v) => v.mp4 + v.hls > 0);
    if (had && !r.playable) {
      console.log(
        `   ${r.type} ${r.id} ${r.name}: ${Object.entries(r.providers)
          .filter(([, v]) => v.play && v.play !== 'PASS')
          .map(([k, v]) => `${k} ${v.play}`)
          .join(' | ')}`,
      );
    }
  }
}
