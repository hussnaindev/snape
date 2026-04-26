import { cn } from '@/lib/utils';
import Link from 'next/link';

interface WatchButtonsProps {
  href: string;
  fullWidth?: boolean;
  className?: string;
}

export function WatchButtons({ href, fullWidth, className }: WatchButtonsProps) {
  return (
    <div className={cn('flex gap-3 flex-wrap shrink-0', className)}>
      <Link
        href={href}
        className={cn(
          'inline-flex items-center gap-2 bg-white text-black font-semibold text-sm px-5 py-2 md:px-6 md:py-2.5 rounded-lg hover:bg-gray-200 transition-colors',
          fullWidth && 'w-full justify-center'
        )}
      >
        <span>▶</span> Watch
      </Link>
    </div>
  );
}