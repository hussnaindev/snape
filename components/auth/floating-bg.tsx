import type { CSSProperties } from 'react';

type Card = { outer: CSSProperties; bg: string; dur: string; delay: string };

const CARDS: Card[] = [
  {
    outer: { top: '7%', left: '3%', width: 110, height: 156, transform: 'rotate(-14deg)' },
    bg: 'linear-gradient(135deg,rgba(59,130,246,.35),rgba(109,40,217,.22))',
    dur: '7s', delay: '0s',
  },
  {
    outer: { top: '54%', left: '1%', width: 96, height: 138, transform: 'rotate(11deg)' },
    bg: 'linear-gradient(135deg,rgba(16,185,129,.28),rgba(6,78,59,.2))',
    dur: '8.5s', delay: '2s',
  },
  {
    outer: { top: '19%', right: '2%', width: 106, height: 150, transform: 'rotate(13deg)' },
    bg: 'linear-gradient(135deg,rgba(239,68,68,.28),rgba(153,27,27,.2))',
    dur: '6.5s', delay: '1s',
  },
  {
    outer: { top: '67%', right: '3%', width: 100, height: 143, transform: 'rotate(-9deg)' },
    bg: 'linear-gradient(135deg,rgba(245,158,11,.24),rgba(120,53,15,.18))',
    dur: '9s', delay: '3s',
  },
  {
    outer: { top: '16%', left: '13%', width: 84, height: 120, transform: 'rotate(19deg)' },
    bg: 'linear-gradient(135deg,rgba(168,85,247,.24),rgba(88,28,135,.17))',
    dur: '7.5s', delay: '1.5s',
  },
  {
    outer: { top: '41%', right: '10%', width: 88, height: 126, transform: 'rotate(-21deg)' },
    bg: 'linear-gradient(135deg,rgba(236,72,153,.22),rgba(157,23,77,.15))',
    dur: '8s', delay: '2.5s',
  },
  {
    outer: { bottom: '12%', left: '17%', width: 82, height: 117, transform: 'rotate(-6deg)' },
    bg: 'linear-gradient(135deg,rgba(14,165,233,.22),rgba(7,89,133,.15))',
    dur: '6s', delay: '0.5s',
  },
  {
    outer: { bottom: '9%', right: '13%', width: 93, height: 133, transform: 'rotate(8deg)' },
    bg: 'linear-gradient(135deg,rgba(34,197,94,.2),rgba(21,128,61,.14))',
    dur: '7s', delay: '3.5s',
  },
];

export function FloatingAuthBg() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none select-none" aria-hidden="true">
      {CARDS.map((card, i) => (
        <div key={i} className="absolute" style={card.outer}>
          <div
            className="w-full h-full rounded-xl border border-white/10 animate-float"
            style={{
              background: card.bg,
              animationDuration: card.dur,
              animationDelay: card.delay,
              backdropFilter: 'blur(1px)',
            }}
          />
        </div>
      ))}
    </div>
  );
}
