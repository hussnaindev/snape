export interface ParsedChannelName {
  name: string;
  quality: string;
  tags: string[];
}

const QUALITY_WORD_RE =
  /\b(4K|UHD|FHD|1080[pPiI]?|720[pPiI]?|576[pPiI]?|567[pPiI]?|678[pPiI]?|480[pPiI]?|360[pPiI]?|240[pPiI]?|HD|SD|HQ)\b/gi;

/** Tokens that denote video quality (standalone or inside delimiters). */
const QUALITY_TOKEN_RE =
  /^(?:4K|UHD|FHD|HD|SD|HQ|\d{3,4}[pPiI]?)$/i;

function isQualityToken(token: string): boolean {
  return QUALITY_TOKEN_RE.test(token.trim());
}

function normalizeQuality(token: string): string {
  const t = token.trim();
  const digits = t.match(/^(\d{3,4})[pPiI]?$/i);
  if (digits) return `${digits[1]}P`;
  return t.toUpperCase();
}

function absorbToken(token: string, quality: string, tags: string[]): string {
  const trimmed = token.trim();
  if (!trimmed) return quality;
  if (!quality && isQualityToken(trimmed)) {
    return normalizeQuality(trimmed);
  }
  if (!tags.includes(trimmed)) {
    tags.push(trimmed);
  }
  return quality;
}

/**
 * Pulls quality and metadata out of IPTV display names.
 * Supports (), [], [[]], and standalone quality words.
 */
export function parseChannelName(rawName: string): ParsedChannelName {
  const tags: string[] = [];
  let quality = '';
  let name = rawName;

  const stripDelimited = (pattern: RegExp) => {
    name = name.replace(pattern, (_match, inner: string) => {
      quality = absorbToken(inner, quality, tags);
      return ' ';
    });
  };

  stripDelimited(/\[\[([^\]]+)\]\]/g);
  stripDelimited(/\[([^\]]+)\]/g);
  stripDelimited(/\(([^)]+)\)/g);

  const wordMatches = name.match(QUALITY_WORD_RE);
  if (wordMatches) {
    for (const word of wordMatches) {
      quality = absorbToken(word, quality, tags);
    }
    name = name.replace(QUALITY_WORD_RE, ' ');
  }

  name = name
    .replace(/[()[\]]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return {
    name: name || rawName.trim(),
    quality,
    tags,
  };
}
