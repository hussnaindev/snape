import { cn } from '@/lib/utils';

interface TagChipProps {
  label: string;
  onClick?: () => void;
  active?: boolean;
  className?: string;
}

export function TagChip({ label, onClick, active, className }: TagChipProps) {
  const Tag = onClick ? 'button' : 'span';
  return (
    <Tag
      onClick={onClick}
      className={cn(
        'inline-flex items-center px-3 py-1 rounded-md text-xs font-medium tracking-wide uppercase border transition-colors',
        active
          ? 'bg-white/10 border-white/50 text-white'
          : 'bg-white/5 border-white/10 text-white/70 hover:border-white/30 hover:text-white',
        onClick && 'cursor-pointer',
        className,
      )}
    >
      {label}
    </Tag>
  );
}
