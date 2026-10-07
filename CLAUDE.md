# Landloper

Android walking app (React Native / Expo, Android only, local builds only).
Real walking distance is mapped onto a scaled journey through a content pack;
milestones fire as you pass them.

Read before anything else: `docs/adr/` (all of it) and `docs/workplan-v4.md`.
A fresh session must be able to resume from this file + `docs/adr/` alone.

## Ground rules

- Before running any command, explain in plain language what it does.
- Never present an assumption or invented structure as already decided. Flag
  it as new. Batch flags into one list per stage instead of interrupting.
- When a decision isn't already written down, add a new ADR. ADRs and the
  workplan are **append-only**: never edit a past (committed) ADR; supersede
  it with a new one.
- `applicationId` is `io.github.lubbertdas.landloper`. Final. Never suggest
  changing it. (The workplan still says `com.TODO.landloper`; that text
  predates ADR 0001 and is stale. The workplan is append-only, so it stays.)
- The user is on Windows. Check what's installed before installing anything.
- Commit at the end of each stage with a clear message, then push.
- The user reviews by running the result. At the end of each stage report:
  what to run, what they should see, the batched list of new assumptions,
  and any ADR titles added.
- Units: `realValue` is in the pack's own unit (never metres, may be
  negative); `position` is a unitless 0–1 fraction; only walking distances
  (`*M` fields) are metres.
- Positions stay strictly proportional to real distance (ADR 0004). Never
  compress, rescale or split packs to even out spacing.
- UI/UX must stay easy for the user to customise: all look-and-feel lives in
  the presentation layer (theme file + reusable components + one file per
  screen). Engine and packs contain no styling.

## Environment notes (Windows)

- Node 24 is managed by **fnm** and is not on PATH by default in tool shells.
  In PowerShell, prefix commands with:
  `fnm env --shell powershell | Out-String | Invoke-Expression; fnm use default | Out-Null;`
- No system `java`. Use Android Studio's bundled JDK:
  `$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"`
- Android SDK: `$env:LOCALAPPDATA\Android\Sdk` (`ANDROID_HOME` not set
  globally). Emulator AVD: `Pixel_3a_API_30_x86`.

## Build order (from the workplan)

0.5a ✅ → 1 → 3 → 0.5b → 4 (MockProvider) → 2a → 6 → stop.
Stage 4 GPS and Stage 5 notifications are the user's to start (need real walks).

## Current status

- **Stage 0.5a** done: TypeScript + vitest toolchain, ADRs 0001–0002.
- **Stage 1** in progress: content contract (`src/content/`), solar-system
  pack (`packs/solar-system/`), ADRs 0003–0004.
