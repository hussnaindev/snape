'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type FitMode = 'contain' | 'cover';

function computeCoverScale(containerW: number, containerH: number, contentAspect: number) {
  if (!containerW || !containerH) return 1;
  const containerAspect = containerW / containerH;
  return Math.max(containerAspect / contentAspect, contentAspect / containerAspect);
}

export function WatchPlayer({
  src,
  title,
  contentAspect = 16 / 9,
}: {
  src: string;
  title: string;
  /**
   * Most embeds are 16:9. If a provider uses another ratio, pass it in.
   */
  contentAspect?: number;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const gestureRef = useRef<{
    active: boolean;
    startX1: number;
    startY1: number;
    startX2: number;
    startY2: number;
    toggled: boolean;
  } | null>(null);

  const [fitMode, setFitMode] = useState<FitMode>('contain');
  const [coverScale, setCoverScale] = useState(1);

  const scale = useMemo(() => (fitMode === 'cover' ? coverScale : 1), [fitMode, coverScale]);

  useEffect(() => {
    function update() {
      const el = containerRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setCoverScale(computeCoverScale(r.width, r.height, contentAspect));
    }
    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, [contentAspect]);

  function onTouchStart(e: React.TouchEvent) {
    if (e.touches.length !== 2) return;
    const t1 = e.touches.item(0);
    const t2 = e.touches.item(1);
    if (!t1 || !t2) return;

    gestureRef.current = {
      active: true,
      startX1: t1.clientX,
      startY1: t1.clientY,
      startX2: t2.clientX,
      startY2: t2.clientY,
      toggled: false,
    };
  }

  function onTouchMove(e: React.TouchEvent) {
    const g = gestureRef.current;
    if (!g?.active) return;
    if (e.touches.length !== 2) return;

    const t1 = e.touches.item(0);
    const t2 = e.touches.item(1);
    if (!t1 || !t2) return;

    const dx1 = t1.clientX - g.startX1;
    const dy1 = t1.clientY - g.startY1;
    const dx2 = t2.clientX - g.startX2;
    const dy2 = t2.clientY - g.startY2;

    // Two-finger horizontal "spread": fingers move in opposite x directions,
    // with mostly horizontal motion. Toggle once per gesture.
    const oppositeX =
      Math.sign(dx1) !== 0 && Math.sign(dx2) !== 0 && Math.sign(dx1) !== Math.sign(dx2);
    const horizontal1 = Math.abs(dx1) > Math.abs(dy1) * 1.5;
    const horizontal2 = Math.abs(dx2) > Math.abs(dy2) * 1.5;
    const farEnough = Math.abs(dx1) > 28 && Math.abs(dx2) > 28;

    if (!g.toggled && oppositeX && horizontal1 && horizontal2 && farEnough) {
      g.toggled = true;
      e.preventDefault();
      setFitMode((m) => (m === 'contain' ? 'cover' : 'contain'));
    }
  }

  function onTouchEnd() {
    gestureRef.current = null;
  }

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 player-safe-area overflow-hidden"
      style={{
        touchAction: 'none',
      }}
    >
      <iframe
        src={src}
        className="w-full h-full"
        style={{
          transform: scale === 1 ? undefined : `scale(${scale})`,
          transformOrigin: 'center center',
        }}
        allowFullScreen
        allow="autoplay; fullscreen; accelerometer; gyroscope; picture-in-picture"
        title={title}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
      />
    </div>
  );
}

