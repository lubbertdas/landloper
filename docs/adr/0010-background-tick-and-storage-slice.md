# 0010. Background tick ownership and the first storage slice

Date: 2026-10-08
Status: Accepted

## Context

The workplan's "Who owns the tick" asks for this to be spelled out before
any GPS code: the background task, not the React tree, drives the loop:
task wakes → provider computes distance → load `JourneyState` from storage
→ `advance()` → write back → hand events to notifications. ADR 0007 kept
the journey in memory "until Stage 7". Stages 4 (GPS) and 5
(notifications) are built together, before Stage 7, so they need a store
the background task can use outside React now.

## Decision

### The tick

1. The OS wakes the background location task (`src/runtime/locationTask.ts`)
   with a batch of fixes.
2. `recordFixes` loads the GPS tracker state from storage, filters the
   fixes (ADR 0011), saves the tracker state, and publishes the new
   cumulative distance on the in-process `GpsHub`.
3. The `JourneyController` listens on the hub through `GpsProvider`'s
   `onDistance`. On each distance it **loads the journey from storage**,
   calls `advance()`, **saves** the result, then hands events to its
   listeners (notifications, the UI).

The controller is a plain object created at module scope in
`src/runtime/services.ts`. It never depends on a mounted component. When
the OS starts a killed app headless to deliver fixes, importing the task
module imports `services.ts`, which restores the stored journey and
reattaches its provider *before* the task body runs.

The mock path uses the same controller tick (load → advance → save), so
mock journeys persist and restore too.

### Storage

- **expo-sqlite**, as Stage 7 prefers, opened with the **synchronous**
  API so load → advance → save runs straight through with no interleaving.
  One file, `landloper.db`, versioned with `PRAGMA user_version` and an
  append-only migration list.
- Tables now: `kv` (JSON values by key) and `diagnostics` (ADR 0012). The
  active journey is the `journey.active` key, holding the engine's
  `JourneyState` plus `source` (`gps` | `mock`) and `latestMilestoneId`.
  The GPS tracker state is the `gps.tracker` key.
- Interfaces (`JourneyStore`, `KeyValueStore`, `DiagnosticsLog`) live in
  `src/platform/storage/` with in-memory versions for tests.
- **Still in memory until Stage 7:** history and settings. A journey that
  completes while the app is closed is not added to history.

### Restore

On start, `restore()` loads the stored journey. Active: a provider is
created in *resume* mode (mock: continues from the saved distance; GPS:
keeps the tracker state and only starts location updates if they are not
already running) and started. Paused: the provider is created but started
only by `resume()`. Completed: shown as the summary until dismissed. A
stored journey whose pack no longer exists is discarded.

### Layout

- `src/runtime/` is new: the composition root and every module that
  imports a native Expo module (SQLite, location, task manager,
  notifications). `src/platform/` stays plain TypeScript, tested under
  vitest.
- A root `index.ts` becomes the app entry (`package.json` `main`). It
  imports the location task first, then `expo-router/entry`, because the
  task must be defined at module scope before anything renders.
- `packSource` and the settings store move into `src/runtime/` so the
  background path can use them. `src/ui/state/*` keep the React hooks.

## Consequences

- Stage 7 adds history and settings tables to the same migration list and
  swaps the in-memory history for a query. It does not replace this store.
- The UI observes the controller's snapshot, which the controller updates
  after each saved tick in the same process. A headless tick's results are
  in storage and picked up by `restore()` when the UI opens.
