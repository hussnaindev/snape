# Snape — Desktop (macOS) — Claude Code Context

The **desktop** app in the Snape monorepo (`desktop/`). A minimal **Electron** app
that mirrors the mobile app's two core features — **search** and **play**. Like
mobile, every request (search, play-info) goes straight to the MovieBox **mobile
BFF** from your own residential IP; no proxy, no web backend. Sibling apps (`web/`,
`mobile/`) are independent — do not import across folders. All paths below are
relative to `desktop/`. `README.md` here is the authoritative deep-dive.

## Layout
- `src/main.js` — Electron main process. Injects the signed `Cookie` + mobile
  `User-Agent` into CDN requests via `session.webRequest`; enables HEVC via the
  `PlatformHEVCDecoderSupport` switch; `webSecurity` disabled so Shaka reads
  CORS-less CDN responses.
- `src/moviebox.js` — MovieBox BFF client + signing (`x-tr-signature` HMAC-MD5,
  `X-Client-Token`, `X-Client-Info`), a Node `crypto` port of the Kotlin
  `MovieBoxSign.kt` / `MovieBoxRepository.kt`. Runs in the **main** process (no CORS).
  `home()` builds the right-pane home screen from the `tab-operating` feed: `tabId`
  selects a vertical (0 = main, 2 = movies, 5 = TV series, 8 = anime), and seven
  categories (Latest, Trending, Top Series, Hollywood, Bollywood, Anime, Animated)
  map onto its rows — **100%
  MovieBox, no TMDB**. The feed doesn't paginate, so each category returns its whole
  deduped pool and the renderer reveals it on scroll.
- `src/preload.js` — bridge between main and renderer.
- `src/renderer/` — UI. `player.js` is a 1:1 port of the mobile `StreamPlayerChrome`
  (custom controls over Shaka), `renderer.js` the browse/search/play UI,
  `index.html` + `styles.css` the shell, `fonts/` the app font. The shell is a
  **Netflix-style single pane**: a fixed top bar (Snape logo/wordmark + per-category
  quick-links + a search field that expands on focus, solidifying on scroll) over a
  full-bleed content area. Home renders category rows as horizontal carousels with
  hover scroll-arrows; every tile is a Netflix-style card (clean box art at rest →
  scale-up + gradient title/meta + play button on hover). Search results and "see all"
  render as poster grids in the same area. One `startCard()` drives playback from any
  card, so series get the in-player episode strip (no sidebar accordion).

## Key facts
- **Playback is DASH (`.mpd`) via Shaka Player** in the renderer — macOS `AVPlayer`
  can't play DASH. Quality/audio/subtitle switching all go through Shaka.
- **Codecs**: MovieBox streams are mostly **HEVC/H.265-only**. Chromium decodes HEVC
  only via the OS hardware decoder (Apple Silicon, or Intel Macs ≈2016+ with an
  HEVC-capable GPU). Bare `codecs="hev1"` manifests are patched to `hev1.1.6.L120.90`
  by a Shaka manifest response filter (`renderer.js`).
- **Scope**: search + a curated home screen + play. The content area defaults to the
  home screen (category carousels → per-category "see all" grid with scroll-reveal),
  shows a results grid while searching, and swaps to the full-window player when a
  title plays (the player covers the top bar); series get an in-player episode strip
  (all seasons flattened, `S1·E1` labels).
- If search returns `407 Signature invalid`, the MovieBox HMAC key rotated — update
  `SECRET_KEY` in `src/moviebox.js` (or set `MOVIEBOX_SECRET_KEY`).

## Commands
```bash
npm install
npm start        # electron . (dev)
npm run dist     # electron-builder --mac --universal -> dist/*.dmg
npm run dist:dir # unpacked .app (faster, no DMG)
```

Build/signing details: `docs/DEPLOYMENT.md`.
