import { describe, expect, it } from "vitest";

import {
  haversineM,
  initialTrackerState,
  pauseTracker,
  processFixes,
  resumeTracker,
  type GpsFix,
} from "./GpsTracker";

const M_PER_DEG_LAT = (2 * Math.PI * 6_371_008.8) / 360;

/** A fix `northM` metres north of a fixed origin, at `seconds`. */
function fix(northM: number, seconds: number, accuracy: number | null = 5): GpsFix {
  return {
    latitude: 52 + northM / M_PER_DEG_LAT,
    longitude: 5,
    accuracy,
    timestamp: 1_000_000 + seconds * 1000,
  };
}

function run(fixes: GpsFix[], state = initialTrackerState()) {
  return processFixes(state, fixes);
}

describe("haversineM", () => {
  it("measures a north-south metre as a metre", () => {
    expect(haversineM(fix(0, 0), fix(100, 0))).toBeCloseTo(100, 6);
  });

  it("is zero for the same point", () => {
    expect(haversineM(fix(10, 0), fix(10, 5))).toBe(0);
  });
});

describe("processFixes", () => {
  it("anchors on the first good fix and counts walking after it", () => {
    const { state, decisions } = run([fix(0, 0), fix(7, 5), fix(14, 10)]);
    expect(decisions.map((d) => d.outcome)).toEqual(["anchored", "accepted", "accepted"]);
    expect(state.cumulativeM).toBeCloseTo(14, 6);
  });

  it("discards inaccurate fixes and fixes without accuracy", () => {
    const { state, decisions } = run([fix(0, 0), fix(7, 5, 30), fix(9, 7, null), fix(14, 10)]);
    expect(decisions.map((d) => d.outcome)).toEqual([
      "anchored",
      "inaccurate",
      "no-accuracy",
      "accepted",
    ]);
    expect(state.cumulativeM).toBeCloseTo(14, 6);
  });

  it("lets small steps add up instead of losing them", () => {
    const { state, decisions } = run([fix(0, 0), fix(3, 2), fix(6, 4)]);
    expect(decisions.map((d) => d.outcome)).toEqual(["anchored", "too-small", "accepted"]);
    expect(state.cumulativeM).toBeCloseTo(6, 6);
  });

  it("drops a single GPS jump and keeps the anchor", () => {
    const { state, decisions } = run([fix(0, 0), fix(80, 5), fix(7, 10)]);
    expect(decisions.map((d) => d.outcome)).toEqual(["anchored", "too-fast", "accepted"]);
    expect(state.cumulativeM).toBeCloseTo(7, 6);
  });

  it("re-anchors without counting after repeated jumps", () => {
    const { state, decisions } = run([
      fix(0, 0),
      fix(100, 5),
      fix(110, 10),
      fix(120, 15),
      fix(127, 20),
    ]);
    expect(decisions.map((d) => d.outcome)).toEqual([
      "anchored",
      "too-fast",
      "too-fast",
      "too-fast-reanchored",
      "accepted",
    ]);
    expect(state.cumulativeM).toBeCloseTo(7, 6);
  });

  it("re-anchors without counting after drift or a long stop", () => {
    const { state, decisions } = run([fix(0, 0), fix(10, 120), fix(17, 125)]);
    expect(decisions.map((d) => d.outcome)).toEqual([
      "anchored",
      "too-slow-reanchored",
      "accepted",
    ]);
    expect(state.cumulativeM).toBeCloseTo(7, 6);
  });

  it("sorts a batch by time and ignores fixes it has already seen", () => {
    const first = run([fix(7, 5), fix(0, 0)]);
    expect(first.state.cumulativeM).toBeCloseTo(7, 6);
    const second = run([fix(7, 5), fix(14, 10)], first.state);
    expect(second.decisions.map((d) => d.outcome)).toEqual(["stale", "accepted"]);
    expect(second.state.cumulativeM).toBeCloseTo(14, 6);
  });

  it("does not count distance covered while paused", () => {
    const walked = run([fix(0, 0), fix(7, 5)]);
    const paused = run([fix(50, 30)], pauseTracker(walked.state));
    expect(paused.decisions[0]?.outcome).toBe("paused");
    const resumed = run([fix(60, 40), fix(67, 45)], resumeTracker(paused.state));
    expect(resumed.decisions.map((d) => d.outcome)).toEqual(["anchored", "accepted"]);
    expect(resumed.state.cumulativeM).toBeCloseTo(14, 6);
  });

  it("does not mutate the state it was given", () => {
    const state = initialTrackerState();
    run([fix(0, 0), fix(7, 5)], state);
    expect(state).toEqual(initialTrackerState());
  });
});
