export interface WatchHistoryEntry {
  id: number;
  type: 'movie' | 'series';
  title: string;
  posterPath: string | null;
  backdropPath: string | null;
  year: string;
  progress: number; // 0–100
  watchedAt: number; // Date.now()
  season?: number;
  episode?: number;
}

export const WATCH_HISTORY_MIN_ENTRIES = 1;

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
export function seededProgress(id: number): number {
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
    const existing = history.find((e) => e.id === entry.id && e.type === entry.type);
    const filtered = history.filter((e) => !(e.id === entry.id && e.type === entry.type));
    const newEntry: WatchHistoryEntry = {
      id: entry.id,
      type: entry.type,
      title: entry.title,
      posterPath: entry.posterPath,
      backdropPath: entry.backdropPath,
      year: entry.year,
      progress: seededProgress(entry.id),
      watchedAt: Date.now(),
    };
    // Preserve existing season/episode if not provided in new entry
    const season = entry.season ?? existing?.season;
    const episode = entry.episode ?? existing?.episode;
    if (season !== undefined) newEntry.season = season;
    if (episode !== undefined) newEntry.episode = episode;
    filtered.unshift(newEntry);
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

const CLEARED_EVENT = 'watch-history-cleared';
export const SYNCED_EVENT = 'watch-history-synced';

/** Remove all entries from device storage and the presence cookie; notify listeners (e.g. homepage carousel). */
export function clearWatchHistory(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    clearHistoryCookie();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(CLEARED_EVENT));
    }
  } catch {}
}

/** Clears local history and best-effort clears server rows when the user is signed in (401 is ignored). */
export async function clearAllWatchHistory(): Promise<void> {
  clearWatchHistory();
  try {
    await fetch('/api/watch-history', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true }),
      credentials: 'include',
    });
  } catch {
    // offline or blocked — local state already cleared
  }
}

// --- Server sync helpers ---

/** Fetch watch history from server for current user. */
export async function fetchServerWatchHistory(): Promise<WatchHistoryEntry[]> {
  try {
    const res = await fetch('/api/watch-history', { credentials: 'include' });
    const json = await res.json();
    if (!json.ok) return [];
    return (json.data || []).map(
      (item: {
        tmdbId: number;
        mediaType: 'movie' | 'series';
        title: string;
        posterPath: string | null;
        backdropPath: string | null;
        year: string;
        progress: number;
        watchedAt: string;
        season: number | null;
        episode: number | null;
      }) => ({
        id: item.tmdbId,
        type: item.mediaType,
        title: item.title,
        posterPath: item.posterPath ?? null,
        backdropPath: item.backdropPath ?? null,
        year: item.year ?? '',
        progress: item.progress ?? 0,
        watchedAt: new Date(item.watchedAt).getTime(),
        ...(item.season ? { season: item.season } : {}),
        ...(item.episode ? { episode: item.episode } : {}),
      }),
    );
  } catch {
    return [];
  }
}

/** Upload a single entry to server. */
export async function uploadEntryToServer(entry: WatchHistoryEntry): Promise<void> {
  try {
    const body: Record<string, unknown> = {
      tmdbId: entry.id,
      mediaType: entry.type,
      title: entry.title,
      posterPath: entry.posterPath,
      backdropPath: entry.backdropPath,
      year: entry.year,
      progress: entry.progress,
    };
    if (entry.season !== undefined) body.season = entry.season;
    if (entry.episode !== undefined) body.episode = entry.episode;
    await fetch('/api/watch-history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'include',
    });
  } catch {
    // offline — will sync next login
  }
}

/** Merge local and server histories, keeping most recent by watchedAt. */
export function mergeWatchHistories(
  local: WatchHistoryEntry[],
  server: WatchHistoryEntry[],
): WatchHistoryEntry[] {
  const map = new Map<string, WatchHistoryEntry>();

  // First pass: add all entries
  for (const entry of [...server, ...local]) {
    const key = `${entry.id}:${entry.type}`;
    const existing = map.get(key);
    if (!existing || entry.watchedAt > existing.watchedAt) {
      map.set(key, entry);
    } else if (existing && existing.watchedAt === entry.watchedAt) {
      // Same timestamp - prefer entry with non-zero progress (correct fake progress)
      if (entry.progress > 0 && existing.progress === 0) {
        map.set(key, entry);
      }
    }
  }

  // Second pass: ensure local progress is preserved when server has 0
  for (const entry of local) {
    const key = `${entry.id}:${entry.type}`;
    const existing = map.get(key);
    if (existing && existing.progress === 0 && entry.progress > 0) {
      // Server has 0 progress but local has correct fake progress - use local
      map.set(key, { ...existing, progress: entry.progress });
    }
  }

  const merged = Array.from(map.values()).sort((a, b) => b.watchedAt - a.watchedAt);
  return merged.slice(0, MAX_ENTRIES);
}

/**
 * Sync on login: merge local + server history, upload merged to server via bulk API,
 * replace local storage with merged, and notify listeners.
 */
export async function syncOnLogin(): Promise<void> {
  try {
    const local = getWatchHistory();
    const server = await fetchServerWatchHistory();
    const merged = mergeWatchHistories(local, server);

    // Upload merged to server via bulk API
    if (merged.length > 0) {
      try {
        const entries = merged.map((entry) => {
          const item: Record<string, unknown> = {
            tmdbId: entry.id,
            mediaType: entry.type,
            title: entry.title,
            posterPath: entry.posterPath,
            backdropPath: entry.backdropPath,
            year: entry.year,
            progress: entry.progress,
          };
          if (entry.season !== undefined) item.season = entry.season;
          if (entry.episode !== undefined) item.episode = entry.episode;
          return item;
        });
        await fetch('/api/watch-history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entries }),
          credentials: 'include',
        });
      } catch {
        // offline — will sync next login
      }
    }

    // Replace local with merged
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    syncWatchHistoryCookie(merged);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(SYNCED_EVENT, { detail: merged }));
    }
  } catch {
    // sync failed — keep local history as-is
  }
}

/**
 * Handle logout: clear the merged history and create fresh local history.
 * Local history is cleared because it contained server-synced data.
 */
export function handleLogout(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    clearHistoryCookie();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(CLEARED_EVENT));
    }
  } catch {}
}
