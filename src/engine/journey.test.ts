import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { derivePositions, type AuthoredContentPack } from "../content";
import {
  advance,
  JourneyError,
  pause,
  resume,
  startJourney,
  type JourneyEvent,
  type JourneyPack,
  type JourneyResult,
  type JourneyState,
} from "./index";

const T0 = "2026-10-07T09:00:00.000Z";
const T1 = "2026-10-07T10:00:00.000Z";

/** A pack from `[id, position]` pairs, so tests show only intent. */
function pack(...milestones: [string, number][]): JourneyPack {
  return {
    id: "test-pack",
    milestones: milestones.map(([id, position]) => ({ id, position })),
  };
}

/** Five milestones evenly spaced on a 1000 m walk: 0, 250, 500, 750, 1000 m. */
const EVEN = pack(["a", 0], ["b", 0.25], ["c", 0.5], ["d", 0.75], ["e", 1]);

function start(p: JourneyPack = EVEN, totalDistanceM = 1000): JourneyResult {
  return startJourney(p, totalDistanceM, { id: "j1", now: T0 });
}

/** Feeds a distance sequence, returning the final state and every event. */
function walk(
  p: JourneyPack,
  state: JourneyState,
  distances: number[],
): { state: JourneyState; events: JourneyEvent[] } {
  const events: JourneyEvent[] = [];
  for (const d of distances) {
    const result = advance(p, state, d, T1);
    state = result.state;
    events.push(...result.events);
  }
  return { state, events };
}

function reachedIds(events: JourneyEvent[]): string[] {
  return events.flatMap((e) => (e.type === "MilestoneReached" ? [e.milestoneId] : []));
}

function types(events: JourneyEvent[]): string[] {
  return events.map((e) => e.type);
}

describe("startJourney", () => {
  it("creates an active journey at distance 0", () => {
    const { state } = start();
    expect(state).toEqual({
      id: "j1",
      packId: "test-pack",
      totalDistanceM: 1000,
      cumulativeDistanceM: 0,
      reachedMilestoneIds: ["a"],
      startedAt: T0,
      status: "active",
    });
  });

  it("emits a milestone at position 0 with atStart, then progress", () => {
    const { events } = start();
    expect(events).toEqual([
      { type: "MilestoneReached", milestoneId: "a", atStart: true },
      { type: "JourneyProgress", progress: 0, distanceToNextM: 250, nextMilestoneId: "b" },
    ]);
  });

  it("emits nothing at start when no milestone sits at position 0", () => {
    const { state, events } = start(pack(["x", 0.5], ["y", 1]));
    expect(reachedIds(events)).toEqual([]);
    expect(state.reachedMilestoneIds).toEqual([]);
  });

  it("rejects a zero, negative or non-finite total distance", () => {
    for (const bad of [0, -5, NaN, Infinity]) {
      expect(() => start(EVEN, bad)).toThrow(JourneyError);
    }
  });

  it("rejects a pack with no milestones", () => {
    expect(() => start(pack())).toThrow(JourneyError);
  });
});

describe("advance", () => {
  it("reaches a milestone exactly at its threshold", () => {
    const { events } = walk(EVEN, start().state, [249.9, 250]);
    expect(reachedIds(events)).toEqual(["b"]);
  });

  it("emits several milestones in one tick, in ascending position order", () => {
    // Overshoot: 0 → 800 m crosses b (250), c (500) and d (750).
    const { state, events } = walk(EVEN, start().state, [800]);
    expect(reachedIds(events)).toEqual(["b", "c", "d"]);
    expect(events.every((e) => e.type !== "MilestoneReached" || !e.atStart)).toBe(true);
    expect(state.reachedMilestoneIds).toEqual(["a", "b", "c", "d"]);
    expect(events.at(-1)).toEqual({
      type: "JourneyProgress",
      progress: 0.8,
      distanceToNextM: 200,
      nextMilestoneId: "e",
    });
  });

  it("ignores backward jitter: distance never decreases", () => {
    const { state, events } = walk(EVEN, start().state, [300, 280, 290, 260]);
    expect(state.cumulativeDistanceM).toBe(300);
    expect(reachedIds(events)).toEqual(["b"]);
    // Only the first tick changed anything.
    expect(types(events)).toEqual(["MilestoneReached", "JourneyProgress"]);
  });

  it("does not re-fire a milestone after jitter dips below and recrosses it", () => {
    const { events } = walk(EVEN, start().state, [260, 240, 255, 270]);
    expect(reachedIds(events)).toEqual(["b"]);
  });

  it("is a no-op for a duplicate advance with the same value", () => {
    const first = walk(EVEN, start().state, [500]);
    const again = advance(EVEN, first.state, 500, T1);
    expect(again.events).toEqual([]);
    expect(again.state).toBe(first.state);
  });

  it("is a no-op for an advance of zero distance at the start", () => {
    const { state } = start();
    const result = advance(EVEN, state, 0, T1);
    expect(result.events).toEqual([]);
    expect(result.state).toBe(state);
  });

  it("treats negative input as no movement", () => {
    const { state } = start();
    expect(advance(EVEN, state, -10, T1).events).toEqual([]);
  });

  it("rejects NaN distance", () => {
    expect(() => advance(EVEN, start().state, NaN, T1)).toThrow(JourneyError);
  });

  it("does not mutate the input state", () => {
    const { state } = start();
    const snapshot = structuredClone(state);
    advance(EVEN, state, 900, T1);
    expect(state).toEqual(snapshot);
  });
});

describe("completion", () => {
  it("completes exactly at the endpoint", () => {
    const { state, events } = walk(EVEN, start().state, [999, 1000]);
    expect(reachedIds(events)).toEqual(["b", "c", "d", "e"]);
    expect(types(events).slice(-3)).toEqual([
      "MilestoneReached",
      "JourneyProgress",
      "JourneyCompleted",
    ]);
    expect(state.status).toBe("completed");
    expect(state.endedAt).toBe(T1);
    expect(state.cumulativeDistanceM).toBe(1000);
  });

  it("clamps past-endpoint distance to the total and completes", () => {
    const { state, events } = walk(EVEN, start().state, [5000]);
    expect(state.cumulativeDistanceM).toBe(1000);
    expect(reachedIds(events)).toEqual(["b", "c", "d", "e"]);
    expect(events.at(-2)).toEqual({
      type: "JourneyProgress",
      progress: 1,
      distanceToNextM: 0,
      nextMilestoneId: null,
    });
    expect(events.at(-1)).toEqual({ type: "JourneyCompleted" });
  });

  it("emits JourneyCompleted exactly once and ignores further advances", () => {
    const done = walk(EVEN, start().state, [1000]);
    const after = walk(EVEN, done.state, [1200, 2000]);
    expect(after.events).toEqual([]);
    expect(after.state).toBe(done.state);
    expect(types(done.events).filter((t) => t === "JourneyCompleted")).toHaveLength(1);
  });

  it("fires the last milestone on completion despite floating-point rounding", () => {
    // 0.1 + 0.2 style error: a position just above what the total yields.
    const p = pack(["a", 0], ["z", 1.0000000000000002]);
    const { events } = walk(p, start(p, 3).state, [3]);
    expect(reachedIds(events)).toEqual(["z"]);
  });
});

describe("pause and resume", () => {
  it("ignores advances while paused, then continues from the old distance", () => {
    let { state } = walk(EVEN, start().state, [100]);
    state = pause(state).state;
    expect(state.status).toBe("paused");

    const whilePaused = walk(EVEN, state, [400, 600]);
    expect(whilePaused.events).toEqual([]);
    expect(whilePaused.state.cumulativeDistanceM).toBe(100);

    state = resume(whilePaused.state).state;
    expect(state.status).toBe("active");
    const after = walk(EVEN, state, [600]);
    expect(reachedIds(after.events)).toEqual(["b", "c"]);
  });

  it("emits no events from pause or resume", () => {
    const paused = pause(start().state);
    expect(paused.events).toEqual([]);
    expect(resume(paused.state).events).toEqual([]);
  });

  it("is a no-op to pause a paused journey or resume an active one", () => {
    const { state } = start();
    expect(resume(state).state).toBe(state);
    const paused = pause(state).state;
    expect(pause(paused).state).toBe(paused);
  });

  it("cannot pause or resume a completed journey", () => {
    const { state } = walk(EVEN, start().state, [1000]);
    expect(pause(state).state).toBe(state);
    expect(resume(state).state).toBe(state);
  });
});

describe("edge-shaped packs", () => {
  it("single milestone: fires at start, completes at the total", () => {
    const p = pack(["only", 0]);
    const started = start(p, 500);
    expect(reachedIds(started.events)).toEqual(["only"]);
    expect(started.events.at(-1)).toMatchObject({ nextMilestoneId: null, distanceToNextM: 0 });

    const mid = walk(p, started.state, [250]);
    expect(reachedIds(mid.events)).toEqual([]);
    expect(mid.state.status).toBe("active");

    const end = walk(p, mid.state, [500]);
    expect(types(end.events)).toEqual(["JourneyProgress", "JourneyCompleted"]);
  });

  it("zero-span pack: every milestone fires at start, completes at the total", () => {
    const p = pack(["a", 0], ["b", 0], ["c", 0]);
    const started = start(p, 2000);
    expect(started.events.filter((e) => e.type === "MilestoneReached")).toEqual([
      { type: "MilestoneReached", milestoneId: "a", atStart: true },
      { type: "MilestoneReached", milestoneId: "b", atStart: true },
      { type: "MilestoneReached", milestoneId: "c", atStart: true },
    ]);
    const end = walk(p, started.state, [1999, 2000]);
    expect(reachedIds(end.events)).toEqual([]);
    expect(end.state.status).toBe("completed");
  });

  it("milestones sharing a position fire together, in pack order", () => {
    const p = pack(["a", 0], ["b", 0.5], ["c", 0.5], ["d", 1]);
    const { events } = walk(p, start(p, 100).state, [50]);
    expect(reachedIds(events)).toEqual(["b", "c"]);
  });
});

describe("with the real solar-system pack", () => {
  const authored = JSON.parse(
    readFileSync(new URL("../../packs/solar-system/pack.json", import.meta.url), "utf8"),
  ) as AuthoredContentPack;
  const solar = derivePositions(authored);

  it("passes every planet exactly once over a 2 km walk in 10 m steps", () => {
    let { state, events } = startJourney(solar, 2000, { id: "s", now: T0 });
    const all = [...events];
    for (let d = 10; d <= 2000; d += 10) {
      const r = advance(solar, state, d, T1);
      state = r.state;
      all.push(...r.events);
    }
    expect(reachedIds(all)).toEqual(solar.milestones.map((m) => m.id));
    expect(state.status).toBe("completed");
  });

  it("clusters the inner planets in the first ~77 m of 2 km (ADR 0004)", () => {
    const { state } = startJourney(solar, 2000, { id: "s", now: T0 });
    const { events } = walk(solar, state, [78]);
    expect(reachedIds(events)).toEqual(["mercury", "venus", "earth", "mars"]);
  });
});
