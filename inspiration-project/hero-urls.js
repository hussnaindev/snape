// ── Swan · hero-urls.js ───────────────────────────────────────────────────────
// All hero banner video URLs, grouped by section.
// Raw CDN URLs live ONLY here. proxy() from config.js routes them through CFW.
// Load order: config.js → hero-urls.js → index.html / reels.html

var HERO_URLS = {
  // Section 1 — Brand New
  brandNew: [
    'https://cdn-sfw.vixen.com/statics/sizzle_brand_shelf_video_mobile_860x740.mp4',
    'https://cdn-sfw.tushy.com/statics/sizzle_brand_shelf_video_mobile_860x740.mp4',
    'https://cdn-sfw.blacked.com/statics/sizzle_brand_shelf_video_mobile_860x740.mp4',
    'https://cdn-sfw.slayed.com/statics/sizzle_brand_shelf_video_mobile_860x740.mp4',
  ].map(proxy),
  brandNewDesktop: [
    'https://cdn-sfw.vixen.com/statics/sizzle_brand_shelf_video_desktop_3840x1292.mp4',
    'https://cdn-sfw.tushy.com/statics/sizzle_brand_shelf_video_desktop_3840x1292.mp4',
    'https://cdn-sfw.blacked.com/statics/sizzle_brand_shelf_video_desktop_3840x1292.mp4',
    'https://cdn-sfw.slayed.com/statics/sizzle_brand_shelf_video_desktop_3840x1292.mp4',
  ],
  // Section 2 — Hottest
  hottest: [
    'https://cdn-sfw.deeper.com/statics/sizzle_brand_shelf_video_mobile_860x740.mp4',
    'https://cdn-sfw.tushyraw.com/statics/sizzle_brand_shelf_video_mobile_860x740.mp4',
    'https://cdn-sfw.wifey.com/statics/sizzle_brand_shelf_video_mobile_860x740.mp4',
    'https://cdn-sfw.milfy.com/statics/sizzle_brand_shelf_video_mobile_860x740.mp4',
  ].map(proxy),
  hottestDesktop: [
    'https://cdn-sfw.deeper.com/statics/sizzle_brand_shelf_video_desktop_3840x1292.mp4',
    'https://cdn-sfw.tushyraw.com/statics/sizzle_brand_shelf_video_desktop_3840x1292.mp4',
    'https://cdn-sfw.wifey.com/statics/sizzle_brand_shelf_video_desktop_3840x1292.mp4',
    'https://cdn-sfw.milfy.com/statics/sizzle_brand_shelf_video_desktop_3840x1292.mp4',
  ].map(proxy),

  // Section 3 — BTS
  bts: [
    'https://cdn-sfw.vixen.com/statics/bts_benefit_shelf_video_desktop_mobile_1012x620.mp4',
  ].map(proxy),
  btsDesktop: [
    'https://cdn-sfw.vixen.com/statics/bts_benefit_shelf_video_desktop_mobile_1012x620.mp4',
  ].map(proxy),

  // Section 4 — Upcoming Scenes
  upcoming: [
    'https://cdn-sfw.vixen.com/statics/upcoming_scene_shelf_fallback_video_mobile_780x734.mp4',
  ].map(proxy),
  upcomingDesktop: [
    'https://cdn-sfw.vixen.com/statics/upcoming_scene_shelf_fallback_video_desktop_3840x1292.mp4',
  ].map(proxy),
};

/** Pick a random item from an array. */
function pickFrom(pool) {
  return pool[Math.floor(Math.random() * pool.length)];
}
