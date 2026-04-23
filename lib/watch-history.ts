export interface WatchHistoryEntry {
  id: number;
  type: 'movie' | 'series';
  title: string;
  posterPath: string | null;
  backdropPath: string | null;
  year: string;
  progress: number; // 0–100
  watchedAt: number; // Date.now()
}

export const WATCH_HISTORY_MIN_ENTRIES = 3;

const STORAGE_KEY = 'heroflix_watch_history';
const COOKIE_KEY = 'hwh';
const MAX_ENTRIES = 10;

function setHistoryCookie() {
  document.cookie = `${COOKIE_KEY}=1; path=/; max-age=31536000; SameSite=Lax`;
}

function clearHistoryCookie() {
  document.cookie = `${COOKIE_KEY}=; path=/; max-age=0`;
}

/** Call on mount to keep the cookie in sync with actual localStorage state. */
export function syncWatchHistoryCookie(items: WatchHistoryEntry[]): void {
  if (items.length >= WATCH_HISTORY_MIN_ENTRIES) {
    setHistoryCookie();
  } else {
    clearHistoryCookie();
  }
}

// Deterministic pseudo-random progress 15–85 based on TMDB id.
// Same title always shows the same bar — avoids it jumping on re-renders.
function seededProgress(id: number): number {
  return (((id * 2654435761) >>> 0) % 71) + 15;
}

export function getWatchHistory(): WatchHistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as WatchHistoryEntry[];
  } catch {
    return [];
  }
}

export function addToWatchHistory(entry: Omit<WatchHistoryEntry, 'progress' | 'watchedAt'>): void {
  try {
    const history = getWatchHistory();
    const filtered = history.filter((e) => !(e.id === entry.id && e.type === entry.type));
    filtered.unshift({
      ...entry,
      progress: seededProgress(entry.id),
      watchedAt: Date.now(),
    });
    const next = filtered.slice(0, MAX_ENTRIES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    if (next.length >= WATCH_HISTORY_MIN_ENTRIES) setHistoryCookie();
  } catch {}
}

export function removeFromWatchHistory(id: number, type: 'movie' | 'series'): void {
  try {
    const history = getWatchHistory();
    const updated = history.filter((e) => !(e.id === id && e.type === type));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    if (updated.length === 0) clearHistoryCookie();
  } catch {}
}
