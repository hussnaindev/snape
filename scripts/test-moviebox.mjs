#!/usr/bin/env node
// Local feasibility check for MovieBox scraping (same fetch path as CF edge).
// Usage: MOVIEBOX_BEARER=… [MOVIEBOX_MB_TOKEN=…] [MOVIEBOX_TOKEN=…] node scripts/test-moviebox.mjs [keyword]

import './load-env.mjs';

const H5_API = 'https://h5-api.aoneroom.com/wefeed-h5api-bff';
const SITE = 'https://movie-box.co';
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36';
const CLIENT_INFO = '{"timezone":"Asia/Karachi"}';

const bearer = process.env.MOVIEBOX_BEARER?.trim();
const mbToken = (process.env.MOVIEBOX_MB_TOKEN ?? bearer)?.trim();
const token = (process.env.MOVIEBOX_TOKEN ?? bearer)?.trim();
const keyword = process.argv[2] ?? 'o romeo';

if (!bearer || !mbToken || !token) {
  console.error('Set MOVIEBOX_BEARER (and optionally MOVIEBOX_MB_TOKEN, MOVIEBOX_TOKEN)');
  process.exit(1);
}

function playCookie() {
  return `mb_token=%22${encodeURIComponent(mbToken)}%22; i18n_lang=en; token=${token}`;
}

async function search() {
  const res = await fetch(`${H5_API}/subject/search`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${bearer}`,
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
  return json.data.items ?? [];
}

async function play(subjectId, detailPath) {
  const url = new URL(`${SITE}/wefeed-h5api-bff/subject/play`);
  url.searchParams.set('subjectId', subjectId);
  url.searchParams.set('se', '0');
  url.searchParams.set('ep', '0');
  url.searchParams.set('detailPath', detailPath);

  const res = await fetch(url, {
    headers: {
      accept: 'application/json',
      cookie: playCookie(),
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
  return json.data.streams ?? [];
}

async function captions(streamId, subjectId, detailPath) {
  const url = new URL(`${H5_API}/subject/caption`);
  url.searchParams.set('format', 'MP4');
  url.searchParams.set('id', streamId);
  url.searchParams.set('subjectId', subjectId);
  url.searchParams.set('detailPath', detailPath);

  const res = await fetch(url, {
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
  return json.data.captions ?? [];
}

console.log(`[moviebox] resolving "${keyword}"…`);
try {
  const items = await search();
  const subject = items.find((i) => i.hasResource) ?? items[0];
  if (!subject) throw new Error('No search results');
  console.log('[moviebox] subject:', subject.title, subject.subjectId, subject.detailPath);

  const streams = await play(subject.subjectId, subject.detailPath);
  console.log('[moviebox] streams:', streams.length);
  for (const s of streams) {
    console.log(`  - ${s.resolutions}p id=${s.id} url=${s.url.slice(0, 72)}…`);
  }
  if (streams.length === 0) throw new Error('No streams — check cookies / headers');

  const caps = await captions(streams[0].id, subject.subjectId, subject.detailPath);
  console.log('[moviebox] captions:', caps.length);
  for (const c of caps) {
    console.log(`  - ${c.lanName} (${c.lan})`);
  }

  const res = await fetch(streams[0].url, {
    headers: { referer: `${SITE}/`, range: 'bytes=0-15' },
  });
  console.log(`[moviebox] CDN probe: HTTP ${res.status}, type=${res.headers.get('content-type')}`);
  if (!res.ok) process.exit(2);

  console.log('[moviebox] OK — feasible on edge fetch');
} catch (err) {
  console.error('[moviebox] FAIL:', err.message ?? err);
  process.exit(1);
}
