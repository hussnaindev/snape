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
- `src/preload.js` — bridge between main and renderer.
- `src/renderer/` — UI. `player.js` is a 1:1 port of the mobile `StreamPlayerChrome`
  (custom controls over Shaka), `renderer.js` the search/detail/series UI,
  `index.html` + `styles.css` the shell, `fonts/` the app font.

## Key facts
- **Playback is DASH (`.mpd`) via Shaka Player** in the renderer — macOS `AVPlayer`
  can't play DASH. Quality/audio/subtitle switching all go through Shaka.
- **Codecs**: MovieBox streams are mostly **HEVC/H.265-only**. Chromium decodes HEVC
  only via the OS hardware decoder (Apple Silicon, or Intel Macs ≈2016+ with an
  HEVC-capable GPU). Bare `codecs="hev1"` manifests are patched to `hev1.1.6.L120.90`
  by a Shaka manifest response filter (`renderer.js`).
- **Scope is deliberately minimal** (MVP): search + play only. The episode picker
  UX is the mobile app's job.
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
