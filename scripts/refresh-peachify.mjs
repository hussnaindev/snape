// Refresh the reverse-engineered Peachify constants (AES key + providers) by
// scraping the live player bundle, then VERIFY by actually decrypting a real
// source payload. Run this when playback breaks with "No sources found" and the
// Netlify function shows upstream 200s (i.e. Peachify rotated its internals).
//
// Usage:
//   node scripts/refresh-peachify.mjs            # detect + verify, print results
//   node scripts/refresh-peachify.mjs --write    # also patch netlify/functions/extract.mjs
//
// Notes:
// - The player bundle + static chunks are CDN-served (NOT IP-blocked), so this
//   works from anywhere with no proxy.
// - The VERIFY step calls the eat-peach source API, which blocks datacenter IPs.
//   Run it from a residential connection, OR set PROXY_LIST (same format as the
//   Netlify env var) to route the verify fetch through a proxy.

import { readFileSync, writeFileSync } from 'node:fs';

const EMBED = 'https://peachify.top/embed/movie/1022789?accent=E50914&cast=hide';
const REFERER = 'https://peachify.top/';
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
const EXTRACT_FILE = new URL('../netlify/functions/extract.mjs', import.meta.url);

// ---- optional proxy for the verify fetch --------------------------------
async function proxyDispatcher() {
  const raw = process.env.PROXY_LIST ?? '';
  const list = raw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (list.length === 0) return undefined;
  const [host, port, user, pass] = list[Math.floor(Math.random() * list.length)].split(':');
  const auth = user && pass ? `${encodeURIComponent(user)}:${encodeURIComponent(pass)}@` : '';
  const { ProxyAgent } = await import('undici');
  return new ProxyAgent(`http://${auth}${host}:${port}`);
}

// ---- decrypt (mirrors extract.mjs) --------------------------------------
function b64urlToBytes(input) {
  const norm = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = norm.length % 4 === 0 ? '' : '='.repeat(4 - (norm.length % 4));
  return new Uint8Array(Buffer.from(norm + pad, 'base64'));
}
function hexToBytes(hex) {
  return new Uint8Array(hex.match(/.{1,2}/g).map((h) => Number.parseInt(h, 16)));
}
async function tryDecrypt(data, keyHex) {
  try {
    const [iv, salt, ct] = data.split('.');
    const ivB = b64urlToBytes(iv);
    const saltB = b64urlToBytes(salt);
    const ctB = b64urlToBytes(ct);
    const sealed = new Uint8Array(saltB.length + ctB.length);
    sealed.set(saltB, 0);
    sealed.set(ctB, saltB.length);
    const key = await crypto.subtle.importKey('raw', hexToBytes(keyHex), { name: 'AES-GCM' }, false, [
      'decrypt',
    ]);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivB }, key, sealed);
    return JSON.parse(new TextDecoder().decode(plain));
  } catch {
    return null;
  }
}

// ---- scrape the bundle ---------------------------------------------------
async function getBundleText() {
  const html = await (await fetch(EMBED, { headers: { 'User-Agent': UA } })).text();
  const chunks = [...html.matchAll(/\/_next\/static\/chunks\/[^"']+\.js/g)].map((m) => m[0]);
  const unique = [...new Set(chunks)];
  let all = '';
  for (const path of unique) {
    try {
      all += await (await fetch(`https://peachify.top${path}`, { headers: { 'User-Agent': UA } })).text();
      all += '\n';
    } catch {}
  }
  return all;
}

function extractProviders(js) {
  // Matches the ee=[{label:"..",path:"..",apis:["https://..eat-peach.sbs"]}] array.
  const blocks = [...js.matchAll(/\{label:"([^"]+)",path:"([^"]+)",apis:\[([^\]]*)\]\}/g)];
  const seen = new Set();
  const providers = [];
  for (const m of blocks) {
    const apis = [...m[3].matchAll(/"([^"]+)"/g)].map((a) => a[1]);
    const api = apis.find((a) => a.includes('eat-peach.sbs')) ?? apis[0];
    if (!api) continue;
    const key = `${m[2]}|${api}`;
    if (seen.has(key)) continue;
    seen.add(key);
    providers.push({ label: m[1], path: m[2], api });
  }
  return providers;
}

function extractKeyCandidates(js) {
  // 64-char hex string literals — the AES-256 key is one of these.
  return [...new Set([...js.matchAll(/"([0-9a-f]{64})"/g)].map((m) => m[1]))];
}

async function fetchOnePayload(providers) {
  const dispatcher = await proxyDispatcher();
  const opts = { headers: { Referer: REFERER, 'User-Agent': UA } };
  if (dispatcher) {
    const { fetch: uFetch } = await import('undici');
    for (const p of providers) {
      try {
        const r = await uFetch(`${p.api}/${p.path}/movie/1022789`, { ...opts, dispatcher });
        if (!r.ok) continue;
        const j = await r.json();
        if (j?.isEncrypted && j.data) return j.data;
      } catch {}
    }
    return null;
  }
  for (const p of providers) {
    try {
      const r = await fetch(`${p.api}/${p.path}/movie/1022789`, opts);
      if (!r.ok) continue;
      const j = await r.json();
      if (j?.isEncrypted && j.data) return j.data;
    } catch {}
  }
  return null;
}

// ---- main ----------------------------------------------------------------
const write = process.argv.includes('--write');

console.log('Scraping Peachify bundle…');
const js = await getBundleText();
const providers = extractProviders(js);
const keyCandidates = extractKeyCandidates(js);

console.log(`\nProviders found (${providers.length}):`);
for (const p of providers) console.log(`  ${p.label}  ${p.path}  ${p.api}`);
console.log(`\n64-hex key candidates (${keyCandidates.length}):`);
for (const k of keyCandidates) console.log(`  ${k}`);

if (providers.length === 0 || keyCandidates.length === 0) {
  console.error('\n❌ Could not locate providers and/or key — the bundle structure likely changed.');
  console.error('   Inspect a chunk manually: look for `{label:..,path:..,apis:[..]}` and the');
  console.error('   64-hex string passed to the AES-GCM decrypt call.');
  process.exit(1);
}

console.log('\nVerifying by decrypting a real payload…');
const payload = await fetchOnePayload(providers);
if (!payload) {
  console.error('❌ Could not fetch a source payload (datacenter IP blocked? set PROXY_LIST, or run');
  console.error('   from a residential connection). Candidates above are unverified.');
  process.exit(1);
}

let confirmedKey = null;
for (const k of keyCandidates) {
  const dec = await tryDecrypt(payload, k);
  if (dec?.sources) {
    confirmedKey = k;
    break;
  }
}

if (!confirmedKey) {
  console.error('❌ None of the candidate keys decrypted the payload. The decrypt scheme may have');
  console.error('   changed (not just the key) — inspect functions dD/dC/dP in the bundle.');
  process.exit(1);
}

console.log(`\n✅ Confirmed AES key: ${confirmedKey}`);
console.log(`✅ Confirmed ${providers.length} providers.`);

if (!write) {
  console.log('\nRun again with --write to patch netlify/functions/extract.mjs.');
  process.exit(0);
}

// ---- patch extract.mjs ---------------------------------------------------
let src = readFileSync(EXTRACT_FILE, 'utf8');
src = src.replace(/const AES_KEY_HEX = '[0-9a-f]+';/, `const AES_KEY_HEX = '${confirmedKey}';`);
const provLiteral = providers
  .map((p) => `  { label: '${p.label}', path: '${p.path}', api: '${p.api}' },`)
  .join('\n');
src = src.replace(/const PROVIDERS = \[[\s\S]*?\];/, `const PROVIDERS = [\n${provLiteral}\n];`);
writeFileSync(EXTRACT_FILE, src);
console.log('\n✅ Patched netlify/functions/extract.mjs. Commit, push, and redeploy Netlify.');
