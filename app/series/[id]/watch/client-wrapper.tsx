'use client';

import { SnakeLoader } from '@/components/ui/snake-loader';
import { APP_NAME } from '@/lib/config';
import { useEffect, useState } from 'react';

const STORAGE_KEY = 'watch-loading';

interface Props {
  children: React.ReactNode;
}

export function ClientWatchWrapper({ children }: Props) {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window !== 'undefined' && sessionStorage.getItem(STORAGE_KEY)) {
      sessionStorage.removeItem(STORAGE_KEY);
      const timer = setTimeout(() => setLoading(false), 300);
      return () => clearTimeout(timer);
    }
    setLoading(false);
  }, []);

  if (!loading) return <>{children}</>;

  return (
    <div className="fixed inset-0 bg-black flex flex-col items-center justify-center gap-6">
      <SnakeLoader size={72} />
      <span className="font-body text-white/30 text-xs tracking-[0.28em] uppercase">
        {APP_NAME}
      </span>
    </div>
  );
}
