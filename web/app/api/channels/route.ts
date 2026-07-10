// TV Channels API — disabled. Uncomment block below to re-enable.

export const runtime = 'edge';

export async function GET() {
  return Response.json({ ok: false, error: 'Not found', code: 404 }, { status: 404 });
}

/*
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

export async function GET() {
  try {
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
          seenUrls.add(ch.streamUrl);
          channels.push(ch);
        }
      }
    }

    return Response.json(
      { ok: true, channels, total: channels.length },
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
*/
