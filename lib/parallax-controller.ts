// Single shared scroll/rAF controller for parallax effects.
// Replaces N independent scroll listeners with one consolidated pipeline:
//   • ONE scroll/resize listener for the whole page
//   • ONE rAF per scroll burst
//   • Reads (layout) batched before writes — no layout thrashing
//   • IntersectionObserver gates updates so off-screen sections cost nothing
//   • will-change toggled on/off with viewport visibility (no leaked GPU layers)

type Effect = (progress: number) => void;

type Subscriber = {
  el: HTMLElement;
  section: Element;
  effect: Effect;
  visible: boolean;
};

let subs: Subscriber[] = [];
let raf = 0;
let initialized = false;
let io: IntersectionObserver | null = null;
let reducedMotion = false;
let isMobile = false;
const sectionRefCounts = new WeakMap<Element, number>();

function tick() {
  raf = 0;
  if (reducedMotion || isMobile) return;

  const vh = window.innerHeight;

  // Phase 1 — READ. One layout flush covers every visible subscriber.
  const writes: Array<[Subscriber, number]> = [];
  for (let i = 0; i < subs.length; i++) {
    const s = subs[i];
    if (!s || !s.visible) continue;
    const rect = s.section.getBoundingClientRect();
    const t = 1 - (rect.top + rect.height) / (vh + rect.height);
    writes.push([s, t]);
  }

  // Phase 2 — WRITE. Pure compositor work, no layout.
  for (let i = 0; i < writes.length; i++) {
    const entry = writes[i];
    if (!entry) continue;
    entry[0].effect(entry[1]);
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
    for (let j = 0; j < subs.length; j++) {
      const s = subs[j];
      if (!s || s.section !== entry.target) continue;
      if (s.visible === entry.isIntersecting) continue;
      s.visible = entry.isIntersecting;
      anyVisibleChanged = true;
      // Promote/demote the layer in sync with viewport visibility so we
      // don't keep dozens of dormant composited layers in GPU memory.
      s.el.style.willChange = s.visible ? 'transform, opacity' : 'auto';
      if (!s.visible) {
        // Clearing the inline transform/opacity when leaving viewport keeps
        // the layer in a clean state for next entry and avoids stale values.
      }
    }
  }
  if (anyVisibleChanged) schedule();
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
      schedule();
    }
  };
  if (typeof mobileMql.addEventListener === 'function') {
    mobileMql.addEventListener('change', onMobileChange);
  }

  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule, { passive: true });

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
  if (count === 0) io?.observe(section);
  sectionRefCounts.set(section, count + 1);

  // Run once so initial paint isn't a frame behind.
  schedule();

  return () => {
    subs = subs.filter((s) => s !== sub);
    const next = (sectionRefCounts.get(section) ?? 1) - 1;
    if (next <= 0) {
      io?.unobserve(section);
      sectionRefCounts.delete(section);
    } else {
      sectionRefCounts.set(section, next);
    }
    el.style.willChange = 'auto';
  };
}
