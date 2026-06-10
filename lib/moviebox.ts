import { signedMediaUrl } from '@/lib/media-sign';

const H5_API = 'https://h5-api.aoneroom.com/wefeed-h5api-bff';
const SITE = 'https://movie-box.co';

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36';

const CLIENT_INFO = '{"timezone":"Asia/Karachi"}';

/** Headers the hakunaymatata CDN expects when fetching MP4 / subtitles. */
export const MOVIEBOX_CDN_HEADERS = {
  referer: `${SITE}/`,
  'user-agent': UA,
};

export type MovieboxAuth = {
  bearer: string;
  mbToken: string;
  token: string;
};

export type MovieboxSearchItem = {
  subjectId: string;
  title: string;
  detailPath: string;
  hasResource: boolean;
  genre?: string;
  releaseDate?: string;
};

type ApiEnvelope<T> = { code: number; message: string; data: T };

// TEMP: hardcoded guest session for prod feasibility testing.
// Remove once Browser Run + KV refresh is in place. Env vars override these.
const MOVIEBOX_AUTH_FALLBACK: MovieboxAuth = {
  bearer:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOjczNDAzNTIwNjY4Njk1MjI0NTYsImF0cCI6MywiZXh0IjoiMTc4MTEyMDcwNiIsImV4cCI6MTc4ODg5NjcwNiwiaWF0IjoxNzgxMTIwNDA2fQ.gZ3d-RXw--3L9gkP-d0HEQJw4v9yF4kKBCib2O65S_U',
  mbToken:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOjczNDAzNTIwNjY4Njk1MjI0NTYsImF0cCI6MywiZXh0IjoiMTc4MTEyMDcwNiIsImV4cCI6MTc4ODg5NjcwNiwiaWF0IjoxNzgxMTIwNDA2fQ.gZ3d-RXw--3L9gkP-d0HEQJw4v9yF4kKBCib2O65S_U',
  token:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOjg1MTUwOTQyODc1ODIzNzM2OCwiYXRwIjozLCJleHQiOiIxNzgxMTIwNzI2IiwiZXhwIjoxNzg4ODk2NzI2LCJpYXQiOjE3ODExMjA0MjZ9.LznAOxQ-2ziRIxOmYht7GSWXaGf0BM1DPBN0EAfe6d0',
};

export function movieboxAuthFromEnv(): MovieboxAuth {
  const bearer = process.env.MOVIEBOX_BEARER?.trim();
  const mbToken = (process.env.MOVIEBOX_MB_TOKEN ?? bearer)?.trim();
  const token = (process.env.MOVIEBOX_TOKEN ?? bearer)?.trim();
  if (bearer && mbToken && token) return { bearer, mbToken, token };
  return MOVIEBOX_AUTH_FALLBACK;
}

function playCookie(auth: MovieboxAuth): string {
  return `mb_token=%22${encodeURIComponent(auth.mbToken)}%22; i18n_lang=en; token=${auth.token}`;
}

function h5Headers(auth: MovieboxAuth, referer: string): HeadersInit {
  return {
    accept: 'application/json',
    authorization: `Bearer ${auth.bearer}`,
    'content-type': 'application/json',
    origin: SITE,
    referer,
    'user-agent': UA,
    'x-client-info': CLIENT_INFO,
    'x-request-lang': 'en',
  };
}

function playHeaders(auth: MovieboxAuth, detailPath: string, subjectId: string): HeadersInit {
  return {
    accept: 'application/json',
    'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8',
    cookie: playCookie(auth),
    referer: `${SITE}/movies/${detailPath}?id=${subjectId}&type=/movie/detail&lang=en`,
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin',
    'user-agent': UA,
    'x-client-info': CLIENT_INFO,
    'x-source': '',
  };
}

export async function movieboxSearch(
  keyword: string,
  auth: MovieboxAuth,
  page = 1,
): Promise<MovieboxSearchItem[]> {
  const res = await fetch(`${H5_API}/subject/search`, {
    method: 'POST',
    headers: h5Headers(auth, `${SITE}/web/searchResult?keyword=${encodeURIComponent(keyword)}`),
    body: JSON.stringify({ keyword, page, perPage: 28, subjectType: 0 }),
  });
  if (!res.ok) throw new Error(`search HTTP ${res.status}`);
  const json = (await res.json()) as ApiEnvelope<{ items: MovieboxSearchItem[] }>;
  if (json.code !== 0) throw new Error(`search API ${json.code}: ${json.message}`);
  return json.data.items ?? [];
}

export type MovieboxStream = {
  id: string;
  format: string;
  url: string;
  resolutions: string;
  size: string;
  duration: number;
};

export async function movieboxPlay(
  subjectId: string,
  detailPath: string,
  auth: MovieboxAuth,
  se = 0,
  ep = 0,
): Promise<MovieboxStream[]> {
  const url = new URL(`${SITE}/wefeed-h5api-bff/subject/play`);
  url.searchParams.set('subjectId', subjectId);
  url.searchParams.set('se', String(se));
  url.searchParams.set('ep', String(ep));
  url.searchParams.set('detailPath', detailPath);

  const res = await fetch(url.toString(), { headers: playHeaders(auth, detailPath, subjectId) });
  if (!res.ok) throw new Error(`play HTTP ${res.status}`);
  const json = (await res.json()) as ApiEnvelope<{ streams: MovieboxStream[]; hasResource: boolean }>;
  if (json.code !== 0) throw new Error(`play API ${json.code}: ${json.message}`);
  return json.data.streams ?? [];
}

export type MovieboxCaption = {
  id: string;
  lan: string;
  lanName: string;
  url: string;
};

export async function movieboxCaptions(
  streamId: string,
  subjectId: string,
  detailPath: string,
): Promise<MovieboxCaption[]> {
  const url = new URL(`${H5_API}/subject/caption`);
  url.searchParams.set('format', 'MP4');
  url.searchParams.set('id', streamId);
  url.searchParams.set('subjectId', subjectId);
  url.searchParams.set('detailPath', detailPath);

  const res = await fetch(url.toString(), {
    headers: {
      accept: 'application/json',
      origin: SITE,
      referer: `${SITE}/movies/${detailPath}?id=${subjectId}`,
      'user-agent': UA,
      'x-client-info': CLIENT_INFO,
    },
  });
  if (!res.ok) throw new Error(`caption HTTP ${res.status}`);
  const json = (await res.json()) as ApiEnvelope<{ captions: MovieboxCaption[] }>;
  if (json.code !== 0) throw new Error(`caption API ${json.code}: ${json.message}`);
  return json.data.captions ?? [];
}

export type SignedStreamSource = {
  type: 'mp4' | 'hls';
  url: string;
  quality: number | null;
  dub: string | null;
  provider: string;
};

export type SignedSubtitle = {
  url: string;
  label: string | null;
  lang: string | null;
};

/** Resolve search → play → captions and mint signed media-proxy URLs. */
export async function movieboxResolveSources(opts: {
  auth: MovieboxAuth;
  keyword?: string;
  subjectId?: string;
  detailPath?: string;
  se?: number;
  ep?: number;
}): Promise<{
  subject: MovieboxSearchItem;
  sources: SignedStreamSource[];
  subtitles: SignedSubtitle[];
}> {
  let subject: MovieboxSearchItem | undefined;
  const { auth, keyword, se = 0, ep = 0 } = opts;

  if (opts.subjectId && opts.detailPath) {
    subject = {
      subjectId: opts.subjectId,
      detailPath: opts.detailPath,
      title: '',
      hasResource: true,
    };
  } else if (keyword) {
    const items = await movieboxSearch(keyword, auth);
    subject = items.find((i) => i.hasResource) ?? items[0];
    if (!subject) throw new Error('No search results');
  } else {
    throw new Error('keyword or subjectId+detailPath required');
  }

  const streams = await movieboxPlay(subject.subjectId, subject.detailPath, auth, se, ep);
  if (streams.length === 0) throw new Error('No streams returned');

  const sources: SignedStreamSource[] = await Promise.all(
    streams.map(async (s) => {
      const quality = Number.parseInt(s.resolutions, 10) || null;
      const signed = await signedMediaUrl(s.url, MOVIEBOX_CDN_HEADERS);
      return {
        type: 'mp4' as const,
        url: `${signed}&v=1`,
        quality,
        dub: 'Original Audio',
        provider: 'MovieBox',
      };
    }),
  );
  sources.sort((a, b) => (b.quality ?? 0) - (a.quality ?? 0));

  const primary = streams[0];
  if (!primary) throw new Error('No streams returned');

  const captions = await movieboxCaptions(primary.id, subject.subjectId, subject.detailPath);
  const subtitles: SignedSubtitle[] = await Promise.all(
    captions.map(async (c) => ({
      url: `${await signedMediaUrl(c.url, MOVIEBOX_CDN_HEADERS)}&sub=1`,
      label: c.lanName,
      lang: c.lan,
    })),
  );

  return { subject, sources, subtitles };
}
