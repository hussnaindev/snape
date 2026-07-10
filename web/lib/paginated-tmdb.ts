/** Fetch TMDB pages 1..maxPage in parallel and merge with stable dedupe by id. */
export async function mergePaginatedResults<T extends { id: number }>(
  maxPage: number,
  fetchPage: (page: number) => Promise<{ results: T[] }>,
): Promise<T[]> {
  const capped = Math.max(1, maxPage);
  const pages = await Promise.all(Array.from({ length: capped }, (_, i) => fetchPage(i + 1)));
  const seen = new Set<number>();
  const merged: T[] = [];
  for (const page of pages) {
    for (const item of page.results) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      merged.push(item);
    }
  }
  return merged;
}

export function parsePageParam(raw: string | undefined, totalPages: number): number {
  const n = Number(raw ?? 1);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(Math.floor(n), Math.max(1, totalPages));
}

/** Build a path + query string for the next infinite-scroll page (computed on the server). */
export function buildPageHref(
  pathname: string,
  params: Record<string, string | number | undefined>,
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }
  const q = search.toString();
  return q ? `${pathname}?${q}` : pathname;
}
