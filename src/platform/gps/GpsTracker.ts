/**
 * GPS fix filtering and distance accumulation (workplan Stage 4, "GPS
 * specifics"). Pure TypeScript over plain numbers: the background task
 * loads the tracker state, feeds it the fixes the OS delivered, and saves
 * the result. Nothing here touches expo-location or storage.
 *
 * Rules (workplan, plus ADR 0011 for what it leaves open):
 * - discard fixes with accuracy worse than 25 m, or with no accuracy;
 * - measure from an *anchor* (the last accepted fix) with Haversine;
 * - ignore moves under 5 m — the anchor stays, so small steps add up;
 * - a segment faster than 4 m/s is a GPS jump: drop the fix, keep the
 *   anchor. After 3 jumps in a row, re-anchor without counting (we lost
 *   track; better to miss a little than to count a teleport);
 * - a segment slower than 0.2 m/s is drift or a long stop: re-anchor at
 *   the new fix without counting;
 * - while paused there is no anchor; the first fix after resuming anchors.
 */

export interface GpsFix {
  latitude: number;
  longitude: number;
  /** Horizontal accuracy radius in metres; null when the OS gave none. */
  accuracy: number | null;
  /** Milliseconds since epoch. */
  timestamp: number;
}

export interface GpsFilterOptions {
  maxAccuracyM: number;
  minSegmentM: number;
  minSpeedMps: number;
  maxSpeedMps: number;
  /** Consecutive too-fast fixes after which the anchor moves. */
  maxConsecutiveJumps: number;
}

export const DEFAULT_GPS_FILTER: GpsFilterOptions = {
  maxAccuracyM: 25,
  minSegmentM: 5,
  minSpeedMps: 0.2,
  maxSpeedMps: 4,
  maxConsecutiveJumps: 3,
};

/** JSON-serialisable; persisted between background task wake-ups. */
export interface GpsTrackerState {
  anchor: GpsFix | null;
  /** Accepted metres since the journey started. */
  cumulativeM: number;
  paused: boolean;
  consecutiveJumps: number;
  /** Timestamp of the newest fix seen, accepted or not. */
  lastTimestamp: number | null;
}

export type FixOutcome =
  | "accepted"
  | "anchored"
  | "too-small"
  | "inaccurate"
  | "no-accuracy"
  | "too-fast"
  | "too-fast-reanchored"
  | "too-slow-reanchored"
  | "stale"
  | "paused";

export interface FixDecision {
  fix: GpsFix;
  outcome: FixOutcome;
  /** Distance from the anchor, when one existed. */
  segmentM?: number;
  speedMps?: number;
  /** Metres added to the total (0 unless accepted). */
  addedM: number;
}

export function initialTrackerState(): GpsTrackerState {
  return { anchor: null, cumulativeM: 0, paused: false, consecutiveJumps: 0, lastTimestamp: null };
}

export function pauseTracker(state: GpsTrackerState): GpsTrackerState {
  return { ...state, paused: true, anchor: null, consecutiveJumps: 0 };
}

export function resumeTracker(state: GpsTrackerState): GpsTrackerState {
  return { ...state, paused: false, anchor: null, consecutiveJumps: 0 };
}

const EARTH_RADIUS_M = 6_371_008.8;

/** Great-circle distance in metres. */
export function haversineM(
  a: Pick<GpsFix, "latitude" | "longitude">,
  b: Pick<GpsFix, "latitude" | "longitude">,
): number {
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad;
  const dLon = (b.longitude - a.longitude) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Feeds a batch of fixes, in any order, through the filter. Returns the
 * new state and one decision per fix (for the diagnostics log).
 */
export function processFixes(
  state: GpsTrackerState,
  fixes: readonly GpsFix[],
  options: GpsFilterOptions = DEFAULT_GPS_FILTER,
): { state: GpsTrackerState; decisions: FixDecision[] } {
  let s = state;
  const decisions: FixDecision[] = [];
  const ordered = [...fixes].sort((a, b) => a.timestamp - b.timestamp);

  for (const fix of ordered) {
    const decision = (outcome: FixOutcome, extra: Partial<FixDecision> = {}): void => {
      decisions.push({ fix, outcome, addedM: 0, ...extra });
    };

    if (s.lastTimestamp !== null && fix.timestamp <= s.lastTimestamp) {
      decision("stale");
      continue;
    }
    s = { ...s, lastTimestamp: fix.timestamp };

    if (s.paused) {
      decision("paused");
      continue;
    }
    if (fix.accuracy === null) {
      decision("no-accuracy");
      continue;
    }
    if (fix.accuracy > options.maxAccuracyM) {
      decision("inaccurate");
      continue;
    }
    if (s.anchor === null) {
      s = { ...s, anchor: fix, consecutiveJumps: 0 };
      decision("anchored");
      continue;
    }

    const segmentM = haversineM(s.anchor, fix);
    const seconds = (fix.timestamp - s.anchor.timestamp) / 1000;
    const speedMps = seconds > 0 ? segmentM / seconds : Infinity;
    const measured = { segmentM, speedMps };

    if (segmentM < options.minSegmentM) {
      decision("too-small", measured);
      continue;
    }
    if (speedMps > options.maxSpeedMps) {
      const jumps = s.consecutiveJumps + 1;
      if (jumps >= options.maxConsecutiveJumps) {
        s = { ...s, anchor: fix, consecutiveJumps: 0 };
        decision("too-fast-reanchored", measured);
      } else {
        s = { ...s, consecutiveJumps: jumps };
        decision("too-fast", measured);
      }
      continue;
    }
    if (speedMps < options.minSpeedMps) {
      s = { ...s, anchor: fix, consecutiveJumps: 0 };
      decision("too-slow-reanchored", measured);
      continue;
    }

    s = { ...s, anchor: fix, consecutiveJumps: 0, cumulativeM: s.cumulativeM + segmentM };
    decision("accepted", { ...measured, addedM: segmentM });
  }

  return { state: s, decisions };
}
