/**
 * The journey engine: a pure reducer over (pack, state, distance).
 *
 * No sensors, UI, notifications, clock or storage. Every function returns a
 * new state plus the events that transition produced; it never mutates its
 * input. A stateful adapter outside this module owns the current state and
 * forwards events (workplan Stage 3, "pure core, thin stateful shell").
 */

import type {
  JourneyEvent,
  JourneyPack,
  JourneyProgress,
  JourneyResult,
  JourneyState,
} from "./types";

export class JourneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JourneyError";
  }
}

export interface StartOptions {
  /** Identifier for the new journey; the caller generates it. */
  id: string;
  /** ISO-8601 timestamp recorded as `startedAt`. */
  now: string;
}

/** Walking distance, in metres, at which a milestone is reached. */
function thresholdM(position: number, totalDistanceM: number): number {
  return position * totalDistanceM;
}

function progressEvent(pack: JourneyPack, state: JourneyState): JourneyProgress {
  const reached = new Set(state.reachedMilestoneIds);
  const next = pack.milestones.find((m) => !reached.has(m.id));
  return {
    type: "JourneyProgress",
    progress: state.cumulativeDistanceM / state.totalDistanceM,
    distanceToNextM:
      next === undefined
        ? 0
        : Math.max(
            0,
            thresholdM(next.position, state.totalDistanceM) -
              state.cumulativeDistanceM,
          ),
    nextMilestoneId: next?.id ?? null,
  };
}

/**
 * Begins a journey at distance 0. Milestones at position 0 are emitted
 * immediately with `atStart: true`; the notification layer suppresses
 * those and the UI shows them as the opening card.
 */
export function startJourney(
  pack: JourneyPack,
  totalDistanceM: number,
  options: StartOptions,
): JourneyResult {
  if (!Number.isFinite(totalDistanceM) || totalDistanceM <= 0) {
    throw new JourneyError(
      `totalDistanceM must be a positive finite number of metres, got ${totalDistanceM}.`,
    );
  }
  if (pack.milestones.length === 0) {
    throw new JourneyError(`Pack "${pack.id}" has no milestones.`);
  }

  const events: JourneyEvent[] = [];
  const reachedMilestoneIds: string[] = [];
  for (const m of pack.milestones) {
    if (m.position === 0) {
      reachedMilestoneIds.push(m.id);
      events.push({ type: "MilestoneReached", milestoneId: m.id, atStart: true });
    }
  }

  const state: JourneyState = {
    id: options.id,
    packId: pack.id,
    totalDistanceM,
    cumulativeDistanceM: 0,
    reachedMilestoneIds,
    startedAt: options.now,
    status: "active",
  };
  events.push(progressEvent(pack, state));
  return { state, events };
}

/**
 * Feeds a new cumulative walking distance (metres since journey start).
 *
 * Distance is clamped monotonic: it never decreases (GPS jitter cannot
 * un-reach a milestone) and never exceeds `totalDistanceM`. A tick that
 * crosses several milestones emits all of them, in ascending position
 * order. Reaching `totalDistanceM` emits any remaining milestones, then
 * `JourneyCompleted`, and stamps `endedAt` with `now`.
 *
 * No-op (same state, no events) while paused or completed, and when the
 * clamped distance has not changed.
 */
export function advance(
  pack: JourneyPack,
  state: JourneyState,
  cumulativeDistanceM: number,
  now: string,
): JourneyResult {
  if (Number.isNaN(cumulativeDistanceM)) {
    throw new JourneyError("cumulativeDistanceM must be a number, got NaN.");
  }
  if (state.status !== "active") {
    return { state, events: [] };
  }

  const clamped = Math.min(
    state.totalDistanceM,
    Math.max(state.cumulativeDistanceM, cumulativeDistanceM),
  );
  if (clamped === state.cumulativeDistanceM) {
    return { state, events: [] };
  }

  const completed = clamped >= state.totalDistanceM;
  const reached = new Set(state.reachedMilestoneIds);
  const reachedMilestoneIds = [...state.reachedMilestoneIds];
  const events: JourneyEvent[] = [];

  for (const m of pack.milestones) {
    if (reached.has(m.id)) continue;
    // On completion every remaining milestone fires, so floating-point
    // rounding at position 1.0 can never leave the last one unreached.
    if (completed || clamped >= thresholdM(m.position, state.totalDistanceM)) {
      reachedMilestoneIds.push(m.id);
      events.push({ type: "MilestoneReached", milestoneId: m.id, atStart: false });
    }
  }

  const next: JourneyState = {
    ...state,
    cumulativeDistanceM: clamped,
    reachedMilestoneIds,
    ...(completed ? { status: "completed" as const, endedAt: now } : {}),
  };

  events.push(progressEvent(pack, next));
  if (completed) events.push({ type: "JourneyCompleted" });

  return { state: next, events };
}

/** Pauses an active journey. No-op otherwise. Emits no events. */
export function pause(state: JourneyState): JourneyResult {
  if (state.status !== "active") return { state, events: [] };
  return { state: { ...state, status: "paused" }, events: [] };
}

/** Resumes a paused journey. No-op otherwise. Emits no events. */
export function resume(state: JourneyState): JourneyResult {
  if (state.status !== "paused") return { state, events: [] };
  return { state: { ...state, status: "active" }, events: [] };
}
