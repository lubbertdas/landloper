# 0006. Expo project layout and UI structure

Date: 2026-10-07
Status: Accepted

## Context

Stage 0.5b scaffolds the Expo app. ADR 0002 deferred the folders for the
Platform Services and Presentation layers to this point. The user also wants
the UI/UX to stay easy to customise, since that is the part they expect to
work on most.

## Decision

### One project at the repo root

The Expo app lives in the existing project: one `package.json`, one
`node_modules`, one `npm install`. App code imports `src/engine` and
`src/content` directly. `npm test` (vitest) keeps running the pure-TypeScript
suites under plain Node; the engine and content layers still import nothing
from React Native.

### Versions follow the Expo SDK

Expo SDK 57 (React Native 0.86, React 19.2). Package versions are chosen by
`npx expo install`, not by hand. TypeScript is pinned to the version the SDK
expects (`~6.0`), replacing the `^7` installed at Stage 0.5a, because Expo's
tooling and `expo-doctor` check against it. Revisit when an SDK moves to 7.

### Navigation and UI structure

- **Expo Router** (file-based navigation). Each screen is one file under
  `app/`; adding, renaming or reordering screens is moving files.
- **`src/ui/theme.ts`** is the single home of colours, font sizes, spacing
  and radii. Screens and components use theme names, never raw values.
- **`src/ui/components/`** holds small reusable pieces (cards, progress
  bar, pack tile). Screens arrange components; they hold little styling of
  their own.
- Engine and pack data contain no styling (workplan Stage 1 design rule).

### Native project is generated, not committed

`android/` is produced by `expo prebuild` (run implicitly by `npx expo
run:android`) from `app.json` and config plugins, and is gitignored
(Continuous Native Generation). Native settings — including
`android.package = io.github.lubbertdas.landloper` — live in `app.json`.
Stage 9's `cd android && ./gradlew bundleRelease` still works after a
prebuild.

### Development build, not Expo Go

`expo-dev-client` is installed from the start. The workplan notes Expo Go
cannot run background location (Stage 4); using a development build now
means one workflow throughout.

## Consequences

- `npm start` serves JS to an installed development build; `npm run android`
  rebuilds and installs it. A native rebuild is needed only when native
  modules or `app.json` change; UI edits use fast refresh.
- Native customisation must go through `app.json` or a config plugin, since
  hand edits to `android/` are overwritten by the next prebuild.
- The app icon and adaptive-icon images are Expo's placeholders for now.
