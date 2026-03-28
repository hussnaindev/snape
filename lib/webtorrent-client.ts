'use client';

/**
 * Browser-only WebTorrent singleton.
 * Never import from server components or API routes.
 */

import type WebTorrent from 'webtorrent';

type WebTorrentInstance = InstanceType<typeof WebTorrent>;

let instance: WebTorrentInstance | null = null;
let loading: Promise<WebTorrentInstance> | null = null;

export async function getWebTorrentClient(): Promise<WebTorrentInstance> {
  if (typeof window === 'undefined') {
    throw new Error('WebTorrent is browser-only');
  }
  if (instance) return instance;
  if (loading) return loading;

  loading = import('webtorrent').then(({ default: WebTorrentClass }) => {
    instance = new WebTorrentClass();
    return instance;
  });

  return loading;
}

export function destroyWebTorrentClient(): void {
  if (instance) {
    instance.destroy();
    instance = null;
    loading = null;
  }
}
