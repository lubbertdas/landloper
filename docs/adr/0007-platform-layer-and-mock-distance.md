# 0007. Platform layer and mock distance

Date: 2026-10-07
Status: Accepted

## Context

Stage 4 (MockProvider only) introduces the first Platform Services code and
the stateful adapter around the engine. ADR 0002 deferred where this layer
lives.

## Decision

- **`src/platform/`** holds the Platform Services layer: `distance/`
  (`DistanceProvider`, `MockProvider`) and `journey/` (`JourneyController`).
  It is plain TypeScript with no React Native imports so far, and is tested
  under vitest. Native-backed services (GPS, notifications, storage) will
  live here too, behind interfaces.
- **`DistanceProvider.onDistance` returns an unsubscribe function**, and
  `stop()` is final.
- **`MockProvider`** replays a `DistanceCurve` (metres as a function of
  simulated seconds; default steady 1.4 m/s) at `timeScale` × real time,
  with an injected clock. Time spent paused is not walked. Speed can change
  mid-walk; this backs a developer-only "simulation speed" control.
- **`JourneyController`** is the adapter the workplan describes: it owns the
  one current journey, forwards provider distance into `advance()`, stops
  the provider on completion, and exposes `subscribe`/`getSnapshot` (for
  React's `useSyncExternalStore`) plus `onEvents` (for Stage 5
  notifications).
- **Ending an unfinished journey discards it.** `UserJourney.status` has no
  "abandoned" value, so an abandoned journey is not recorded in history.
  Only completed journeys are.
- **In memory until Stage 7.** The controller keeps the current journey and
  history in memory; a restart loses both. Stage 7 moves this to storage
  readable from the background task, as the workplan's tick loop requires.

## Consequences

The Stage 4 GPS work adds a `GpsProvider` and moves tick ownership into a
background task (workplan "Who owns the tick"); at that point the controller
reads and writes persisted state instead of holding it.
