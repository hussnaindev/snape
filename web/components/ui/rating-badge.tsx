import { cn } from '@/lib/utils';

interface RatingBadgeProps {
  rating: number;
  className?: string;
}

export function RatingBadge({ rating, className }: RatingBadgeProps) {
  const score = rating.toFixed(1);
  const color =
    rating >= 7.5
      ? 'text-white border-white/40'
      : rating >= 6
        ? 'text-white border-white/40'
        : 'text-white/60 border-white/20';

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center gap-1 border rounded-full px-1.5 py-0.5 text-xs font-chesna-grotesk font-semibold tabular-nums',
        color,
        className,
      )}
    >
      ★ {score}
    </span>
  );
}
