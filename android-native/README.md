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
- **Movies** play immediately on tap.
- **Series** open a season/episode picker sheet; pick an episode to play.
- **Player** (landscape, immersive): Media3/ExoPlayer plays the adaptive **DASH**
  stream (`subject-api/play-info`) using the CloudFront `signCookie` for the CDN.
  - **Quality** is switchable (1080/720/480 + Auto) via the ⚙ HD menu.
  - **Subtitles** are switchable (sideloaded `.srt` from `get-ext-captions`) via
    the CC menu, rendered in a **monospace** font on a **60%-opacity** background.
  - Video **fills the screen by default** (`RESIZE_MODE_ZOOM`, aspect preserved).

All MovieBox request signing (`x-tr-signature` HMAC-MD5, `X-Client-Token`,
device `X-Client-Info`) lives in `data/MovieBoxSign.kt`; the API surface is in
`data/MovieBoxRepository.kt`.

## Build the APK

### GitHub Actions (recommended)
Push to `main` (or run the **Build Snape Android APK** workflow manually). The
workflow at `.github/workflows/android.yml` builds `:app:assembleDebug` and
uploads the `snape-debug-apk` artifact. Download it from the run's *Artifacts*.

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
