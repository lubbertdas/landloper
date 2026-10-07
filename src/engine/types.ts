/**
 * Journey engine types — Stage 3.
 *
 * The engine works in two kinds of number only: unitless `position`
 * (0.0–1.0, from the pack) and walking distance in metres (`*M` fields). It
 * never sees `realValue` or `realUnitLabel`, and knows nothing about the
 * domain a pack describes.
 */

import type { Milestone } from "../content";

/**
 * The slice of a pack the engine needs. A full `ContentPack` satisfies this
 * structurally; tests can pass a bare fixture without media.
 */
export interface JourneyPack {
  id: string;
  /** Ordered by non-decreasing `position` (guaranteed by the content contract). */
  milestones: readonly Pick<Milestone, "id" | "position">[];
}

export type JourneyStatus = "active" | "paused" | "completed";

/**
 * Runtime journey — exactly the persisted `UserJourney` shape (workplan
 * Stage 1). Timestamps are ISO-8601 strings supplied by the caller; the
 * engine never reads a clock.
 */
export interface JourneyState {
  id: string;
  packId: string;
  totalDistanceM: number;
  /** Clamped monotonic: never decreases, never exceeds `totalDistanceM`. */
  cumulativeDistanceM: number;
  /** In the order they were reached. Guards "each milestone fires once". */
  reachedMilestoneIds: string[];
  startedAt: string;
  endedAt?: string;
  status: JourneyStatus;
}

export interface MilestoneReached {
  type: "MilestoneReached";
  milestoneId: string;
  /** True for milestones at position 0, emitted by `startJourney`. */
  atStart: boolean;
}

export interface JourneyProgress {
  type: "JourneyProgress";
  /** `cumulativeDistanceM / totalDistanceM`, 0.0–1.0. */
  progress: number;
  /** Metres to the next unreached milestone; 0 when none remain. */
  distanceToNextM: number;
  /** `null` once every milestone has been reached. */
  nextMilestoneId: string | null;
}

export interface JourneyCompleted {
  type: "JourneyCompleted";
}

export type JourneyEvent = MilestoneReached | JourneyProgress | JourneyCompleted;

export interface JourneyResult {
  state: JourneyState;
  events: JourneyEvent[];
}
