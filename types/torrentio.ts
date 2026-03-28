export interface TorrentioStream {
  name: string;
  title: string;
  infoHash: string;
  fileIdx?: number;
  sources?: string[];
  behaviorHints?: {
    filename?: string;
    bingeGroup?: string;
  };
}

export interface TorrentioResponse {
  streams: TorrentioStream[];
}

export type StreamQuality = '4K' | '1080p' | '720p' | '480p' | 'other';

export interface ParsedStream {
  quality: StreamQuality;
  infoHash: string;
  fileIdx: number;
  title: string;
  sources: string[];
}
