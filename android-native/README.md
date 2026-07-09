# Snape — native Android app

A minimal, fully client-side Android app (Kotlin + Jetpack Compose + Media3) that
searches MovieBox and streams movies & series directly from the device. No TMDB,
no Cloudflare/Netlify, no proxy — every request (search, season list, stream,
subtitles) goes straight to the MovieBox mobile BFF from the phone's own
(residential) IP, so there are no datacenter IP blocks.

## What it does

- **Search** (`subject-api/search`, signed): type in the search bar and matching
  movies/series stream in. Audio variants (e.g. *Inception*, *Inception [Hindi]*,
  *Inception [Tamil]*) come back as **separate cards**, exactly as MovieBox returns
  them. Cards reuse the web poster UI (2:3 poster, hairline ring, type/rating
  chips, language pill, gradient title bar).
- **Splash**: black full-screen launch with the centred white Snape logo
  (AndroidX splash-screen API).
- **Detail page** (`ui/detail/`): tapping any card opens a pixel replica of the
  web app's mobile detail screen — hero/backdrop, poster card, title logo,
  metadata row (year · runtime/seasons · rating), genre + status chips,
  expandable synopsis, a **Starring** cast rail, an **Episodes** carousel
  (series) and a **More Like This** rail. MovieBox supplies the base (it is the
  playable source); the richer fields MovieBox lacks (backdrop, title logo,
  trailer key, cast, genres, episode stills, recommendations) are fetched
  **on-device from TMDB** (`data/Tmdb.kt`) — no web backend is involved.
- **Watch / episodes**: the Watch button (movies) and episode taps (series) play
  the MovieBox stream **inline inside the hero section** (vertical), exactly like
  the web. The player's fullscreen button expands the *same* ExoPlayer instance
  to a full-screen landscape overlay (no audio restart); back returns inline.
- **Player** (`ui/player/StreamPlayer.kt`): Media3/ExoPlayer plays the adaptive
  stream (`subject-api/play-info`) using the CloudFront `signCookie` for the CDN.
  - **Quality** is switchable (1080/720/480 + Auto) via the ⚙ HD menu.
  - **Subtitles** are switchable (sideloaded `.srt` from `get-ext-captions`) via
    the CC menu, rendered in a **monospace** font on a **60%-opacity** background.
  - Video **fills the screen by default** (`RESIZE_MODE_ZOOM`, aspect preserved).

All MovieBox request signing (`x-tr-signature` HMAC-MD5, `X-Client-Token`,
device `X-Client-Info`) lives in `data/MovieBoxSign.kt`; the API surface is in
`data/MovieBoxRepository.kt`.

## Performance — never break these

Hard-won rules for the home screen. Reverting any of these reintroduces the
scroll jank they fixed, so leave them in place unless you have measured proof.

1. **The home feed is a `Column` + `Modifier.verticalScroll`, NOT a `LazyColumn`**
   (`ui/home/HomeScreen.kt`). The feed is bounded — hero + 8 sections + footer
   (~10 children), each section ≤10 cards (`HomeRepository.CAROUSEL_SIZE`) — so
   virtualization buys nothing and actively hurts: a `LazyColumn` **re-composes
   each heavy 440 dp section as it scrolls into view**, on the fling's critical
   frames, which caused severe *fling-only* jank (smooth on slow drag, stutter on
   fast fling) even on a flagship. A `Column + verticalScroll` composes the whole
   feed **once**, then scrolling is pure layer translation — the same model the
   web home uses (browser lays out once, compositor just translates). Only reach
   for lazy layouts if the feed becomes genuinely large/unbounded.
2. **Each section's poster carousel is a `Row` + `horizontalScroll`, NOT a
   `LazyRow`** (`ui/home/ProviderSection.kt`). With ≤10 cards the lazy machinery
   is pure overhead — a nested `LazyRow` is a `SubcomposeLayout` instantiated per
   section. Plain `Row` composes the tiny cards eagerly, cheaper.
3. **The hero trailer `PlayerView` is a `TextureView`, NOT a `SurfaceView`**
   (inflated from `res/layout/hero_trailer_view.xml` with
   `app:surface_type="texture_view"`). A `SurfaceView` hole-punches the window and
   forces a relayout when added/removed or scrolled — visible hitching. A
   `TextureView` composites like an ordinary view.
4. **Coil bitmaps stay at the default `HARDWARE` config** (`SnapeApp.kt`) — do not
   re-add `allowRgb565(true)`. RGB_565 produces *software* bitmaps the render
   thread must re-upload to the GPU as they scroll in; hardware bitmaps are
   GPU-resident with no per-frame upload.
5. **Judge scroll perf only on a release (non-debuggable) build.** Compose runs
   5–10× slower in a debug build; the CI builds `assembleRelease` for this reason.

**Incident:** home scroll stuttered badly on a flagship while the web home was
smooth on the same phone. Three composable-level attempts (disable hero video,
`LazyRow`→`Row`, cut gradient overdraw) did nothing. An on-screen `withFrameNanos`
FPS meter + the "only fast fling" symptom localized it to **composition during
fling** — i.e. `LazyColumn` virtualization. Switching to `Column + verticalScroll`
fixed it.

## Android TV / leanback

The same APK runs on Android TV (and TV boxes / leanback devices) with a proper
10-foot, D-pad experience. The phone UI is untouched — every TV affordance is
either invisible on touch or gated on a `rememberIsTv()` check.

- **Manifest** (`AndroidManifest.xml`): declares `android.software.leanback` and
  `android.hardware.touchscreen` as `required="false"` (touchscreen-not-required is
  what makes the app installable on a TV at all), adds the `LEANBACK_LAUNCHER`
  category so it shows on the TV home screen, and points `android:banner` at
  `@drawable/tv_banner` (the launcher tile).
- **Focus system** (`ui/tv/TvUtils.kt`): the app was 100 % touch (`.clickable`,
  tap/double-tap) with no focus indicators. `Modifier.focusHighlight(shape)` draws a
  D-pad focus ring + lift-scale on any interactive surface; it's applied to every
  card, button, chip, chrome icon, drawer row and player control. It is
  **performance-safe for the home feed**: the lift-`scale` graphicsLayer is added
  *only while focused*, so the ~80 idle cards stay layer-free (see the perf rules
  above — the feed's model is "compose once, then translate"). `initialTvFocus()`
  gives each primary screen a deterministic starting focus (hero WATCH on home,
  WATCH on detail, the retry/downloads button on the error/offline screens).
- **Player** (`ui/player/StreamPlayer.kt`): on a TV the player is remote-driven.
  Controls start hidden; any D-pad key summons them (CENTER = play/pause, LEFT/RIGHT
  = ∓10 s, UP/DOWN = show). While shown, focus lands on Play/Pause and the D-pad
  walks the control row + menus; **Back** peels one layer at a time (menu → episodes
  → controls) before exiting. The touch auto-hide timer is disabled on TV (it would
  yank focus). Playback opens straight to **fullscreen** on TV (inline-in-hero is
  unusable at 10 feet) and Back from fullscreen ends playback.
- **Focus traps**: the video `PlayerView`, the hero trailer surface and the YouTube
  trailer `WebView` are all marked non-focusable (`FOCUS_BLOCK_DESCENDANTS`), and the
  full-screen tap-swallow scrims (drawer, menu popup) use
  `focusProperties { canFocus = false }` — otherwise they'd silently eat the remote.

Anything new that is tappable must get a `.focusHighlight(...)` (before its
`.clickable`) or it will be invisible/unreachable on a TV.

## Build the APK

### GitHub Actions (recommended)
Push to `main` or `feat/android-native` (or run the **Build Snape Android APK**
workflow manually). The workflow at `.github/workflows/android.yml` builds
`:app:assembleRelease` (non-debuggable — required for representative scroll perf;
signed with the debug keystore so it installs without secrets) and uploads the
`snape-release-apk` artifact. Download it from the run's *Artifacts*.

### Locally
Open `android-native/` in **Android Studio** (Koala or newer) and Run, or from a
shell with a JDK 17 + Android SDK installed:

```bash
cd android-native
gradle wrapper --gradle-version 8.9   # first time only, generates ./gradlew
./gradlew :app:assembleDebug
# APK -> app/build/outputs/apk/debug/app-debug.apk
```

## Notes

- `minSdk 26`, `targetSdk 34`. Package `com.snape.flix`.
- App icon is the Snape mark (white, padded) on black — an adaptive icon mirroring
  the PWA maskable icon.
- The MovieBox HMAC key can rotate server-side; if search starts failing, update
  `SECRET_KEY` in `data/MovieBoxSign.kt` (see `docs/MOVIEBOX.md`).
- The older `android/` folder is the deprecated Capacitor web-wrapper spike and is
  unrelated to this native app.
