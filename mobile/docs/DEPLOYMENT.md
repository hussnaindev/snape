# Mobile — Deployment (Android APK)

The mobile app ships as an Android APK built by GitHub Actions. It is fully
client-side — there is no server to deploy.

## CI build (`.github/workflows/mobile.yml`)

Path-filtered to `mobile/**`. On push to `main` (or manual **workflow_dispatch**):

1. JDK 17 (temurin) + Android SDK (`platforms;android-34`, `build-tools;34.0.0`).
2. Gradle 8.9.
3. `gradle :app:assembleRelease` with `working-directory: mobile`.
4. Uploads the `snape-release-apk` artifact
   (`mobile/app/build/outputs/apk/release/app-release.apk`).

Grab the APK from the run's **Artifacts** section and sideload it.

### Why release, not debug
The release build is **non-debuggable**, so Compose drops its composition-tracking
overhead and scrolling/animation perf is representative. `minifyEnabled` stays off.
Never judge scroll perf on a debug build.

## Signing

The release APK is signed with the **auto-generated debug keystore**
(`signingConfig = signingConfigs.getByName("debug")` in `app/build.gradle.kts`), so
it installs without any secrets or a release keystore. This is fine for internal
distribution; a Play Store release would need a real upload keystore wired in here.

## LaunchDarkly key

`LAUNCHDARKLY_MOBILE_KEY` is resolved in `app/build.gradle.kts` with this precedence:

1. Gradle property / CI secret — `-PLAUNCHDARKLY_MOBILE_KEY=…` or the env var
   `ORG_GRADLE_PROJECT_LAUNCHDARKLY_MOBILE_KEY` (CI maps it from the repo secret
   `LAUNCHDARKLY_MOBILE_KEY`).
2. `local.properties` (per-machine override).
3. A **committed fallback** key, so CI never ships an empty key.

LaunchDarkly **mobile** keys are not secret per LD's docs, so the committed fallback
is acceptable — the repo secret is optional and only needed to point a build at a
different LD environment.

## Local build

```bash
cd mobile
gradle wrapper --gradle-version 8.9   # first time only
./gradlew :app:assembleDebug          # debug APK for quick installs
./gradlew :app:assembleRelease        # release APK (use this to judge perf)
```

Requires JDK 17 + Android SDK 34. `minSdk 26`, `targetSdk 34`, package
`com.snape.flix`.
