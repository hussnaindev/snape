import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto';
import { ProxyAgent, fetch as uFetch } from 'undici';

const MOBILE_API = 'https://api.inmoviebox.com/wefeed-mobile-bff';
const MOBILE_SEARCH_PATH = '/wefeed-mobile-bff/subject-api/search';
const MOBILE_SECRET_KEY = process.env.MOVIEBOX_SECRET_KEY?.trim() || '76iRl07s0xSN9jqmEWAt79EBJZulIQIsV64FZr2O';

const TARGET_WORDS = new Set([
  'tushy', 'blacked', 'vixen', 'blackedraw', 'tushyraw',
  'slayed', 'milfy', 'wifey', 'deeper'
]);

const QUERIES = ['adult', 'xxx'];
const SUBJECT_TYPES = [1, 2];
const MAX_PAGES = 30;

const PROXY_LIST = (process.env.PROXY_LIST ?? '').split(/[\n,]+/).map(s => s.trim()).filter(Boolean);

function b64DecodeKey(value) { return Buffer.from(value, 'base64'); }
function md5Hex(buf) { return createHash('md5').update(buf).digest('hex'); }

function xClientToken(ts) {
  const s = String(ts);
  return `${s},${md5Hex(Buffer.from([...s].reverse().join(''), 'utf8'))}`;
}

function xTrSignature(path, body, ts) {
  const bodyBytes = Buffer.from(body, 'utf8');
  const bodyHash = md5Hex(bodyBytes.subarray(0, 102400));
  const canonical = [
    'POST', 'application/json', 'application/json',
    String(bodyBytes.length), String(ts), bodyHash, path,
  ].join('\n');
  const mac = createHmac('md5', b64DecodeKey(MOBILE_SECRET_KEY))
    .update(canonical, 'utf8').digest('base64');
  return `${ts}|2|${mac}`;
}

function mobileClientInfo() {
  return JSON.stringify({
    package_name: 'com.community.oneroom',
    version_name: '3.0.03.0529.03',
    version_code: 50020044, os: 'android', os_version: '13',
    install_ch: 'ps', device_id: randomBytes(16).toString('hex'),
    install_store: 'ps', gaid: randomUUID(), brand: 'Redmi',
    model: '23078RKD5C', system_language: 'en', net: 'NETWORK_WIFI',
    region: 'US', timezone: 'America/New_York', sp_code: '40401', 'X-Play-Mode': '2',
  });
}

const MOBILE_UA = 'com.community.oneroom/50020044 (Linux; U; Android 13; en_US; 23078RKD5C; Build/TQ2A.230405.003; Cronet/135.0.7012.3)';

function pickProxyAgent() {
  if (PROXY_LIST.length === 0) return undefined;
  const entry = PROXY_LIST[Math.floor(Math.random() * PROXY_LIST.length)];
  const [host, port, user, pass] = entry.split(':');
  if (!host || !port) return undefined;
  const a = user && pass ? `${encodeURIComponent(user)}:${encodeURIComponent(pass)}@` : '';
  return new ProxyAgent(`http://${a}${host}:${port}`);
}

async function mobileSearch(keyword, subjectType, page = 1) {
  const body = JSON.stringify({ keyword, page, perPage: 20, subjectType });
  const ts = Date.now();
  const res = await uFetch(`${MOBILE_API}/subject-api/search`, {
    method: 'POST',
    headers: {
      Accept: 'application/json', Connection: 'keep-alive',
      'Content-Type': 'application/json', 'User-Agent': MOBILE_UA,
      'X-Client-Info': mobileClientInfo(), 'X-Client-Status': '0',
      'X-Client-Token': xClientToken(ts),
      'x-tr-signature': xTrSignature(MOBILE_SEARCH_PATH, body, ts),
    },
    body, dispatcher: pickProxyAgent(),
  });
  if (!res.ok) throw new Error(`mobile search HTTP ${res.status}`);
  const json = await res.json();
  if (json.code !== 0) throw new Error(`mobile search API ${json.code}`);
  return json.data;
}

function getFirstWord(title) {
  if (!title) return '';
  return title.trim().split(/\s+/)[0].toLowerCase();
}

async function searchAllPages(keyword, subjectType) {
  const typeLabel = subjectType === 1 ? 'movies' : 'series';
  console.log(`\nSearching "${keyword}" (${typeLabel})...`);

  const allItems = [];
  const PER_PAGE = 20;

  for (let page = 1; page <= MAX_PAGES; page++) {
    let data;
    try {
      data = await mobileSearch(keyword, subjectType, page);
    } catch (err) {
      console.log(`  Page ${page}: ERROR - ${err.message}`);
      break;
    }

    const items = data?.items ?? [];
    console.log(`  Page ${page}: ${items.length} items`);
    for (const item of items) {
      allItems.push({
        subjectId: item.subjectId, title: item.title, postTitle: item.postTitle,
        releaseDate: item.releaseDate, subjectType: item.subjectType,
        duration: item.duration ?? item.durationSeconds,
      });
    }

    // Stop if we got fewer items than perPage (last page)
    if (items.length < PER_PAGE) break;
  }

  return allItems;
}

async function main() {
  console.log('=== MovieBox Search Test ===');
  console.log(`Target studios: ${[...TARGET_WORDS].join(', ')}`);
  console.log(`Max pages per query: ${MAX_PAGES}`);
  console.log(`Proxies available: ${PROXY_LIST.length}`);

  const results = {};

  for (const query of QUERIES) {
    for (const st of SUBJECT_TYPES) {
      const items = await searchAllPages(query, st);
      const key = `${query}|${st}`;
      results[key] = { all: items, matching: [] };

      for (const item of items) {
        const firstWord = getFirstWord(item.title);
        if (TARGET_WORDS.has(firstWord)) {
          results[key].matching.push(item);
        }
      }

      const matchCount = results[key].matching.length;
      console.log(`  => Matching: ${matchCount}/${items.length}`);
      for (const m of results[key].matching) {
        console.log(`     [${m.subjectId}] ${m.title}${m.releaseDate ? ` (${m.releaseDate})` : ''}`);
      }
    }
  }

  console.log('\n=== SUMMARY ===');
  let grandTotal = 0, grandMatching = 0;
  for (const key of Object.keys(results)) {
    const [query, st] = key.split('|');
    const typeLabel = st === '1' ? 'movies' : 'series';
    const r = results[key];
    grandTotal += r.all.length;
    grandMatching += r.matching.length;
    console.log(`"${query}" ${typeLabel}: ${r.matching.length} matching / ${r.all.length} total`);
  }
  console.log(`\nGrand total: ${grandTotal}`);
  console.log(`Total matching titles (first word matches target studio): ${grandMatching}`);
  console.log('Done.');
}

main().catch(console.error);
