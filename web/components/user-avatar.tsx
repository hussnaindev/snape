'use client';

import { cn } from '@/lib/utils';
import Image from 'next/image';

function hashName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return Math.abs(h);
}

interface Props {
  name: string;
  avatarUrl?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeMap = { sm: 'w-7 h-7', md: 'w-9 h-9', lg: 'w-20 h-20' };

export function UserAvatar({ name, avatarUrl, size = 'md', className }: Props) {
  if (avatarUrl) {
    return (
      <div
        className={cn('relative rounded-full overflow-hidden flex-none', sizeMap[size], className)}
      >
        <Image
          src={avatarUrl}
          alt={name}
          fill
          className="object-cover"
          sizes="80px"
          unoptimized={avatarUrl.startsWith('data:')}
        />
      </div>
    );
  }

  const variant = hashName(name) % 8;
  return (
    <div
      className={cn(
        'rounded-full overflow-hidden flex-none flex-shrink-0',
        sizeMap[size],
        className,
      )}
      aria-label={name}
    >
      <GraphicAvatar variant={variant} />
    </div>
  );
}

function GraphicAvatar({ variant }: { variant: number }) {
  const id = `av${variant}`;

  switch (variant) {
    // ── 0: Cosmos — deep space, crescent + star field ──
    case 0:
      return (
        <svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <defs>
            <radialGradient id={`${id}g`} cx="40%" cy="35%" r="75%">
              <stop offset="0%" stopColor="#3b1f7a" />
              <stop offset="55%" stopColor="#1a1145" />
              <stop offset="100%" stopColor="#0b0820" />
            </radialGradient>
            <radialGradient id={`${id}g2`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#7c3aed" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect width="40" height="40" fill={`url(#${id}g)`} />
          <circle cx="20" cy="20" r="18" fill={`url(#${id}g2)`} />
          {/* crescent */}
          <circle cx="21" cy="19" r="9.5" fill="rgba(200,180,255,0.22)" />
          <circle cx="25.5" cy="16.5" r="9.5" fill="#0f0a2e" />
          {/* star field */}
          <circle cx="7" cy="8" r="1.2" fill="white" opacity="0.95" />
          <circle cx="31" cy="6" r="0.7" fill="white" opacity="0.8" />
          <circle cx="35" cy="22" r="1.0" fill="white" opacity="0.7" />
          <circle cx="9" cy="29" r="0.8" fill="white" opacity="0.85" />
          <circle cx="15" cy="37" r="0.6" fill="white" opacity="0.5" />
          <circle cx="5" cy="18" r="0.5" fill="white" opacity="0.7" />
          <circle cx="34" cy="34" r="0.7" fill="white" opacity="0.6" />
          <circle cx="28" cy="38" r="0.5" fill="white" opacity="0.5" />
          <circle cx="3" cy="35" r="0.9" fill="white" opacity="0.6" />
          <circle cx="38" cy="10" r="0.6" fill="white" opacity="0.7" />
        </svg>
      );

    // ── 1: Ember — dark crimson, bold flame ──
    case 1:
      return (
        <svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <defs>
            <radialGradient id={`${id}g`} cx="50%" cy="80%" r="70%">
              <stop offset="0%" stopColor="#7f1d1d" />
              <stop offset="60%" stopColor="#450a0a" />
              <stop offset="100%" stopColor="#1c0303" />
            </radialGradient>
            <radialGradient id={`${id}glow`} cx="50%" cy="75%" r="50%">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect width="40" height="40" fill={`url(#${id}g)`} />
          <ellipse cx="20" cy="30" rx="13" ry="8" fill={`url(#${id}glow)`} />
          {/* outer flame */}
          <path
            d="M20 36 C10 31 8 20 13 11 C14.5 19 17 17 17 12 C19 16 21 20.5 20.5 26 C22.5 22 23 16 20.5 8 C27 13 31 23 27 31 C25 34.5 22.5 37 20 36Z"
            fill="rgba(251,146,60,0.55)"
          />
          {/* inner flame core */}
          <path
            d="M20 34 C14 30 13 22.5 16.5 16 C17.5 21 18.5 20 18.5 17 C20 19.5 20.5 23 20 27 C21.5 24 22 20 20 14.5 C25 18 27 24.5 24 30 C22.5 32.5 21 35 20 34Z"
            fill="rgba(254,215,170,0.5)"
          />
          {/* bright core */}
          <path
            d="M20 32 C16.5 29.5 16 25 18 21 C18.5 23.5 19 23 19 21.5 C20 23 20 25 19.5 27 C20.5 25.5 21 23 19.5 20 C22.5 22 23.5 26 22 29 C21 31 20.5 32.5 20 32Z"
            fill="rgba(255,245,230,0.45)"
          />
        </svg>
      );

    // ── 2: Abyss — deep navy, bioluminescent depth ──
    case 2:
      return (
        <svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <defs>
            <radialGradient id={`${id}g`} cx="50%" cy="55%" r="70%">
              <stop offset="0%" stopColor="#0c4a6e" />
              <stop offset="55%" stopColor="#082f49" />
              <stop offset="100%" stopColor="#030e18" />
            </radialGradient>
            <radialGradient id={`${id}glow`} cx="50%" cy="52%" r="40%">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect width="40" height="40" fill={`url(#${id}g)`} />
          <circle cx="20" cy="21" r="16" fill={`url(#${id}glow)`} />
          {/* concentric rings — light from below */}
          <circle
            cx="20"
            cy="21"
            r="12"
            fill="none"
            stroke="rgba(125,211,252,0.18)"
            strokeWidth="1"
          />
          <circle
            cx="20"
            cy="21"
            r="8"
            fill="none"
            stroke="rgba(125,211,252,0.22)"
            strokeWidth="1"
          />
          <circle
            cx="20"
            cy="21"
            r="4.5"
            fill="none"
            stroke="rgba(125,211,252,0.30)"
            strokeWidth="1"
          />
          <circle cx="20" cy="21" r="2" fill="rgba(186,230,253,0.6)" />
          {/* floating particles */}
          <circle cx="12" cy="14" r="0.8" fill="rgba(186,230,253,0.5)" />
          <circle cx="28" cy="11" r="0.6" fill="rgba(186,230,253,0.4)" />
          <circle cx="31" cy="27" r="0.9" fill="rgba(186,230,253,0.5)" />
          <circle cx="9" cy="28" r="0.7" fill="rgba(186,230,253,0.45)" />
          <circle cx="16" cy="34" r="0.6" fill="rgba(186,230,253,0.35)" />
          <circle cx="25" cy="32" r="0.8" fill="rgba(186,230,253,0.4)" />
          {/* wave lines */}
          <path
            d="M2 30 Q10 27 20 30 Q30 33 38 30"
            stroke="rgba(125,211,252,0.15)"
            strokeWidth="1"
            fill="none"
          />
          <path
            d="M2 35 Q10 32 20 35 Q30 38 38 35"
            stroke="rgba(125,211,252,0.12)"
            strokeWidth="1"
            fill="none"
          />
        </svg>
      );

    // ── 3: Verdant — dark emerald, pine forest + full moon ──
    case 3:
      return (
        <svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <defs>
            <linearGradient id={`${id}g`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#052e16" />
              <stop offset="55%" stopColor="#14532d" />
              <stop offset="100%" stopColor="#166534" />
            </linearGradient>
          </defs>
          <rect width="40" height="40" fill={`url(#${id}g)`} />
          {/* moon glow */}
          <circle cx="29" cy="10" r="9" fill="rgba(254,240,138,0.12)" />
          {/* moon */}
          <circle cx="29" cy="10" r="5.5" fill="rgba(254,240,138,0.85)" />
          <circle cx="31" cy="9" r="5.5" fill="#052e16" />
          {/* back trees */}
          <polygon points="6,34 12,18 18,34" fill="rgba(255,255,255,0.07)" />
          <polygon points="18,34 25,14 32,34" fill="rgba(255,255,255,0.09)" />
          {/* front trees */}
          <polygon points="0,40 8,22 16,40" fill="rgba(255,255,255,0.12)" />
          <polygon points="12,40 20,20 28,40" fill="rgba(255,255,255,0.14)" />
          <polygon points="24,40 32,24 40,40" fill="rgba(255,255,255,0.11)" />
          {/* ground */}
          <rect x="0" y="37" width="40" height="3" fill="rgba(0,0,0,0.3)" />
        </svg>
      );

    // ── 4: Petal — deep rose, layered mandala ──
    case 4:
      return (
        <svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <defs>
            <radialGradient id={`${id}g`} cx="50%" cy="50%" r="70%">
              <stop offset="0%" stopColor="#831843" />
              <stop offset="60%" stopColor="#9d174d" />
              <stop offset="100%" stopColor="#500724" />
            </radialGradient>
          </defs>
          <rect width="40" height="40" fill={`url(#${id}g)`} />
          {/* outer ring petals — 8 petals */}
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
            <ellipse
              key={deg}
              cx="20"
              cy="20"
              rx="3.5"
              ry="8.5"
              fill="rgba(255,255,255,0.12)"
              transform={`rotate(${deg} 20 20) translate(0 -6)`}
            />
          ))}
          {/* inner ring petals — 6 petals */}
          {[0, 60, 120, 180, 240, 300].map((deg) => (
            <ellipse
              key={deg}
              cx="20"
              cy="20"
              rx="2.5"
              ry="5.5"
              fill="rgba(255,255,255,0.2)"
              transform={`rotate(${deg} 20 20) translate(0 -3.5)`}
            />
          ))}
          {/* center */}
          <circle cx="20" cy="20" r="3.5" fill="rgba(255,255,255,0.35)" />
          <circle cx="20" cy="20" r="1.5" fill="rgba(255,255,255,0.7)" />
        </svg>
      );

    // ── 5: Aurora — midnight blue, sweeping light curtains ──
    case 5:
      return (
        <svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <defs>
            <linearGradient id={`${id}g`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#020617" />
              <stop offset="50%" stopColor="#0c1a35" />
              <stop offset="100%" stopColor="#0e1f3d" />
            </linearGradient>
          </defs>
          <rect width="40" height="40" fill={`url(#${id}g)`} />
          {/* aurora bands — teal green */}
          <path
            d="M-2 2 Q5 18 2 38"
            stroke="rgba(52,211,153,0.55)"
            strokeWidth="7"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M7 0 Q15 16 11 40"
            stroke="rgba(16,185,129,0.40)"
            strokeWidth="6"
            fill="none"
            strokeLinecap="round"
          />
          {/* aurora bands — purple/indigo */}
          <path
            d="M18 0 Q24 18 20 40"
            stroke="rgba(139,92,246,0.45)"
            strokeWidth="7"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M28 0 Q33 16 30 40"
            stroke="rgba(99,102,241,0.35)"
            strokeWidth="5"
            fill="none"
            strokeLinecap="round"
          />
          {/* aurora bands — blue */}
          <path
            d="M38 2 Q40 20 38 40"
            stroke="rgba(56,189,248,0.3)"
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
          />
          {/* stars */}
          <circle cx="6" cy="4" r="0.9" fill="white" opacity="0.9" />
          <circle cx="22" cy="3" r="0.7" fill="white" opacity="0.75" />
          <circle cx="35" cy="5" r="1.0" fill="white" opacity="0.8" />
          <circle cx="14" cy="8" r="0.6" fill="white" opacity="0.65" />
          <circle cx="30" cy="9" r="0.7" fill="white" opacity="0.7" />
        </svg>
      );

    // ── 6: Prism — dark teal, gem facets with light play ──
    case 6:
      return (
        <svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <defs>
            <linearGradient id={`${id}g`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#042f2e" />
              <stop offset="50%" stopColor="#0f766e" />
              <stop offset="100%" stopColor="#134e4a" />
            </linearGradient>
            <radialGradient id={`${id}shine`} cx="35%" cy="30%" r="60%">
              <stop offset="0%" stopColor="rgba(94,234,212,0.3)" />
              <stop offset="100%" stopColor="rgba(94,234,212,0)" />
            </radialGradient>
          </defs>
          <rect width="40" height="40" fill={`url(#${id}g)`} />
          <rect width="40" height="40" fill={`url(#${id}shine)`} />
          {/* gem outline */}
          <polygon
            points="20,3 36,16 32,37 8,37 4,16"
            fill="rgba(255,255,255,0.06)"
            stroke="rgba(255,255,255,0.12)"
            strokeWidth="0.5"
          />
          {/* facet lines */}
          <line x1="20" y1="3" x2="20" y2="20" stroke="rgba(255,255,255,0.15)" strokeWidth="0.6" />
          <line x1="4" y1="16" x2="36" y2="16" stroke="rgba(255,255,255,0.12)" strokeWidth="0.6" />
          <line x1="4" y1="16" x2="20" y2="20" stroke="rgba(255,255,255,0.10)" strokeWidth="0.5" />
          <line x1="36" y1="16" x2="20" y2="20" stroke="rgba(255,255,255,0.10)" strokeWidth="0.5" />
          <line x1="8" y1="37" x2="20" y2="20" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />
          <line x1="32" y1="37" x2="20" y2="20" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />
          {/* bright top facet */}
          <polygon points="20,3 36,16 20,20" fill="rgba(255,255,255,0.12)" />
          {/* highlight dot */}
          <circle cx="26" cy="10" r="2" fill="rgba(255,255,255,0.4)" />
          <circle cx="27" cy="9" r="1" fill="rgba(255,255,255,0.6)" />
        </svg>
      );

    // ── 7: Solstice — warm amber, radiant sun above horizon ──
    default:
      return (
        <svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <defs>
            <linearGradient id={`${id}g`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#78350f" />
              <stop offset="55%" stopColor="#92400e" />
              <stop offset="100%" stopColor="#451a03" />
            </linearGradient>
            <radialGradient id={`${id}sun`} cx="50%" cy="65%" r="50%">
              <stop offset="0%" stopColor="rgba(253,186,116,0.55)" />
              <stop offset="100%" stopColor="rgba(253,186,116,0)" />
            </radialGradient>
          </defs>
          <rect width="40" height="40" fill={`url(#${id}g)`} />
          {/* horizon glow */}
          <ellipse cx="20" cy="28" rx="24" ry="10" fill={`url(#${id}sun)`} />
          {/* rays — above horizon only */}
          {[-70, -50, -30, -10, 10, 30, 50, 70].map((a) => {
            const rad = (a * Math.PI) / 180;
            const r1 = 13;
            const r2 = 18 + (Math.abs(a) < 20 ? 2 : 0);
            return (
              <line
                key={a}
                x1={20 + r1 * Math.sin(rad)}
                y1={28 - r1 * Math.cos(rad)}
                x2={20 + r2 * Math.sin(rad)}
                y2={28 - r2 * Math.cos(rad)}
                stroke="rgba(251,191,36,0.45)"
                strokeWidth={Math.abs(a) < 15 ? 1.8 : 1.3}
                strokeLinecap="round"
              />
            );
          })}
          {/* horizon line */}
          <line x1="0" y1="28" x2="40" y2="28" stroke="rgba(253,186,116,0.4)" strokeWidth="0.8" />
          {/* sun — half above horizon */}
          <clipPath id={`${id}clip`}>
            <rect x="0" y="0" width="40" height="28" />
          </clipPath>
          <circle cx="20" cy="28" r="10" fill="rgba(251,191,36,0.7)" clipPath={`url(#${id}clip)`} />
          <circle
            cx="20"
            cy="28"
            r="7"
            fill="rgba(254,240,138,0.75)"
            clipPath={`url(#${id}clip)`}
          />
          <circle cx="20" cy="28" r="4" fill="rgba(255,251,235,0.8)" clipPath={`url(#${id}clip)`} />
        </svg>
      );
  }
}
