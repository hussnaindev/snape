import { cn } from '@/lib/utils';
import Link from 'next/link';

interface WatchButtonsProps {
  href: string;
  fullWidth?: boolean;
}

export function WatchButtons({ href, fullWidth }: WatchButtonsProps) {
  return (
    <div className="flex gap-3 flex-wrap">
      <Link
        href={href}
        className={cn(
          'inline-flex items-center gap-2 bg-white text-black font-semibold text-sm px-6 py-2.5 rounded-lg hover:bg-gray-200 transition-colors',
          fullWidth && 'w-full justify-center',
        )}
      >
        <span>▶</span> Watch
      </Link>
    </div>
  );
}
