// Single shared scroll/rAF controller for parallax effects.
// Replaces N independent scroll listeners with one consolidated pipeline:
//   • ONE scroll/resize listener for the whole page
//   • ONE rAF per scroll burst
//   • Section rects cached — no getBoundingClientRect() inside the tick loop
//   • IntersectionObserver gates updates so off-screen sections cost nothing
//   • will-change: transform toggled with viewport visibility (no leaked GPU layers)
//   • Transform-only effects — no opacity (avoids scroll repaints on desktop)

type Effect = (progress: number) => void;

type Subscriber = {
  el: HTMLElement;
  section: Element;
  effect: Effect;
  visible: boolean;
};

type SectionMetrics = {
  documentTop: number;
  height: number;
};

let subs: Subscriber[] = [];
let raf = 0;
let initialized = false;
let io: IntersectionObserver | null = null;
let reducedMotion = false;
let isMobile = false;
const sectionRefCounts = new WeakMap<Element, number>();
const sectionMetrics = new WeakMap<Element, SectionMetrics>();

function measureSection(section: Element, rect?: DOMRectReadOnly) {
  const r = rect ?? section.getBoundingClientRect();
  sectionMetrics.set(section, {
    documentTop: r.top + window.scrollY,
    height: r.height,
  });
}

function tick() {
  raf = 0;
  if (reducedMotion || isMobile) return;

  const vh = window.innerHeight;
  const scrollY = window.scrollY;

  // Pure compositor work — no layout reads, all metrics come from the cache.
  for (let i = 0; i < subs.length; i++) {
    const s = subs[i];
    if (!s || !s.visible) continue;
    const m = sectionMetrics.get(s.section);
    if (!m) continue;
    const top = m.documentTop - scrollY;
    const t = 1 - (top + m.height) / (vh + m.height);
    s.effect(t);
  }
}

function schedule() {
  if (raf || reducedMotion || isMobile) return;
  raf = requestAnimationFrame(tick);
}

function onVisibilityChange(entries: IntersectionObserverEntry[]) {
  let anyVisibleChanged = false;
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (!entry) continue;
    // Refresh cached metrics whenever the section crosses the intersection
    // root margin — this is the right cadence for catching layout shifts
    // from late-loading images / fonts without thrashing on every scroll frame.
    measureSection(entry.target, entry.boundingClientRect);
    for (let j = 0; j < subs.length; j++) {
      const s = subs[j];
      if (!s || s.section !== entry.target) continue;
      if (s.visible === entry.isIntersecting) continue;
      s.visible = entry.isIntersecting;
      anyVisibleChanged = true;
      // Promote/demote the layer in sync with viewport visibility so we
      // don't keep dozens of dormant composited layers in GPU memory.
      s.el.style.willChange = s.visible ? 'transform' : 'auto';
    }
  }
  if (anyVisibleChanged) schedule();
}

function refreshAllMetrics() {
  // Resize / orientation change: full re-measure.
  const seen = new Set<Element>();
  for (let i = 0; i < subs.length; i++) {
    const s = subs[i];
    if (!s) continue;
    if (seen.has(s.section)) continue;
    seen.add(s.section);
    measureSection(s.section);
  }
}

function init() {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mobileMql = window.matchMedia('(max-width: 639px)');
  isMobile = mobileMql.matches;

  // Re-evaluate on breakpoint switches (rotate, devtools, etc.)
  const onMobileChange = (e: MediaQueryListEvent) => {
    isMobile = e.matches;
    if (isMobile) {
      // Reset any inline transforms so mobile layout is clean.
      for (let i = 0; i < subs.length; i++) {
        const s = subs[i];
        if (!s) continue;
        s.el.style.transform = '';
        s.el.style.opacity = '';
        s.el.style.willChange = 'auto';
      }
    } else {
      refreshAllMetrics();
      schedule();
    }
  };
  if (typeof mobileMql.addEventListener === 'function') {
    mobileMql.addEventListener('change', onMobileChange);
  }

  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener(
    'resize',
    () => {
      refreshAllMetrics();
      schedule();
    },
    { passive: true },
  );

  // 200px rootMargin keeps the effect smooth at the seam — we begin updating
  // just before the section is on-screen so there's no perceived jump.
  io = new IntersectionObserver(onVisibilityChange, {
    rootMargin: '200px 0px 200px 0px',
    threshold: 0,
  });
}

export function registerParallax(
  el: HTMLElement,
  section: Element,
  effect: Effect,
): () => void {
  init();

  const sub: Subscriber = { el, section, effect, visible: false };
  subs.push(sub);

  const count = sectionRefCounts.get(section) ?? 0;
  if (count === 0) {
    measureSection(section);
    io?.observe(section);
  }
  sectionRefCounts.set(section, count + 1);

  // Run once so initial paint isn't a frame behind.
  schedule();

  return () => {
    subs = subs.filter((s) => s !== sub);
    const next = (sectionRefCounts.get(section) ?? 1) - 1;
    if (next <= 0) {
      io?.unobserve(section);
      sectionRefCounts.delete(section);
      sectionMetrics.delete(section);
    } else {
      sectionRefCounts.set(section, next);
    }
    el.style.willChange = 'auto';
    el.style.transform = '';
    el.style.opacity = '';
  };
}
