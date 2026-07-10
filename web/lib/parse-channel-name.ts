export interface ParsedChannelName {
  name: string;
  tags: string[];
}

const OPEN_BRACKET = /[([{]/;

/** Outermost bracket groups first — avoids [[x]] matching inner [x]. */
const BRACKET_EXTRACTORS = [
  /\[\[([^\]]*)\]\]/,
  /\(([^)]*)\)/,
  /\[([^\]]*)\]/,
  /\{([^}]*)\}/,
] as const;

function extractTags(rawName: string): string[] {
  const tags: string[] = [];
  const seen = new Set<string>();
  let work = rawName;

  let found = true;
  while (found) {
    found = false;
    for (const re of BRACKET_EXTRACTORS) {
      const match = work.match(re);
      if (!match || match.index === undefined) continue;

      const token = match[1]?.trim();
      if (token) {
        const key = token.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          tags.push(token);
        }
      }

      work = `${work.slice(0, match.index)} ${work.slice(match.index + match[0].length)}`;
      found = true;
      break;
    }
  }

  return tags;
}

function stripAllBrackets(rawName: string): string {
  let work = rawName;
  let found = true;
  while (found) {
    found = false;
    for (const re of BRACKET_EXTRACTORS) {
      const match = work.match(re);
      if (!match || match.index === undefined) continue;
      work = `${work.slice(0, match.index)} ${work.slice(match.index + match[0].length)}`;
      found = true;
      break;
    }
  }
  return work.replace(/\s{2,}/g, ' ').trim();
}

/**
 * Channel name = text before the first `(`, `[`, or `{`.
 * Every non-empty bracket segment in the full string becomes a tag chip.
 */
export function parseChannelName(rawName: string): ParsedChannelName {
  const trimmed = rawName.trim();
  if (!trimmed) {
    return { name: '', tags: [] };
  }

  const tags = extractTags(trimmed);
  const bracketAt = trimmed.search(OPEN_BRACKET);

  let name =
    bracketAt === -1
      ? trimmed
      : trimmed.slice(0, bracketAt).trim();

  // e.g. "(1080p) ESPN" — no leading name before first bracket
  if (!name) {
    name = stripAllBrackets(trimmed);
  }

  name = name
    .replace(/[()[\]{}]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return {
    name: name || stripAllBrackets(trimmed) || trimmed,
    tags,
  };
}
