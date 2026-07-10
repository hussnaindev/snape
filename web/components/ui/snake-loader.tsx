import { Logo } from '@/components/ui/logo';
import { cn } from '@/lib/utils';

interface SnakeLoaderProps {
  size?: number;
  className?: string;
}

const R = 44;
const CIRC = 2 * Math.PI * R; // ≈ 276.46
const ARC = CIRC * 0.75;
const GAP = CIRC - ARC;

export function SnakeLoader({ size = 64, className }: SnakeLoaderProps) {
  const logoSize = Math.round(size * 0.45);

  return (
    <div
      className={cn('relative flex items-center justify-center', className)}
      style={{ width: size, height: size }}
      role="status"
      aria-label="Loading"
    >
      {/* Spinning arc ring */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        className="absolute inset-0 animate-snake"
        aria-hidden="true"
      >
        {/* Faint track */}
        <circle cx="50" cy="50" r={R} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="3" />
        {/* Spinning arc */}
        <circle
          cx="50"
          cy="50"
          r={R}
          fill="none"
          stroke="#ffffff"
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeDasharray={`${ARC} ${GAP}`}
          transform="rotate(-90 50 50)"
          style={{ filter: 'drop-shadow(0 0 5px rgba(255,255,255,0.7))' }}
        />
      </svg>

      {/* Logo — static, centered, with subtle glow */}
      <Logo
        className="relative text-white"
        style={{
          width: logoSize,
          height: logoSize,
          filter: 'drop-shadow(0 0 6px rgba(255,255,255,0.5))',
        }}
      />
    </div>
  );
}
