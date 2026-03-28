import type {
  ParsedStream,
  StreamQuality,
  TorrentioResponse,
  TorrentioStream,
} from '@/types/torrentio';

const TORRENTIO_BASE = 'https://torrentio.strem.fun';

const TRACKERS = [
  'udp://tracker.opentrackr.org:1337/announce',
  'udp://9.rarbg.to:2920/announce',
  'udp://tracker.openbittorrent.com:6969/announce',
  'udp://open.tracker.cl:1337/announce',
  'udp://tracker.internetwarriors.net:1337/announce',
]
  .map((t) => `&tr=${encodeURIComponent(t)}`)
  .join('');

export function buildMagnet(infoHash: string, title: string): string {
  return `magnet:?xt=urn:btih:${infoHash}&dn=${encodeURIComponent(title)}${TRACKERS}`;
}

export function parseStreamQuality(stream: TorrentioStream): StreamQuality {
  const text = `${stream.name} ${stream.title}`.toLowerCase();
  if (text.includes('2160p') || text.includes('4k') || text.includes('uhd')) return '4K';
  if (text.includes('1080p')) return '1080p';
  if (text.includes('720p')) return '720p';
  if (text.includes('480p')) return '480p';
  return 'other';
}

export function parseStreams(streams: TorrentioStream[]): ParsedStream[] {
  return streams.map((s) => ({
    quality: parseStreamQuality(s),
    infoHash: s.infoHash,
    fileIdx: s.fileIdx ?? 0,
    title: s.title,
    sources: s.sources ?? [],
  }));
}

export function groupStreamsByQuality(
  streams: ParsedStream[],
): Partial<Record<StreamQuality, ParsedStream[]>> {
  const groups: Partial<Record<StreamQuality, ParsedStream[]>> = {};
  for (const stream of streams) {
    const existing = groups[stream.quality];
    if (existing) {
      existing.push(stream);
    } else {
      groups[stream.quality] = [stream];
    }
  }
  return groups;
}

export async function getTorrentStreams(imdbId: string): Promise<ParsedStream[]> {
  const res = await fetch(`${TORRENTIO_BASE}/stream/movie/${imdbId}.json`, {
    next: { revalidate: 3600 },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as TorrentioResponse;
  return parseStreams(data.streams ?? []);
}
