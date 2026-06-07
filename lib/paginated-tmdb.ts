/** Max TMDB pages fetched in parallel per batch — keeps Worker fan-out bounded. */
export const MAX_MERGE_PAGES = 5;

/** Fetch TMDB pages 1..maxPage in batches and merge with stable dedupe by id. */
export async function mergePaginatedResults<T extends { id: number }>(
  maxPage: number,
  fetchPage: (page: number) => Promise<{ results: T[] }>,
): Promise<T[]> {
  const total = Math.max(1, maxPage);
  const seen = new Set<number>();
  const merged: T[] = [];

  for (let start = 1; start <= total; start += MAX_MERGE_PAGES) {
    const end = Math.min(start + MAX_MERGE_PAGES - 1, total);
    const pages = await Promise.all(
      Array.from({ length: end - start + 1 }, (_, i) => fetchPage(start + i)),
    );
    for (const page of pages) {
      for (const item of page.results) {
        if (seen.has(item.id)) continue;
        seen.add(item.id);
        merged.push(item);
      }
    }
  }

  return merged;
}

export function parsePageParam(
  raw: string | undefined,
  totalPages: number,
): number {
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
