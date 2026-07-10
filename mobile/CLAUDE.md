# Snape — Mobile (Android) — Claude Code Context

The **mobile** app in the Snape monorepo (`mobile/`). A fully client-side native
Android app: **Kotlin + Jetpack Compose + Media3**. It searches MovieBox and
streams movies/series **directly from the device** — every request (search, season
list, stream, subtitles) hits the MovieBox **mobile BFF** from the phone's own
residential IP. No TMDB backend of ours, no Cloudflare/Netlify, no proxy. Sibling
apps (`web/`, `desktop/`) are independent — do not import across folders. All paths
below are relative to `mobile/`.

`README.md` in this folder is the authoritative deep-dive (features, TV/leanback,
signing). Read it before non-trivial work. The essentials:

## Layout
- `app/src/main/java/com/snape/flix/`
  - `data/` — `MovieBoxRepository.kt` (API surface), `MovieBoxSign.kt` (request
    signing), `Tmdb.kt` (on-device TMDB enrichment), `Downloads.kt`,
    `HomeRepository.kt`/`HomePrefetch.kt`/`HomeCache.kt`, `AccessGate.kt`.
  - `ui/` — `home/`, `detail/`, `browse/`, `player/` (`StreamPlayer.kt`),
    `components/`, `tv/` (`TvUtils.kt`).
- `app/build.gradle.kts` · `build.gradle.kts` · `settings.gradle.kts` · `gradle/`

## Non-negotiable rules (see README for the why)
1. **Home feed is `Column` + `verticalScroll`, NOT `LazyColumn`** (`ui/home/HomeScreen.kt`).
   Virtualization re-composes heavy sections during fling → severe fling-only jank.
   Same for per-section carousels: `Row` + `horizontalScroll`, not `LazyRow`.
2. **Hero trailer `PlayerView` is a `TextureView`, not `SurfaceView`.**
3. **Coil bitmaps stay `HARDWARE` config** — never re-add `allowRgb565(true)`.
4. **Judge scroll perf only on a release build** (Compose is 5–10× slower in debug).
5. **Android TV**: any new tappable needs `Modifier.focusHighlight(shape)` (before
   `.clickable`) or it's invisible/unreachable on a TV remote. See `ui/tv/TvUtils.kt`.

## MovieBox signing
All signing (`x-tr-signature` HMAC-MD5, `X-Client-Token`, device `X-Client-Info`)
lives in `data/MovieBoxSign.kt`. The server-side HMAC key **rotates**; if search
starts failing, update `SECRET_KEY` there.

## Feature flags
LaunchDarkly gates access (`data/AccessGate.kt`, `SnapeApp.kt`, `HomePrefetch.kt`,
`app/build.gradle.kts`). The mobile SDK key is injected at build time via the Gradle
property `LAUNCHDARKLY_MOBILE_KEY` (CI reads it from repo secrets).

## Build
- CI: `.github/workflows/mobile.yml` (path-filtered to `mobile/**`) →
  `:app:assembleRelease`, uploads `snape-release-apk`.
- Local: `cd mobile && ./gradlew :app:assembleDebug` (JDK 17 + Android SDK 34).
- `minSdk 26`, `targetSdk 34`, package `com.snape.flix`.

Deploy/signing/CI secrets: `docs/DEPLOYMENT.md`.
