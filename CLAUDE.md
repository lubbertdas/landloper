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

0.5a ✅ → 1 → 3 → 0.5b → 4 (MockProvider) → 2a → 6 → 4 GPS + 5 (together,
by the user's choice) → user's real walks → 7 → 8 → 9.

## Current status

- **Stage 0.5a** done: TypeScript + vitest toolchain, ADRs 0001–0002.
- **Stage 1** done: content contract (`src/content/`), solar-system pack
  (`packs/solar-system/`), ADRs 0003–0004.
- **Stage 3** done: journey engine (`src/engine/`), pure reducer with full
  test suite; ADR 0005.
- **Stage 0.5b** done on the emulator: Expo SDK 57 at repo root, Expo
  Router, dev build installs and runs (ADR 0006). `android/` is generated
  and gitignored. Helper: `scripts/run-android.ps1`.
  Runs on the user's Samsung S24 over USB (`adb reverse tcp:8081`; the
  script does this). Wi-Fi/QR loading hung, likely Windows Firewall.
- **Stage 4 (MockProvider only)** done: `src/platform/` with
  DistanceProvider, MockProvider, JourneyController; temporary demo home
  screen; ADR 0007.
- **Stage 2a** done: `npm run media` / `validate` / `packs`, placeholder
  images, generated `src/content/bundled.generated.ts`, BundledPackSource;
  ADR 0008. Solar-system images are PLACEHOLDERS (real ones needed before
  release).
- **Stage 6** done: all six screens on the mock provider (ADR 0009);
  components in `src/ui/components/`, look-and-feel in `src/ui/theme.ts`.
- **Stage 4 GPS + Stage 5** built together (ADRs 0010–0012):
  background location task owns the tick (load → advance → save in
  SQLite), GPS filter, milestone notifications with deep links, Settings ›
  Diagnostics log. Composition root and all native modules in
  `src/runtime/`; root `index.ts` is the entry. Verified on the S24 with a
  fake walk over USB (`npm run walk -- --phone --serial RFCX90H8DGH`),
  screen off, including notification tap → detail.
- **NEXT: the user's real walks**, on a release build
  (`scripts\run-android.ps1 -Release`): a short one screen-on, then 30+
  min locked. Then Stage 7 (history/settings tables in the same DB), 8, 9.
- Build notes: after `app.json`/native-module changes use
  `run-android.ps1 -Clean`. Physical device: if the dev client opens on a
  192.168.x URL and hangs, reopen it with
  `exp+landloper://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081`.
  The API 30 emulator can't deliver fixes (old Play services).
- Known gaps: placeholder images; history and settings still in memory;
  dev-only speed control and distance-source switch; app icon and
  foreground-service icon are placeholders; foreground-service text is a
  first draft for the user to redesign.
