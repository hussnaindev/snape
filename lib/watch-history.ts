export interface WatchHistoryEntry {
  id: number;
  type: 'movie' | 'series';
  title: string;
  posterPath: string | null;
  backdropPath: string | null;
  year: string;
  progress: number; // 0–100, derived from positionSeconds/durationSeconds
  positionSeconds: number; // last playback position
  durationSeconds: number; // media duration (0 until known)
  watchedAt: number; // Date.now()
  season?: number;
  episode?: number;
  vote_average: number;
}

export const WATCH_HISTORY_MIN_ENTRIES = 1;

const STORAGE_KEY = 'heroflix_watch_history';
const COOKIE_KEY = 'hwh';

// History is unbounded by count — entries are pruned only when untouched for two
// weeks. The "Continue Watching" carousel separately shows just the most recent
// titles (one card per title) via getContinueWatching().
const STALE_MS = 14 * 24 * 60 * 60 * 1000;
const CONTINUE_WATCHING_LIMIT = 10;
// Upper bound for a single bulk server sync payload (must match the API schema).
const BULK_MAX = 200;

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

// A title at/above this fraction is treated as "finished": reopening restarts
// from the beginning rather than resuming at the tail end.
const FINISHED_FRACTION = 0.95;

function progressPct(positionSeconds: number, durationSeconds: number): number {
  if (!(durationSeconds > 0)) return 0;
  return Math.max(0, Math.min(100, Math.round((positionSeconds / durationSeconds) * 100)));
}

/**
 * Identity of a single resume slot. Movies have one slot per title; series have
 * one slot per episode, so each episode keeps its own resume position.
 */
function entryKey(
  id: number,
  type: 'movie' | 'series',
  season?: number,
  episode?: number,
): string {
  return type === 'series' ? `series:${id}:${season ?? 0}:${episode ?? 0}` : `movie:${id}`;
}

function entrySlot(e: WatchHistoryEntry): string {
  return entryKey(e.id, e.type, e.season, e.episode);
}

function pruneStale(items: WatchHistoryEntry[]): WatchHistoryEntry[] {
  const cutoff = Date.now() - STALE_MS;
  return items.filter((e) => e.watchedAt >= cutoff);
}

function persist(items: WatchHistoryEntry[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  if (items.length >= WATCH_HISTORY_MIN_ENTRIES) setHistoryCookie();
  else clearHistoryCookie();
}

/** All stored slots (movies + individual series episodes), pruned of stale ones. */
export function getWatchHistory(): WatchHistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const all = JSON.parse(raw) as WatchHistoryEntry[];
    const fresh = pruneStale(all);
    if (fresh.length !== all.length) persist(fresh); // drop stale entries on read
    return fresh;
  } catch {
    return [];
  }
}

/**
 * The "Continue Watching" view: the most recently watched titles, deduped to one
 * card per title (latest episode for a series), capped at CONTINUE_WATCHING_LIMIT.
 */
export function getContinueWatching(limit = CONTINUE_WATCHING_LIMIT): WatchHistoryEntry[] {
  const byTitle = new Map<string, WatchHistoryEntry>();
  for (const e of getWatchHistory()) {
    const key = `${e.type}:${e.id}`;
    const cur = byTitle.get(key);
    if (!cur || e.watchedAt > cur.watchedAt) byTitle.set(key, e);
  }
  return Array.from(byTitle.values())
    .sort((a, b) => b.watchedAt - a.watchedAt)
    .slice(0, limit);
}

/**
 * Mount-time marker: record (or refresh) the slot for a title/episode the user
 * just opened. An existing slot's position/progress are preserved (so resume
 * survives); metadata and watchedAt are refreshed. Returns the stored entry.
 */
export function addToWatchHistory(
  entry: Omit<WatchHistoryEntry, 'progress' | 'positionSeconds' | 'durationSeconds' | 'watchedAt'>,
): WatchHistoryEntry | null {
  try {
    const slot = entryKey(entry.id, entry.type, entry.season, entry.episode);
    const history = getWatchHistory();
    const existing = history.find((e) => entrySlot(e) === slot);
    const filtered = history.filter((e) => entrySlot(e) !== slot);
    const newEntry: WatchHistoryEntry = {
      id: entry.id,
      type: entry.type,
      title: entry.title,
      posterPath: entry.posterPath,
      backdropPath: entry.backdropPath,
      year: entry.year,
      progress: existing?.progress ?? 0,
      positionSeconds: existing?.positionSeconds ?? 0,
      durationSeconds: existing?.durationSeconds ?? 0,
      watchedAt: Date.now(),
      vote_average: entry.vote_average ?? 0,
    };
    if (entry.season !== undefined) newEntry.season = entry.season;
    if (entry.episode !== undefined) newEntry.episode = entry.episode;
    filtered.unshift(newEntry);
    persist(filtered);
    return newEntry;
  } catch {
    return null;
  }
}

/**
 * Update the stored playback position for a slot during playback. Updates it in
 * place (relying on {@link addToWatchHistory} for metadata), recomputes progress,
 * and returns the updated entry so the caller can sync it to the server.
 */
export function recordPlaybackProgress(input: {
  id: number;
  type: 'movie' | 'series';
  positionSeconds: number;
  durationSeconds: number;
  season?: number;
  episode?: number;
}): WatchHistoryEntry | null {
  try {
    const slot = entryKey(input.id, input.type, input.season, input.episode);
    const history = getWatchHistory();
    const existing = history.find((e) => entrySlot(e) === slot);
    const filtered = history.filter((e) => entrySlot(e) !== slot);
    const entry: WatchHistoryEntry = {
      id: input.id,
      type: input.type,
      title: existing?.title ?? '',
      posterPath: existing?.posterPath ?? null,
      backdropPath: existing?.backdropPath ?? null,
      year: existing?.year ?? '',
      vote_average: existing?.vote_average ?? 0,
      positionSeconds: Math.max(0, Math.round(input.positionSeconds)),
      durationSeconds: Math.max(0, Math.round(input.durationSeconds)),
      progress: progressPct(input.positionSeconds, input.durationSeconds),
      watchedAt: Date.now(),
    };
    if (input.season !== undefined) entry.season = input.season;
    else if (existing?.season !== undefined) entry.season = existing.season;
    if (input.episode !== undefined) entry.episode = input.episode;
    else if (existing?.episode !== undefined) entry.episode = existing.episode;
    filtered.unshift(entry);
    persist(filtered);
    return entry;
  } catch {
    return null;
  }
}

/**
 * Resume position (seconds) for a title/episode the user is about to play.
 * Returns the saved position when a matching slot exists and isn't finished;
 * otherwise 0 (start from the beginning).
 */
export function getResumePosition(
  id: number,
  type: 'movie' | 'series',
  season?: number,
  episode?: number,
): number {
  try {
    const slot = entryKey(id, type, season, episode);
    const entry = getWatchHistory().find((e) => entrySlot(e) === slot);
    if (!entry) return 0;
    if (entry.durationSeconds > 0 && entry.positionSeconds / entry.durationSeconds >= FINISHED_FRACTION) {
      return 0;
    }
    return entry.positionSeconds > 0 ? entry.positionSeconds : 0;
  } catch {
    return 0;
  }
}

/** Remove a title from history entirely (all episodes, for a series). */
export function removeFromWatchHistory(id: number, type: 'movie' | 'series'): void {
  try {
    const updated = getWatchHistory().filter((e) => !(e.id === id && e.type === type));
    persist(updated);
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
        positionSeconds: number | null;
        durationSeconds: number | null;
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
        positionSeconds: item.positionSeconds ?? 0,
        durationSeconds: item.durationSeconds ?? 0,
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
      positionSeconds: entry.positionSeconds,
      durationSeconds: entry.durationSeconds,
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

/** Merge local and server histories per resume slot, keeping the most recent. */
export function mergeWatchHistories(
  local: WatchHistoryEntry[],
  server: WatchHistoryEntry[],
): WatchHistoryEntry[] {
  const map = new Map<string, WatchHistoryEntry>();

  // Most recently watched wins (it carries the real position/progress). On an
  // exact tie, prefer the entry that's further along.
  for (const entry of [...server, ...local]) {
    const key = entrySlot(entry);
    const existing = map.get(key);
    if (!existing || entry.watchedAt > existing.watchedAt) {
      map.set(key, entry);
    } else if (entry.watchedAt === existing.watchedAt && entry.progress > existing.progress) {
      map.set(key, entry);
    }
  }

  return pruneStale(Array.from(map.values())).sort((a, b) => b.watchedAt - a.watchedAt);
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

    // Upload merged to server via bulk API (capped to the API's batch limit).
    const batch = merged.slice(0, BULK_MAX);
    if (batch.length > 0) {
      try {
        const entries = batch.map((entry) => {
          const item: Record<string, unknown> = {
            tmdbId: entry.id,
            mediaType: entry.type,
            title: entry.title,
            posterPath: entry.posterPath,
            backdropPath: entry.backdropPath,
            year: entry.year,
            progress: entry.progress,
            positionSeconds: entry.positionSeconds,
            durationSeconds: entry.durationSeconds,
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
    persist(merged);

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
