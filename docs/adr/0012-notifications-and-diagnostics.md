# 0012. Milestone notifications and the diagnostics log

Date: 2026-10-08
Status: Accepted

## Context

Workplan Stage 5: milestone crossings become local notifications using the
pack's authored text, also with the app in the background or the phone
locked; `atStart` milestones are suppressed; tapping one opens the
milestone detail. Building Stages 4 and 5 together means a failed walk
must still show where the chain broke (GPS, filter, tick, notification).

## Decision

### Notifications

- `src/platform/notifications/` decides which events notify and with what
  text (`milestoneNotifications`, `connectNotifications`); plain TypeScript.
  `src/runtime/notifications.ts` presents them with expo-notifications.
- One Android channel, `milestones` ("Milestones"), importance HIGH.
- Sent immediately (trigger with only `channelId`), with
  `data: { packId, milestoneId }`. Shown as banners even with the app open.
- The Settings toggle is checked when a milestone is reached; when off, the
  skip is logged.
- **Deep link:** the root layout reads the last notification response,
  clears it, and pushes `/milestone/[packId]/[milestoneId]`. This covers
  taps with the app open, in the background, and from a cold start.
- A failing notification is logged and does not interrupt the tick (the
  controller isolates event listeners).

### Diagnostics log

- The `diagnostics` table records: each GPS fix and the filter's decision
  (with segment length, speed and accuracy), each batch's total, each
  journey tick, milestones, notifications sent or skipped, provider and
  journey lifecycle, and every error. Entries also go to the console, so
  `adb logcat` shows them during development.
- It keeps the newest 5000 entries (pruned every 200 writes). Writes never
  throw.
- **Settings › Diagnostics** shows a count of fix outcomes, the newest 300
  entries (refreshing every 2 s), **Share log** (the newest 3000 as text,
  through Android's share sheet) and **Clear**. It is in release builds
  too, because field tests run on release builds.

### Desk testing

`npm run walk` (`scripts/simulate-walk.ts`) plays a straight walk at
walking speed into a device's GPS, to exercise the real background chain
without leaving the desk.

- Default: an emulator, via `adb emu geo fix`. The emulator must have a
  recent Google Play services: expo-location uses the fused location
  provider, and the `Pixel_3a_API_30_x86` image (Play services 20.18)
  fails with `SERVICE_INVALID` and never delivers a fix — silently, with
  `startLocationUpdatesAsync` succeeding.
- `--phone --serial <id>`: a USB phone (Android 12+). It temporarily
  replaces the phone's `gps` provider with a test provider and removes it
  at the end or on Ctrl+C. The phone's real network location keeps mixing
  in, which the filter rejects as jumps, so this doubles as a jump test.
  On the S24 the test provider was dropped after about a minute; short
  walks (≤ 80 m) are reliable.

Verified on the S24 (Android 16), screen off: fixes → filter → stored ticks
→ six milestone notifications → tap → milestone detail.

Because silence can be the only symptom, the live screen warns when GPS
has delivered nothing for 2 minutes after starting.

## Consequences

- The diagnostics screen is a development aid in a user-facing place.
  Whether it stays, moves, or is hidden in the release is the user's
  call at Stage 9.
- Stage 8's integration tests build on `src/platform/background.test.ts`,
  which already runs fixes → filter → controller → store → notifications
  with fakes.
