# Snape — macOS desktop app (MVP)

A minimal Electron app that mirrors the native mobile app's two core features:
**search** and **play**. Type a query, click a result card, the movie/series
plays. Nothing else.

Like the Android app, every request (search, play-info) goes straight to the
MovieBox **mobile BFF** (`api.inmoviebox.com/wefeed-mobile-bff`) from your own
(residential) IP — no proxy, no Cloudflare/Netlify, no web backend. The signing
(`x-tr-signature` HMAC-MD5, `X-Client-Token`, device `X-Client-Info`, token
warm-up) is a direct port of `android-native/.../data/MovieBoxSign.kt` +
`MovieBoxRepository.kt`.

## How it works

| Layer | Mobile (Kotlin) | Desktop (this app) |
|---|---|---|
| Request signing | `MovieBoxSign.kt` | `src/moviebox.js` (Node `crypto`) |
| Search / play-info | `MovieBoxRepository.kt` | `src/moviebox.js`, run in the **main** process (no CORS) |
| DASH playback | Media3 / ExoPlayer | **Shaka Player** in the renderer |
| CloudFront `signCookie` | ExoPlayer default request header | injected via `session.webRequest` in `src/main.js` |
| Player chrome | `StreamPlayer.kt` (`StreamPlayerChrome`) | `src/renderer/player.js` — same UI 1:1 |

## Player

`src/renderer/player.js` is a 1:1 port of the app's `StreamPlayerChrome` — the
browser's default `<video>` controls are replaced with the same custom overlay,
using the **same SVG control glyphs** (`PlayerIcons.kt`) and behaviours:

- Red YouTube-style **scrubber** with draggable knob + buffered bar.
- Centered **play/pause** button and a red **buffering spinner**.
- Controls: play/pause, ∓10s, mute, time, **Subtitles (CC)**, **Settings**,
  **fill-screen** toggle, **fullscreen**.
- **Settings → Quality / Speed / Audio** menu, plus a **Subtitles** menu.
  - Quality: Auto + the stream's resolutions (Shaka track selection).
  - Audio: switches between MovieBox audio variants (Original / Hindi / Tamil
    …), refetching that variant's stream and preserving position.
  - Subtitles: sideloaded `.srt` (`get-ext-captions`) converted to WebVTT and
    drawn in a **monospace** overlay on a 60%-black band — same as the app
    (its built-in subtitle view ignored the custom font, so it mirrors cues too).
- **In-player episode selector** (series) — the list button opens a horizontal
  strip of the current season's episodes (current one ringed), like the app's
  EpisodesOverlay.
- Single-tap toggles controls; **double-tap** left/right third seeks ∓10s;
  controls auto-hide after 3.2 s; the chrome also reveals on **hover**. Video
  fills the screen by default (cover).
- **Keyboard:** `space`/`k` play-pause, `←`/`→` ∓5 s, `j`/`l` ∓10 s, `↑`/`↓`
  volume, `m` mute, `c` captions, `f` fullscreen, `0`–`9` seek to 0–90%.

## Series

Series rows in the sidebar expand to **Season pills + an Episode grid** (from
`season-info`); picking an episode plays it. The first episode auto-plays on
expand. The same season's episodes are also switchable from the in-player
episode strip.

The stream is an adaptive **DASH `.mpd`**; macOS's `AVPlayer` can't play DASH,
so the app uses Chromium + Shaka Player. The signed `Cookie` (and mobile
`User-Agent`) are attached in the main process to every request hitting the
stream's CDN origin — the desktop equivalent of ExoPlayer's default headers.

> This is the **`mac-desktop-app` branch** of the Snape repo — it contains the
> desktop app only (no web, no mobile). Other branches hold the web/mobile apps.

## Run it (dev)

```bash
npm install
npm start
```

## Build a universal `.app` / `.dmg` (Intel + Apple Silicon)

```bash
npm install
npm run dist          # -> dist/Snape-0.1.0-universal.dmg
```

The build targets `arch: ["universal"]`, so a single binary runs on both Intel
(x86_64) and Apple Silicon (M1/M2/…) Macs. There are no native dependencies, so
the universal merge is clean. The DMG is **unsigned** (MVP) — on first launch
right-click → Open, or `xattr -dr com.apple.quarantine /Applications/Snape.app`.

## Notes / limitations (it's an MVP)

- `webSecurity` is disabled so Shaka can read the CDN's CORS-less responses,
  exactly as the native players do. Fine for a personal test build.
- **Codecs**: most MovieBox streams are **HEVC/H.265 only** (no H.264 variant —
  Android's ExoPlayer hardware-decodes them). Chromium plays HEVC only via the
  OS hardware decoder, enabled here with the `PlatformHEVCDecoderSupport` switch
  (`main.js`). It works on Apple Silicon and Intel Macs with an HEVC-capable GPU
  (≈2016+); pre-HEVC Intel Macs can't play these (Chromium has no software HEVC
  path) and show a clear "needs an HEVC-capable GPU" message. Some manifests also
  declare a bare `codecs="hev1"` (no profile/level), which `isTypeSupported()`
  rejects even when HEVC works — the renderer patches those to
  `hev1.1.6.L120.90` (Main / level 4.0, covers ≤1080p) via a Shaka manifest
  response filter.
- Series play the first episode (S1E1); there's no episode picker — that's the
  mobile app's job, deliberately out of scope here.
- If search starts returning `407 Signature invalid`, the MovieBox HMAC key
  rotated — update `SECRET_KEY` in `src/moviebox.js` (or set `MOVIEBOX_SECRET_KEY`).
```
