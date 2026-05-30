import { parseChannelName } from '@/lib/parse-channel-name';
import type { Channel } from '@/types/channels';

export const runtime = 'edge';

const PLAYLIST_URL = 'https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8';

function parseM3U(content: string): Channel[] {
  const channels: Channel[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (!line.startsWith('#EXTINF:')) continue;

    const urlLine = lines[i + 1]?.trim() ?? '';
    if (!urlLine || urlLine.startsWith('#') || !urlLine.startsWith('http')) continue;

    const tvgId = line.match(/tvg-id="([^"]*)"/)?.[1] ?? '';
    const tvgLogo = line.match(/tvg-logo="([^"]*)"/)?.[1] ?? '';
    const groupTitle = line.match(/group-title="([^"]*)"/)?.[1] ?? '';
    const countryAttr = line.match(/tvg-country="([^"]*)"/)?.[1] ?? '';
    const langAttr = line.match(/tvg-language="([^"]*)"/)?.[1] ?? '';

    const commaIdx = line.lastIndexOf(',');
    const rawName = commaIdx >= 0 ? line.slice(commaIdx + 1).trim() : '';
    if (!rawName) continue;

    const { name, tags } = parseChannelName(rawName);

    channels.push({
      id: tvgId || `ch-${i}`,
      name,
      logo: tvgLogo,
      country: countryAttr.toUpperCase(),
      languages: langAttr ? [langAttr] : [],
      categories: [groupTitle || 'general'],
      streamUrl: urlLine,
      tags,
    });

    i++;
  }

  return channels;
}

export async function GET() {
  try {
    const res = await fetch(PLAYLIST_URL, { next: { revalidate: 86400 } });
    if (!res.ok) {
      return Response.json(
        { ok: false, error: 'Failed to fetch playlist', code: 502 },
        { status: 502 },
      );
    }

    const text = await res.text();
    const allChannels = parseM3U(text);

    const seenUrls = new Set<string>();
    const channels: Channel[] = [];
    for (const ch of allChannels) {
      if (!seenUrls.has(ch.streamUrl)) {
        seenUrls.add(ch.streamUrl);
        channels.push(ch);
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
