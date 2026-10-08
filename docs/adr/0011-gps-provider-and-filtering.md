# 0011. GPS provider, filtering details and permissions

Date: 2026-10-08
Status: Accepted

## Context

Workplan Stage 4 sets the GPS options (High accuracy, ~10 m, ~5 s), the
filter thresholds (accuracy > 25 m, speed outside 0.2–4 m/s, moves under
5 m) and the permission and foreground-service requirements. Implementing
them leaves open what happens to the anchor point after a rejected fix,
how pause works, and how the distance source is chosen in development.

## Decision

### Filter (`src/platform/gps/GpsTracker.ts`, pure)

Distance is measured from an **anchor**, the last accepted fix, with
Haversine.

- Accuracy worse than 25 m, or **no accuracy at all**: discard.
- Move under 5 m from the anchor: ignore and **keep the anchor**, so slow
  small steps add up instead of being lost.
- Faster than 4 m/s: a GPS jump; drop the fix and keep the anchor. After
  **3 jumps in a row**, re-anchor at the latest fix without counting, so
  one bad anchor cannot block counting for ever.
- Slower than 0.2 m/s (drift, or the first fix after a long stop):
  re-anchor at the new fix without counting.
- Batches are sorted by time; a fix not newer than the last one seen is
  ignored.
- Pausing drops the anchor; the first fix after resuming anchors again, so
  distance covered while paused is never counted.

### Provider (`src/platform/gps/GpsProvider.ts`)

- expo-location sits behind a `LocationUpdates` interface (start, stop,
  isRunning), so the provider is tested with a fake.
- `start` resets the tracker and starts updates; `pause` stops OS updates
  (and with them the foreground-service notification); `resume` starts
  them again; `stop` stops them and deletes the tracker. OS calls are
  queued so a quick pause → resume can't race.
- Start/stop failures are logged and shown on the live screen through the
  hub's status; they do not throw into the UI.
- Options: `Accuracy.High`, `distanceInterval` 10 m, `timeInterval` 5 s,
  foreground service with `killServiceOnDestroy: false` (keeps measuring
  if the app is swiped away).

### Foreground-service notification

Title "Walking: <pack title>", body "Measuring your walk with GPS. Tap to
open.", accent colour from the theme. The text is fixed for the journey
(changing it means restarting location updates, which Android restricts
from the background). Its wording lives in `src/runtime/services.ts`.
This is a first version for the user to redesign. It uses the app icon;
a dedicated white status-bar icon is not made yet.

### Permissions

On Start (setup screen), for GPS journeys: location services on →
"while in use" → a separate second request for "all the time" (on Android
11+ that opens the app's settings page). Any refusal stops the start and
shows what to do, with an "Open phone settings" button. Notification
permission (Android 13+) is requested next when notifications are on; a
refusal does not block the journey.

Config plugins: `expo-location` with background location and foreground
service enabled (adds `ACCESS_BACKGROUND_LOCATION`, `FOREGROUND_SERVICE`,
`FOREGROUND_SERVICE_LOCATION`), `expo-task-manager`, `expo-notifications`.

### Distance source

Release builds always use GPS. **Development builds** get a Settings
switch, Simulated / GPS (default Simulated, as in Stage 6), used by the
next journey started. The live screen shows the simulated-speed control
only on mock journeys and a GPS status line only on GPS journeys.

### Field-test build

Walks need a build with the JavaScript bundled in, because a development
build loads JS from the PC. `scripts/run-android.ps1 -Release` builds and
installs the release variant (signed with the debug key; fine for
side-loading, not for the Play Store).

`expo run:android` reuses an existing `android/` folder and does not
re-apply config plugins, so new permissions never reached the manifest.
`scripts/run-android.ps1 -Clean` runs `expo prebuild --clean` first; use it
after any `app.json` or native-module change (`android/` is generated and
gitignored, ADR 0006).

## Consequences

- The filter's choices (anchor rules, three-jump limit, null accuracy) are
  tuning knobs in `DEFAULT_GPS_FILTER`; field tests may change the
  numbers through a later ADR.
- With pause stopping updates, resume has to happen with the app open
  (Android does not let a background app start a location service). The
  in-app Resume button satisfies this.
