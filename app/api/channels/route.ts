import { getSession } from '@/lib/session';
import { parseChannelName } from '@/lib/parse-channel-name';
import type { Channel } from '@/types/channels';

export const runtime = 'edge';

const FETCH_CATEGORIES = [
  'general',
  'news',
  'entertainment',
  'sports',
  'movies',
  'music',
  'kids',
  'documentary',
  'series',
  'lifestyle',
  'science',
  'nature',
  'travel',
  'comedy',
  'business',
  'cooking',
  'education',
  'family',
  'weather',
  'auto',
];

function parseM3U(content: string, defaultCategory: string): Channel[] {
  const channels: Channel[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (!line.startsWith('#EXTINF:')) continue;

    const urlLine = lines[i + 1]?.trim() ?? '';
    if (!urlLine || urlLine.startsWith('#') || !urlLine.startsWith('http')) continue;

    const tvgId = line.match(/tvg-id="([^"]*)"/)?.[1] ?? '';
    const tvgLogo = line.match(/tvg-logo="([^"]*)"/)?.[1] ?? '';
    const groupTitle = line.match(/group-title="([^"]*)"/)?.[1] ?? defaultCategory;
    const countryAttr = line.match(/tvg-country="([^"]*)"/)?.[1] ?? '';
    const langAttr = line.match(/tvg-language="([^"]*)"/)?.[1] ?? '';

    const commaIdx = line.lastIndexOf(',');
    const rawName = commaIdx >= 0 ? line.slice(commaIdx + 1).trim() : '';
    if (!rawName) continue;

    const { name, tags } = parseChannelName(rawName);

    channels.push({
      id: tvgId || `${defaultCategory}-${i}`,
      name,
      logo: tvgLogo,
      country: countryAttr.toUpperCase(),
      languages: langAttr ? [langAttr] : [],
      categories: [(groupTitle.toLowerCase() || defaultCategory)],
      streamUrl: urlLine,
      tags,
    });

    i++;
  }

  return channels;
}

const NSFW_CHANNELS: Channel[] = [
  { id: 'carac1', name: 'CARAC1', logo: '', country: '', languages: [], categories: ['nsfw'], streamUrl: 'http://edge14.vedge.infomaniak.com/livecast/event.stream/playlist.m3u8', tags: [] },
  { id: 'carac5', name: 'CARAC5', logo: '', country: '', languages: [], categories: ['nsfw'], streamUrl: 'https://edge14.vedge.infomaniak.com/livecast/ik:carac5/playlist.m3u8', tags: [] },
  { id: 'dmf', name: 'DMF', logo: '', country: '', languages: [], categories: ['nsfw'], streamUrl: 'https://d-m-f.iptv-playoutcenter.de/dmf/dmf1/playlist.m3u8', tags: [] },
  { id: 'babes', name: 'Babes', logo: '', country: '', languages: [], categories: ['nsfw'], streamUrl: 'http://88.212.7.11/live/test_basbes_hd_hevc/playlist.m3u8', tags: [] },
  { id: 'brazzers', name: 'Brazzers', logo: '', country: '', languages: [], categories: ['nsfw'], streamUrl: 'http://88.212.7.11/live/test_brazzers_hd_hevc/playlist.m3u8', tags: [] },
  { id: 'extasy', name: 'Extasy', logo: '', country: '', languages: [], categories: ['nsfw'], streamUrl: 'http://88.212.7.11/live/test_extasy_hd_hevc/playlist.m3u8', tags: [] },
  { id: 'desire', name: 'Desire', logo: '', country: '', languages: [], categories: ['nsfw'], streamUrl: 'http://88.212.7.11/live/test_desire_hd_hevc/playlist.m3u8', tags: [] },
  { id: 'erox', name: 'Erox', logo: '', country: '', languages: [], categories: ['nsfw'], streamUrl: 'http://88.212.7.11/live/test_erox_hd_hevc/playlist.m3u8', tags: [] },
  { id: 'eroxxx', name: 'Eroxxx', logo: '', country: '', languages: [], categories: ['nsfw'], streamUrl: 'http://88.212.7.11/live/test_eroxxx_hd_hevc/playlist.m3u8', tags: [] },
  { id: 'dorcel', name: 'Dorcel', logo: '', country: '', languages: [], categories: ['nsfw'], streamUrl: 'http://88.212.7.11/live/test_dorcel_hd_hevc/playlist.m3u8', tags: [] },
  { id: 'leo', name: 'Leo', logo: '', country: '', languages: [], categories: ['nsfw'], streamUrl: 'http://88.212.7.11/live/test_leo_hd_hevc/playlist.m3u8', tags: [] },
  { id: 'leo-gold', name: 'Leo Gold', logo: '', country: '', languages: [], categories: ['nsfw'], streamUrl: 'http://88.212.7.11/live/test_leogold_hd_hevc/playlist.m3u8', tags: [] },
  { id: 'reality-kings', name: 'Reality Kings', logo: '', country: '', languages: [], categories: ['nsfw'], streamUrl: 'http://88.212.7.11/live/test_realitykings_sd_hevc/playlist.m3u8', tags: [] },
  { id: 'dusk', name: 'Dusk', logo: '', country: '', languages: [], categories: ['nsfw'], streamUrl: 'http://88.212.7.11/live/test_dusk_sd_hevc/playlist.m3u8', tags: [] },
  { id: 'playboy-la', name: 'Playboy La', logo: '', country: '', languages: [], categories: ['nsfw'], streamUrl: 'http://190.11.225.124:5000/live/playboy_hd/playlist.m3u8', tags: [] },
  { id: 'babes-tv', name: 'Babes TV', logo: '', country: '', languages: [], categories: ['nsfw'], streamUrl: 'https://cdn4.skygo.mn/live/disk1/Babes/HLSv3-FTA/Babes.m3u8', tags: [] },
  { id: 'brazzers-tv', name: 'Brazzers TV', logo: '', country: '', languages: [], categories: ['nsfw'], streamUrl: 'http://78.130.250.2:8023/play/a06f/index.m3u8', tags: [] },
  { id: 'dorcel-tv-hd', name: 'DORCEL TV HD', logo: '', country: '', languages: [], categories: ['nsfw'], streamUrl: 'http://78.130.250.2:8023/play/a069/index.m3u8', tags: [] },
  { id: 'redlight-hd', name: 'Redlight HD', logo: '', country: '', languages: [], categories: ['nsfw'], streamUrl: 'http://78.130.250.2:8023/play/a05q/index.m3u8', tags: [] },
  { id: 'blue-hustler-xxx', name: 'Blue Hustler XXX', logo: '', country: '', languages: [], categories: ['nsfw'], streamUrl: 'http://78.130.250.2:8023/play/a03g/index.m3u8', tags: [] },
  { id: 'pink-erotic-3', name: 'PINK EROTIC 3', logo: '', country: '', languages: [], categories: ['nsfw'], streamUrl: 'http://143.244.63.87/pinkerotic3/playlist.m3u8', tags: [] },
  { id: 'pink-erotic-2', name: 'PINK EROTIC 2', logo: '', country: '', languages: [], categories: ['nsfw'], streamUrl: 'http://143.244.63.87/pinkerotic2/playlist.m3u8', tags: [] },
  { id: 'eroxxx-alt', name: 'EROXXX', logo: '', country: '', languages: [], categories: ['nsfw'], streamUrl: 'http://143.244.63.87/eroxxx/playlist.m3u8', tags: [] },
  { id: 'penthouse-gold', name: 'PENTHOUSE GOLD', logo: '', country: '', languages: [], categories: ['nsfw'], streamUrl: 'http://185.98.209.11:81/penthouse1/index.m3u8?token=test', tags: [] },
  { id: 'penthouse-reality', name: 'PENTHOUSE REALITY', logo: '', country: '', languages: [], categories: ['nsfw'], streamUrl: 'http://185.98.209.11:81/penthouse2/index.m3u8?token=test', tags: [] },
  { id: 'playboy-tv', name: 'PLAYBOY TV', logo: '', country: '', languages: [], categories: ['nsfw'], streamUrl: 'http://31.148.48.15:80/Playboy_TV/playlist.m3u8', tags: [] },
  { id: 'playboy-tv-hd', name: 'Playboy TV HD', logo: '', country: '', languages: [], categories: ['nsfw'], streamUrl: 'http://5.57.74.130:8000/play/a0c8/index.m3u8', tags: [] },
  { id: 'playboy-148', name: 'PLAYBOY', logo: '', country: '', languages: [], categories: ['nsfw'], streamUrl: 'http://148.230.149.45:1021/play/a01t/index.m3u8', tags: [] },
  { id: 'venus', name: 'VENUS', logo: '', country: '', languages: [], categories: ['nsfw'], streamUrl: 'http://148.230.149.45:1021/play/a01u/index.m3u8', tags: [] },
  { id: 'sextrem', name: 'SEXTREM', logo: '', country: '', languages: [], categories: ['nsfw'], streamUrl: 'http://148.230.149.45:1021/play/a01v/index.m3u8', tags: [] },
];

const NSFW_EMAIL = 'hussnain444all@gmail.com';

function nsfwAuth(email: string): boolean {
  return email === NSFW_EMAIL;
}

function base64urlEncode(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function proxyUrl(raw: string): string {
  const lastSlash = raw.lastIndexOf('/');
  const base = lastSlash >= 0 ? raw.slice(0, lastSlash + 1) : raw + '/';
  const file = lastSlash >= 0 ? raw.slice(lastSlash + 1) : '';
  return `/api/proxy/${base64urlEncode(base)}${file ? `/${file}` : ''}`;
}

export async function GET() {
  try {
    const session = await getSession();
    const nsfwEnabled = session !== null && nsfwAuth(session.email);

    const results = await Promise.allSettled(
      FETCH_CATEGORIES.map(async (cat) => {
        const res = await fetch(
          `https://iptv-org.github.io/iptv/categories/${cat}.m3u`,
          { next: { revalidate: 86400 } },
        );
        if (!res.ok) return [] as Channel[];
        const text = await res.text();
        return parseM3U(text, cat);
      }),
    );

    const seenUrls = new Set<string>();
    const channels: Channel[] = [];

    for (const result of results) {
      if (result.status !== 'fulfilled') continue;
      for (const ch of result.value) {
        if (!seenUrls.has(ch.streamUrl)) {
          const proxied = proxyUrl(ch.streamUrl);
          seenUrls.add(ch.streamUrl);
          channels.push({ ...ch, streamUrl: proxied });
        }
      }
    }

    if (nsfwEnabled) {
      for (const ch of NSFW_CHANNELS) {
        if (!seenUrls.has(ch.streamUrl)) {
          seenUrls.add(ch.streamUrl);
          channels.push({ ...ch, streamUrl: proxyUrl(ch.streamUrl) });
        }
      }
    }

    return Response.json(
      { ok: true, channels, total: channels.length, nsfwEnabled },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=86400',
        },
      },
    );
  } catch {
    return Response.json(
      { ok: false, error: 'Failed to fetch channels', code: 500 },
      { status: 500 },
    );
  }
}
