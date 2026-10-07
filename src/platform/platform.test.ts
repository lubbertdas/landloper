import { describe, expect, it } from "vitest";

import type { ContentPack } from "../content";
import type { JourneyEvent } from "../engine";
import { JourneyController, MockProvider, steadyWalk, type Clock } from "./index";

/** A manual clock: `advance(ms)` fires every due interval tick. */
class FakeClock implements Clock {
  private timers = new Map<number, { cb: () => void; ms: number; due: number }>();
  private nextId = 1;
  private nowMs = 0;

  setInterval(cb: () => void, ms: number): unknown {
    const id = this.nextId++;
    this.timers.set(id, { cb, ms, due: this.nowMs + ms });
    return id;
  }

  clearInterval(handle: unknown): void {
    this.timers.delete(handle as number);
  }

  advance(ms: number): void {
    const end = this.nowMs + ms;
    for (;;) {
      let nextId: number | null = null;
      let nextDue = Infinity;
      for (const [id, t] of this.timers) {
        if (t.due <= end && t.due < nextDue) {
          nextDue = t.due;
          nextId = id;
        }
      }
      if (nextId === null) break;
      const timer = this.timers.get(nextId)!;
      this.nowMs = timer.due;
      timer.due += timer.ms;
      timer.cb();
    }
    this.nowMs = end;
  }

  get active(): number {
    return this.timers.size;
  }
}

describe("MockProvider", () => {
  function setup(timeScale = 1) {
    const clock = new FakeClock();
    const provider = new MockProvider({
      curve: steadyWalk(2),
      timeScale,
      tickMs: 1000,
      clock,
    });
    const seen: number[] = [];
    provider.onDistance((m) => seen.push(m));
    return { clock, provider, seen };
  }

  it("emits cumulative distance along the curve each tick", () => {
    const { clock, provider, seen } = setup();
    provider.start();
    clock.advance(3000);
    expect(seen).toEqual([2, 4, 6]);
  });

  it("accelerates by timeScale", () => {
    const { clock, provider, seen } = setup(10);
    provider.start();
    clock.advance(2000);
    expect(seen).toEqual([20, 40]);
  });

  it("does not count time spent paused", () => {
    const { clock, provider, seen } = setup();
    provider.start();
    clock.advance(1000);
    provider.pause();
    clock.advance(5000);
    provider.resume();
    clock.advance(1000);
    expect(seen).toEqual([2, 4]);
  });

  it("can change speed mid-walk", () => {
    const { clock, provider, seen } = setup();
    provider.start();
    clock.advance(1000);
    provider.setTimeScale(5);
    clock.advance(1000);
    expect(seen).toEqual([2, 12]);
  });

  it("stays monotonic even if the curve dips", () => {
    const clock = new FakeClock();
    const provider = new MockProvider({
      curve: (s) => (s === 2 ? 1 : s * 10),
      tickMs: 1000,
      clock,
    });
    const seen: number[] = [];
    provider.onDistance((m) => seen.push(m));
    provider.start();
    clock.advance(3000);
    expect(seen).toEqual([10, 10, 30]);
  });

  it("stops for good and releases its timer", () => {
    const { clock, provider, seen } = setup();
    provider.start();
    provider.stop();
    provider.resume();
    clock.advance(5000);
    expect(seen).toEqual([]);
    expect(clock.active).toBe(0);
  });
});

const PACK: ContentPack = {
  schemaVersion: 1,
  id: "test-pack",
  title: "Test",
  description: "Fixture.",
  domainType: "test",
  locale: "en",
  version: "1.0.0",
  coverImage: "images/cover.webp",
  scalingModel: "fit-to-distance",
  realUnitLabel: "km",
  suggestedDistancesM: [100],
  media: [{ ref: "images/cover.webp", type: "image", width: 1, height: 1, bytes: 1 }],
  milestones: ["a", "b", "c"].map((id, i) => ({
    id,
    realValue: i,
    position: i / 2,
    title: id,
    body: id,
    mediaRefs: [],
    notification: { title: id, body: id },
  })),
};

describe("JourneyController with MockProvider", () => {
  function setup() {
    const clock = new FakeClock();
    let provider: MockProvider | null = null;
    const controller = new JourneyController({
      createProvider: () => {
        // 10 m per 1 s tick.
        provider = new MockProvider({ curve: steadyWalk(10), tickMs: 1000, clock });
        return provider;
      },
      now: () => "2026-10-07T00:00:00.000Z",
      newId: () => "j1",
    });
    const events: JourneyEvent[] = [];
    controller.onEvents((batch) => events.push(...batch));
    return { clock, controller, events, provider: () => provider };
  }

  it("drives the real engine from mock distance to completion", () => {
    const { clock, controller, events } = setup();
    controller.start(PACK, 100);
    clock.advance(100_000);

    const reached = events.flatMap((e) => (e.type === "MilestoneReached" ? [e.milestoneId] : []));
    expect(reached).toEqual(["a", "b", "c"]);
    expect(events.filter((e) => e.type === "JourneyCompleted")).toHaveLength(1);

    const snap = controller.getSnapshot();
    expect(snap.current?.state.status).toBe("completed");
    expect(snap.current?.latestMilestoneId).toBe("c");
    expect(snap.history).toHaveLength(1);
    expect(clock.active).toBe(0);
  });

  it("pauses both the engine and the provider", () => {
    const { clock, controller } = setup();
    controller.start(PACK, 100);
    clock.advance(3000);
    controller.pause();
    clock.advance(10_000);
    expect(controller.getSnapshot().current?.state.cumulativeDistanceM).toBe(30);
    controller.resume();
    clock.advance(1000);
    expect(controller.getSnapshot().current?.state.cumulativeDistanceM).toBe(40);
  });

  it("refuses a second journey while one is in progress", () => {
    const { controller } = setup();
    controller.start(PACK, 100);
    expect(() => controller.start(PACK, 100)).toThrow(/already in progress/);
    controller.pause();
    expect(() => controller.start(PACK, 100)).toThrow(/already in progress/);
  });

  it("discards an abandoned journey without recording history", () => {
    const { clock, controller } = setup();
    controller.start(PACK, 100);
    clock.advance(2000);
    controller.end();
    expect(controller.getSnapshot()).toEqual({ current: null, history: [] });
    expect(clock.active).toBe(0);
  });

  it("notifies subscribers with a new snapshot object on every change", () => {
    const { clock, controller } = setup();
    const snaps = new Set<unknown>();
    controller.subscribe(() => snaps.add(controller.getSnapshot()));
    controller.start(PACK, 100);
    clock.advance(2000);
    expect(snaps.size).toBe(3);
  });
});
