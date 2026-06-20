# LaunchDarkly

The Android app (`android-native/`, package `com.snape.flix`) uses LaunchDarkly
to gate access with the `ip-access-restriction` flag.

## SDK Details

- **SDK:** `com.launchdarkly:launchdarkly-android-client-sdk:5.5.0`
  (declared in `android-native/app/build.gradle.kts`)
- **Key type:** Mobile key (client-side). Mobile keys are not secret per
  LaunchDarkly's docs, so the committed fallback is safe to check in.
- **Initialization:** `android-native/app/src/main/java/com/snape/flix/SnapeApp.kt`
  — async init in `Application.onCreate()`, exposed via `awaitLdClient()` so
  callers await the first flag fetch instead of racing it.
- **Evaluation:** `android-native/app/src/main/java/com/snape/flix/MainActivity.kt`
  — builds an `ip`-attributed context, `identify(...).get()`, then
  `boolVariation("ip-access-restriction", false)` and `flush()`.

## Configuration

The mobile key is injected into `BuildConfig.LAUNCHDARKLY_MOBILE_KEY` by
`app/build.gradle.kts`, resolved with this precedence:

1. **Gradle property / CI secret** — `-PLAUNCHDARKLY_MOBILE_KEY=…` or
   `ORG_GRADLE_PROJECT_LAUNCHDARKLY_MOBILE_KEY`
2. **`local.properties`** — per-machine override. Gradle does **not** load
   custom keys from `local.properties` automatically, so the build reads it
   explicitly. (Putting a key here without that loader is silently ignored —
   this was the original "Watching for your first event…" bug.)
3. **Committed fallback** — `mob-87b917f3-…`, so CI never ships an empty key.

> A mobile key maps to a single **environment**. All sources above must point at
> the same environment you watch in the dashboard, or events appear to be
> "missing." The app targets the environment whose mobile key is
> `mob-87b917f3-6572-4e30-8474-1edee58b7cfc`.

## How Feature Flags Work Here

```kotlin
// MainActivity.checkIpAccess()
val client = (application as SnapeApp).awaitLdClient()   // first flag fetch done
val context = LDContext.builder("snape-user").set("ip", ip).build()
client.identify(context).get()                            // load this context's flags
val restricted = client.boolVariation("ip-access-restriction", false)
client.flush()                                            // push events immediately
```

## Where to Find Things

- Project flags: https://app.launchdarkly.com/projects
- The app's environment: Project → **Settings → Environments**, the one whose
  Mobile key is `mob-87b917f3-6572-4e30-8474-1edee58b7cfc`.

## Verifying Events Arrive

1. Build/install a fresh APK (`./gradlew :app:assembleRelease` or CI).
2. Launch it; `adb logcat` should show `SnapeApp: LaunchDarkly initialized` and
   `MainActivity: ip-access-restriction=… for ip=…`.
3. The targeted environment's dashboard shows the live context + evaluation.
   Toggling `ip-access-restriction` and relaunching flips the access gate.

## Next Steps

- Targeting rules / percentage rollouts on `ip-access-restriction`
- Additional flags via the installed `launchdarkly-flag-*` skills
- Optional: configure the LaunchDarkly MCP server for agent-driven flag
  management (not set up in this repo's onboarding).
