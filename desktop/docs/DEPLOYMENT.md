# Desktop — Deployment (macOS DMG)

The desktop app is packaged with **electron-builder** into a universal macOS DMG.
It is fully client-side — there is no server to deploy.

## Build a universal DMG (Intel + Apple Silicon)

```bash
cd desktop
npm install
npm run dist        # electron-builder --mac --universal -> dist/Snape-0.1.0-universal.dmg
npm run dist:dir    # unpacked .app only (faster iteration, no DMG)
```

`build.arch = ["universal"]` in `package.json`, so one binary runs on both x86_64
and Apple Silicon. There are no native dependencies, so the universal merge is clean.

## CI (`.github/workflows/desktop.yml`)

Path-filtered to `desktop/**`. On push to `main` (or manual **workflow_dispatch**):

1. Runs on `macos-latest` (macOS runner required for `--mac`).
2. `npm ci` + `npm run dist` with `working-directory: desktop`.
3. Uploads the produced `.dmg` from `desktop/dist/` as a build artifact.

## Signing / notarization

The DMG is **unsigned** (MVP). On first launch on another Mac:

- right-click the app → **Open**, or
- `xattr -dr com.apple.quarantine /Applications/Snape.app`

A distributable build would add an Apple Developer ID cert + notarization to the
`build.mac` config; not wired up here.

## Runtime notes that affect packaging

- `webSecurity` is disabled (so Shaka can read CORS-less CDN responses) — acceptable
  for a personal build only.
- Playback needs an **HEVC-capable GPU** (Apple Silicon, or Intel Macs ≈2016+).
  Pre-HEVC Intel Macs cannot play these streams (Chromium has no software HEVC path)
  and show a clear message.
- The `build.files` allowlist ships `src/**` plus the compiled Shaka bundle
  (`node_modules/shaka-player/dist/shaka-player.compiled.js`) — keep it in sync if
  you add runtime assets.
