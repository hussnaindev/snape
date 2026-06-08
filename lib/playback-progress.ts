/**
 * Tiny neutral pub/sub for live playback progress. The player publishes its
 * current position; the WatchHistoryRecorder (which owns metadata + auth) is the
 * sole subscriber that persists it. Keeps the player decoupled from storage and
 * avoids threading callbacks between the two siblings on every watch surface.
 */
export interface PlaybackProgress {
  type: 'movie' | 'tv';
  tmdbId: number;
  season?: number;
  episode?: number;
  positionSeconds: number;
  durationSeconds: number;
  /** true on the final report when playback reaches the end. */
  ended: boolean;
}

type Listener = (p: PlaybackProgress) => void;

const listeners = new Set<Listener>();

export function publishPlaybackProgress(p: PlaybackProgress): void {
  for (const l of listeners) l(p);
}

export function subscribePlaybackProgress(l: Listener): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
