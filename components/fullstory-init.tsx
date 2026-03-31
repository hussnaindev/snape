'use client';

import { init } from '@fullstory/browser';
import { useEffect } from 'react';

export function FullStoryInit() {
  useEffect(() => {
    const orgId = process.env.NEXT_PUBLIC_FULLSTORY_ORG;
    if (!orgId) return;
    init({ orgId });
  }, []);

  return null;
}
