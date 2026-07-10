'use client';

import { useEffect } from 'react';

export function FullStoryInit() {
  useEffect(() => {
    const orgId = process.env.NEXT_PUBLIC_FULLSTORY_ORG;
    if (!orgId) return;

    // Defer until the browser is idle so FullStory's ~150 KB script doesn't
    // compete with first paint, hero images, and the trailer iframe handshake.
    // Falls back to a 3 s setTimeout when requestIdleCallback isn't available.
    const load = () => {
      import('@fullstory/browser').then(({ init }) => init({ orgId })).catch(() => {});
    };
    const w = window as Window & typeof globalThis;
    const handle =
      'requestIdleCallback' in w
        ? w.requestIdleCallback(load, { timeout: 5000 })
        : setTimeout(load, 3000);

    return () => {
      if ('cancelIdleCallback' in window && typeof handle === 'number') {
        (window as Window & typeof globalThis).cancelIdleCallback(handle);
      } else {
        clearTimeout(handle as ReturnType<typeof setTimeout>);
      }
    };
  }, []);

  return null;
}
