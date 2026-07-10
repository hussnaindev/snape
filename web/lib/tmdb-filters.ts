/** Keep only items with both backdrop and poster (same rule as the homepage). */
export function filterHasImages<
  T extends { backdrop_path: string | null; poster_path: string | null },
>(items: T[]): T[] {
  return items.filter((m) => m.backdrop_path !== null && m.poster_path !== null);
}
