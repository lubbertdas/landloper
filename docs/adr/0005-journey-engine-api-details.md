# 0005. Journey engine API details

Date: 2026-10-07
Status: Accepted

## Context

Workplan Stage 3 gives the engine's shape (a pure reducer), its signatures,
its rules and its events. Implementing it surfaced details it leaves open.

## Decision

- **The caller supplies identity and time.** `startJourney(pack,
  totalDistanceM, { id, now })` and `advance(pack, state, distanceM, now)`.
  The core has no clock and no ID generator, so `startedAt`, `endedAt` and
  `id` come from the adapter. Timestamps are ISO-8601 strings.
- **The engine takes a narrow pack type**, `JourneyPack` = `{ id,
  milestones: { id, position }[] }`. A full `ContentPack` satisfies it;
  the engine cannot depend on media, text or `realValue`.
- **A milestone is reached when** `cumulativeDistanceM >= position ×
  totalDistanceM`. On completion every remaining milestone fires regardless,
  so floating-point rounding at position 1.0 can never strand the last one.
- **`JourneyProgress` is emitted on every transition that changes
  distance**, and once at start — after any `MilestoneReached` events and
  before `JourneyCompleted`. An `advance` whose clamped distance is unchanged
  (duplicate value, backward jitter, already at total) returns the same state
  object and no events.
- **`pause` and `resume` emit no events.** They are status changes the
  caller initiated, so it already knows. Pausing a non-active journey or
  resuming a non-paused one is a no-op. A completed journey stays completed.
- **Invalid input throws `JourneyError`**: non-positive or non-finite
  `totalDistanceM`, an empty pack, NaN distance. Negative distance is not an
  error; clamping treats it as no movement.
- **The "at most one active or paused journey" rule is not the engine's.**
  The reducer handles one journey; enforcing uniqueness belongs to
  persistence (Stage 7) and, until then, to the in-memory adapter.

## Consequences

The adapter (Stage 4) owns ID generation, the clock, and storing state
between ticks. The engine stays testable with fixed timestamps.
