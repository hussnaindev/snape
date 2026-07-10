# CLAUDE.md — monorepo root

Snape (aka Heroflix) is an ad-free movie/TV streaming product. This repo is a
**monorepo** with three standalone apps. There is no shared build or shared
package graph — treat each folder as its own project.

| App | Path | Read first |
|-----|------|-----------|
| Web | `web/` | [`web/CLAUDE.md`](../web/CLAUDE.md) |
| Mobile (Android) | `mobile/` | [`mobile/CLAUDE.md`](../mobile/CLAUDE.md) |
| Desktop (macOS) | `desktop/` | [`desktop/CLAUDE.md`](../desktop/CLAUDE.md) |

## Rules

- **Work inside one app's folder.** Before touching code, open that app's
  `CLAUDE.md` — the stacks, conventions, and gotchas differ completely
  (Bun/Next vs Gradle/Kotlin vs npm/Electron).
- **Never cross-wire the apps.** They do not import from each other. A change in
  one must not require editing another.
- **CI is path-filtered.** `.github/workflows/{web,mobile,desktop}.yml` each
  trigger only on their folder. Keep new paths inside the right folder so the
  right workflow runs.
- Root holds only shared plumbing: this file, root `README.md`, `.github/`,
  root `.gitignore`, `.vscode/`. App-specific config belongs in the app folder.

Anything else you need is in the per-app `CLAUDE.md`.
