import { cn } from '@/lib/utils';

interface SectionDividerProps {
  label: string;
  className?: string;
}

export function SectionDivider({ label, className }: SectionDividerProps) {
  return (
    <div className={cn('flex items-center gap-3 mb-4', className)}>
      <span className="h-px flex-1 bg-white/10" />
      <span className="text-xs font-semibold tracking-[0.2em] uppercase text-white/70 font-body">
        {label}
      </span>
      <span className="h-px flex-1 bg-white/10" />
    </div>
  );
}
