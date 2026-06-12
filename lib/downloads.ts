// Local, device-only download manager for offline playback.
//
// Downloads are stored entirely on-device in IndexedDB (metadata + the video
// Blob), mirroring how watch-history lives in localStorage: no login required,
// nothing is uploaded. The manager streams the selected MP4 source through the
// existing /api/media-proxy URL, tracking byte progress, and exposes a pub/sub
// snapshot so the download button and the /downloads page stay in sync.
//
// Only progressive MP4 sources are downloadable — an HLS manifest is not a
// single playable file offline, so the picker filters HLS out (see
// download-button.tsx). The player already prefers MP4, so most titles qualify.

export type DownloadStatus =
  | 'queued'
  | 'downloading'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'canceled';

import { showToast } from '@/lib/toast';

export interface DownloadRecord {
  id: string; // `${type}:${tmdbId}[:s{season}e{episode}]:${quality}:${lang}`
  type: 'movie' | 'series';
  tmdbId: number;
  season?: number;
  episode?: number;
  title: string;
  posterPath: string | null;
  quality: string; // e.g. '720p'
  lang: string; // audio track label, e.g. 'Original'
  subtitleLang: string | null; // subtitle label, or null when none chosen
  status: DownloadStatus;
  receivedBytes: number;
  totalBytes: number; // 0 when the server omits Content-Length
  progress: number; // 0–100 (0 while total unknown)
  mime: string;
  error: string | null;
  createdAt: number;
  completedAt: number | null;
  // Internal: the signed media-proxy URLs, kept so a failed download can retry
  // without re-resolving the source. Not shown in the UI.
  videoUrl: string;
  subtitleUrl: string | null;
}

export interface StartDownloadInput {
  type: 'movie' | 'series';
  tmdbId: number;
  season?: number;
  episode?: number;
  title: string;
  posterPath: string | null;
  quality: string;
  lang: string;
  subtitleLang: string | null;
  mime: string;
  videoUrl: string;
  subtitleUrl: string | null;
}

const DB_NAME = 'heroflix-downloads';
const DB_VERSION = 1;
const RECORD_STORE = 'records';
const BLOB_STORE = 'blobs';

interface BlobEntry {
  id: string;
  video: Blob;
  subtitle: Blob | null;
  // True while this is only the partially-downloaded bytes of a paused download.
  partial?: boolean;
}

// ---------- IndexedDB plumbing ----------

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB unavailable'));
  }
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(RECORD_STORE)) {
        db.createObjectStore(RECORD_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(BLOB_STORE)) {
        db.createObjectStore(BLOB_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Failed to open downloads DB'));
  });
  return dbPromise;
}

function txComplete(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Transaction failed'));
    tx.onabort = () => reject(tx.error ?? new Error('Transaction aborted'));
  });
}

async function idbPutRecord(record: DownloadRecord): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(RECORD_STORE, 'readwrite');
  tx.objectStore(RECORD_STORE).put(record);
  await txComplete(tx);
}

async function idbDelete(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction([RECORD_STORE, BLOB_STORE], 'readwrite');
  tx.objectStore(RECORD_STORE).delete(id);
  tx.objectStore(BLOB_STORE).delete(id);
  await txComplete(tx);
}

async function idbPutBlob(entry: BlobEntry): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(BLOB_STORE, 'readwrite');
  tx.objectStore(BLOB_STORE).put(entry);
  await txComplete(tx);
}

async function idbGetAllRecords(): Promise<DownloadRecord[]> {
  const db = await openDb();
  const tx = db.transaction(RECORD_STORE, 'readonly');
  const req = tx.objectStore(RECORD_STORE).getAll();
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve((req.result as DownloadRecord[]) ?? []);
    req.onerror = () => reject(req.error ?? new Error('Failed to read downloads'));
  });
}

async function idbDeleteBlob(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(BLOB_STORE, 'readwrite');
  tx.objectStore(BLOB_STORE).delete(id);
  await txComplete(tx);
}

async function idbGetBlob(id: string): Promise<BlobEntry | null> {
  const db = await openDb();
  const tx = db.transaction(BLOB_STORE, 'readonly');
  const req = tx.objectStore(BLOB_STORE).get(id);
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve((req.result as BlobEntry | undefined) ?? null);
    req.onerror = () => reject(req.error ?? new Error('Failed to read blob'));
  });
}

// ---------- in-memory state + pub/sub ----------

const records = new Map<string, DownloadRecord>();
const controllers = new Map<string, AbortController>();
const listeners = new Set<(records: DownloadRecord[]) => void>();
let loaded = false;
let loadPromise: Promise<void> | null = null;

function snapshot(): DownloadRecord[] {
  // Clone each record so subscribers get fresh object identities on every
  // change. We mutate records in place while downloading; without cloning, a
  // subscriber that stores a single record (e.g. the download button) would set
  // the same reference each time and React would skip the re-render.
  return [...records.values()].sort((a, b) => b.createdAt - a.createdAt).map((r) => ({ ...r }));
}

function notify(): void {
  updateUnloadGuard();
  const snap = snapshot();
  for (const cb of listeners) cb(snap);
}

// Warn before unloading the tab while a download is in flight — downloads run in
// memory and don't survive a full reload/close, so guard against losing them.
let unloadHandler: ((e: BeforeUnloadEvent) => void) | null = null;
function updateUnloadGuard(): void {
  if (typeof window === 'undefined') return;
  const hasActive = [...records.values()].some(
    (r) => r.status === 'downloading' || r.status === 'queued',
  );
  if (hasActive && !unloadHandler) {
    unloadHandler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', unloadHandler);
  } else if (!hasActive && unloadHandler) {
    window.removeEventListener('beforeunload', unloadHandler);
    unloadHandler = null;
  }
}

async function ensureLoaded(): Promise<void> {
  if (loaded) return;
  if (!loadPromise) {
    loadPromise = (async () => {
      try {
        const all = await idbGetAllRecords();
        for (const r of all) {
          // A download interrupted by a reload/crash is left dangling — mark it
          // failed so the user can retry instead of seeing a frozen bar.
          if (r.status === 'downloading' || r.status === 'queued') {
            r.status = 'failed';
            r.error = 'Interrupted';
            void idbPutRecord(r);
          }
          records.set(r.id, r);
        }
      } catch {
        // No IDB / blocked — start empty.
      } finally {
        loaded = true;
      }
    })();
  }
  await loadPromise;
  notify();
}

/**
 * Subscribe to the live downloads snapshot. Fires immediately with the current
 * (lazily loaded) state and again on every change. Returns an unsubscribe fn.
 */
export function subscribeDownloads(cb: (records: DownloadRecord[]) => void): () => void {
  listeners.add(cb);
  cb(snapshot());
  void ensureLoaded();
  return () => {
    listeners.delete(cb);
  };
}

export function getDownloadsSnapshot(): DownloadRecord[] {
  return snapshot();
}

/**
 * The completed download for a given title/episode, if one exists on this device
 * (so the player can play it offline / by default). Returns null otherwise.
 */
export async function getCompletedDownloadForMedia(
  type: 'movie' | 'series',
  tmdbId: number,
  season?: number,
  episode?: number,
): Promise<DownloadRecord | null> {
  await ensureLoaded();
  for (const r of records.values()) {
    if (r.status !== 'completed') continue;
    if (r.type !== type || r.tmdbId !== tmdbId) continue;
    if (type === 'series' && (r.season !== season || r.episode !== episode)) continue;
    return { ...r };
  }
  return null;
}

export function buildDownloadId(
  type: 'movie' | 'series',
  tmdbId: number,
  quality: string,
  lang: string,
  season?: number,
  episode?: number,
): string {
  const ep = type === 'series' ? `:s${season ?? 0}e${episode ?? 0}` : '';
  return `${type}:${tmdbId}${ep}:${quality}:${lang}`;
}

// ---------- download lifecycle ----------

const PERSIST_INTERVAL_MS = 1500;
const NOTIFY_INTERVAL_MS = 350;

// Ids the user chose to *pause* (vs cancel). Both abort the fetch; the intent
// decides whether the partial bytes are kept (paused) or discarded (canceled).
const pauseIntent = new Set<string>();

async function runDownload(id: string, resume = false): Promise<void> {
  const record = records.get(id);
  if (!record) return;
  const controller = new AbortController();
  controllers.set(id, controller);
  pauseIntent.delete(id);

  record.status = 'downloading';
  record.error = null;
  await idbPutRecord(record);
  notify();

  let lastPersist = 0;
  let lastNotify = 0;

  // Resume: start from the previously-saved partial bytes (a byte-range request).
  let startByte = 0;
  const chunks: BlobPart[] = [];
  if (resume && record.receivedBytes > 0) {
    const partial = await idbGetBlob(id).catch(() => null);
    if (partial?.partial && partial.video.size > 0) {
      chunks.push(partial.video);
      startByte = partial.video.size;
    }
  }
  let received = startByte;

  try {
    // A `Range` request gives us a 206 + Content-Range, so we learn the real
    // total size (→ accurate %) and can resume from an offset. The media proxy
    // forwards Range and surfaces Content-Range/Content-Length.
    const res = await fetch(record.videoUrl, {
      signal: controller.signal,
      headers: { Range: `bytes=${startByte}-` },
    });
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

    // If we requested an offset but the server ignored it (200, not 206), the
    // body is the whole file — drop the partial and start over to avoid a
    // corrupt concatenation.
    if (startByte > 0 && res.status !== 206) {
      chunks.length = 0;
      startByte = 0;
      received = 0;
    }

    // Real total: Content-Range "bytes a-b/<total>" first, else Content-Length.
    let total = 0;
    const cr = res.headers.get('Content-Range');
    const cl = res.headers.get('Content-Length');
    if (cr) {
      const m = /\/(\d+)\s*$/.exec(cr);
      if (m) total = Number(m[1]);
    }
    if (!total && cl) total = startByte + (Number.parseInt(cl, 10) || 0);
    record.totalBytes = total;

    const reader = res.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      chunks.push(value);
      received += value.length;
      record.receivedBytes = received;
      record.progress = total > 0 ? Math.min(99, Math.round((received / total) * 100)) : 0;
      const now = Date.now();
      if (now - lastNotify > NOTIFY_INTERVAL_MS) {
        lastNotify = now;
        notify();
      }
      if (now - lastPersist > PERSIST_INTERVAL_MS) {
        lastPersist = now;
        void idbPutRecord(record);
      }
    }

    const videoBlob = new Blob(chunks, { type: record.mime || 'video/mp4' });

    let subtitleBlob: Blob | null = null;
    if (record.subtitleUrl) {
      try {
        const subRes = await fetch(record.subtitleUrl, { signal: controller.signal });
        if (subRes.ok) subtitleBlob = await subRes.blob();
      } catch {
        // Subtitle is best-effort — keep the video even if it fails.
      }
    }

    await idbPutBlob({ id, video: videoBlob, subtitle: subtitleBlob });

    record.status = 'completed';
    record.receivedBytes = videoBlob.size;
    if (record.totalBytes === 0) record.totalBytes = videoBlob.size;
    record.progress = 100;
    record.completedAt = Date.now();
    record.error = null;
    await idbPutRecord(record);
    showToast(`Saved for offline · ${record.title}`, 'check');
  } catch (err) {
    if (controller.signal.aborted && pauseIntent.has(id)) {
      // Pause: persist the bytes downloaded so far so resume can continue.
      try {
        const partialBlob = new Blob(chunks, { type: record.mime || 'video/mp4' });
        await idbPutBlob({ id, video: partialBlob, subtitle: null, partial: true });
        record.status = 'paused';
        record.receivedBytes = received;
        record.error = null;
      } catch {
        record.status = 'failed';
        record.error = 'Could not pause download';
      }
    } else if (controller.signal.aborted) {
      // Cancel: discard the partial bytes.
      record.status = 'canceled';
      record.receivedBytes = 0;
      record.progress = 0;
      record.error = null;
      await idbDeleteBlob(id).catch(() => {});
    } else {
      record.status = 'failed';
      record.error = err instanceof Error ? err.message : 'Download failed';
      showToast(`Download failed · ${record.title}`, 'error');
    }
    await idbPutRecord(record);
  } finally {
    controllers.delete(id);
    pauseIntent.delete(id);
    notify();
  }
}

/**
 * Queue (or re-queue) a download. Returns the record id. If a download with the
 * same id already exists and is active/complete it's returned unchanged;
 * otherwise it (re)starts.
 */
export async function startDownload(input: StartDownloadInput): Promise<string> {
  await ensureLoaded();
  const id = buildDownloadId(
    input.type,
    input.tmdbId,
    input.quality,
    input.lang,
    input.season,
    input.episode,
  );
  const existing = records.get(id);
  if (existing) {
    if (existing.status === 'downloading' || existing.status === 'completed') return id;
    if (existing.status === 'paused') {
      // Re-picking the same title resumes it (with a freshly-signed source URL).
      existing.videoUrl = input.videoUrl;
      existing.subtitleUrl = input.subtitleUrl;
      await idbPutRecord(existing);
      void resumeDownload(id);
      return id;
    }
  }

  const record: DownloadRecord = {
    id,
    type: input.type,
    tmdbId: input.tmdbId,
    title: input.title,
    posterPath: input.posterPath,
    quality: input.quality,
    lang: input.lang,
    subtitleLang: input.subtitleLang,
    status: 'queued',
    receivedBytes: 0,
    totalBytes: 0,
    progress: 0,
    mime: input.mime,
    error: null,
    createdAt: existing?.createdAt ?? Date.now(),
    completedAt: null,
    videoUrl: input.videoUrl,
    subtitleUrl: input.subtitleUrl,
  };
  if (input.season !== undefined) record.season = input.season;
  if (input.episode !== undefined) record.episode = input.episode;

  records.set(id, record);
  await idbPutRecord(record);
  notify();
  void runDownload(id);
  return id;
}

/** Cancel an active download and discard its partial bytes (record kept). */
export async function cancelDownload(id: string): Promise<void> {
  pauseIntent.delete(id);
  controllers.get(id)?.abort();
}

/** Pause an active download, keeping the bytes downloaded so far for resume. */
export async function pauseDownload(id: string): Promise<void> {
  const controller = controllers.get(id);
  if (!controller) return;
  pauseIntent.add(id);
  controller.abort();
}

/** Resume a paused download from where it left off (byte-range request). */
export async function resumeDownload(id: string): Promise<void> {
  await ensureLoaded();
  const record = records.get(id);
  if (!record || record.status === 'downloading') return;
  void runDownload(id, true);
}

/** Retry a failed/canceled download from scratch using its stored source URLs. */
export async function retryDownload(id: string): Promise<void> {
  await ensureLoaded();
  const record = records.get(id);
  if (!record || record.status === 'downloading') return;
  record.status = 'queued';
  record.progress = 0;
  record.receivedBytes = 0;
  record.totalBytes = 0;
  record.error = null;
  await idbDeleteBlob(id).catch(() => {});
  await idbPutRecord(record);
  notify();
  void runDownload(id, false);
}

/** Remove a download entirely (aborts if active, deletes record + blob). */
export async function removeDownload(id: string): Promise<void> {
  controllers.get(id)?.abort();
  records.delete(id);
  await idbDelete(id).catch(() => {});
  notify();
}

/**
 * Object URLs for a completed download's video (and subtitle, if any). Caller is
 * responsible for revoking them when done. Returns null if the blob is missing.
 */
export async function getDownloadObjectUrls(
  id: string,
): Promise<{ video: string; subtitle: string | null } | null> {
  const entry = await idbGetBlob(id);
  if (!entry) return null;
  return {
    video: URL.createObjectURL(entry.video),
    subtitle: entry.subtitle ? URL.createObjectURL(entry.subtitle) : null,
  };
}

export function isDownloadActive(status: DownloadStatus): boolean {
  return status === 'queued' || status === 'downloading' || status === 'paused';
}

export function formatBytes(bytes: number): string {
  if (!bytes || bytes < 0) return '0 MB';
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}
