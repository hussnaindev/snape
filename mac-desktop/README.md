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

The stream is an adaptive **DASH `.mpd`**; macOS's `AVPlayer` can't play DASH,
so the app uses Chromium + Shaka Player. The signed `Cookie` (and mobile
`User-Agent`) are attached in the main process to every request hitting the
stream's CDN origin — the desktop equivalent of ExoPlayer's default headers.

## Run it (dev)

```bash
cd mac-desktop
npm install
npm start
```

## Build a universal `.app` / `.dmg` (Intel + Apple Silicon)

```bash
cd mac-desktop
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
- Series play the first episode (S1E1); there's no episode picker — that's the
  mobile app's job, deliberately out of scope here.
- If search starts returning `407 Signature invalid`, the MovieBox HMAC key
  rotated — update `SECRET_KEY` in `src/moviebox.js` (or set `MOVIEBOX_SECRET_KEY`).
```
