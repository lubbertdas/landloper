/**
 * The Stage 4/5 tick path without a phone: background task → GPS filter →
 * hub → controller → store → notifications, plus restoring after an app
 * restart. expo-location and expo-notifications are faked.
 */

import { describe, expect, it } from "vitest";

import type { ContentPack } from "../content";
import {
  connectNotifications,
  GpsHub,
  GpsProvider,
  JourneyController,
  MemoryDiagnosticsLog,
  MemoryJourneyStore,
  MemoryKeyValueStore,
  MockProvider,
  recordFixes,
  steadyWalk,
  TRACKER_KEY,
  type Clock,
  type DistanceSource,
  type GpsFix,
  type LocationUpdates,
  type MilestoneNotification,
} from "./index";

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
    notification: { title: `Reached ${id}`, body: `Body ${id}` },
  })),
};

class FakeUpdates implements LocationUpdates {
  running = false;
  calls: string[] = [];
  failStart = false;

  async start(): Promise<void> {
    this.calls.push("start");
    if (this.failStart) throw new Error("permission denied");
    this.running = true;
  }

  async stop(): Promise<void> {
    this.calls.push("stop");
    this.running = false;
  }

  async isRunning(): Promise<boolean> {
    return this.running;
  }
}

class ManualClock implements Clock {
  private callbacks = new Map<number, () => void>();
  private next = 1;
  setInterval(cb: () => void): unknown {
    const id = this.next++;
    this.callbacks.set(id, cb);
    return id;
  }
  clearInterval(handle: unknown): void {
    this.callbacks.delete(handle as number);
  }
  tick(times = 1): void {
    for (let i = 0; i < times; i++) for (const cb of [...this.callbacks.values()]) cb();
  }
}

const M_PER_DEG_LAT = (2 * Math.PI * 6_371_008.8) / 360;
function fix(northM: number, seconds: number): GpsFix {
  return { latitude: 52 + northM / M_PER_DEG_LAT, longitude: 5, accuracy: 5, timestamp: seconds * 1000 };
}

/** One "app process": shared storage passed in, everything else fresh. */
function boot(storage: { store: MemoryJourneyStore; kv: MemoryKeyValueStore }) {
  const log = new MemoryDiagnosticsLog(() => "t");
  const hub = new GpsHub();
  const updates = new FakeUpdates();
  const clock = new ManualClock();
  let gps: GpsProvider | null = null;
  const controller = new JourneyController({
    store: storage.store,
    getPack: (id) => (id === PACK.id ? PACK : undefined),
    log,
    now: () => "2026-10-08T00:00:00.000Z",
    newId: () => "j1",
    createProvider: (source: DistanceSource, resume) => {
      if (source === "mock") {
        // 10 m per tick.
        return new MockProvider({
          curve: steadyWalk(10),
          tickMs: 1000,
          clock,
          startAtM: resume?.fromM ?? 0,
        });
      }
      gps = new GpsProvider({ kv: storage.kv, log, hub, updates, attach: resume !== null });
      return gps;
    },
  });
  const sent: MilestoneNotification[] = [];
  let enabled = true;
  connectNotifications(
    controller,
    { present: async (n) => void sent.push(n) },
    { isEnabled: () => enabled, log },
  );
  const task = (fixes: GpsFix[]) => recordFixes({ kv: storage.kv, log, hub }, fixes);
  return {
    controller,
    log,
    hub,
    updates,
    clock,
    sent,
    task,
    gps: () => gps,
    setEnabled: (v: boolean) => (enabled = v),
  };
}

function freshStorage() {
  return { store: new MemoryJourneyStore(), kv: new MemoryKeyValueStore() };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("GPS journey end to end", () => {
  it("turns background fixes into stored progress, milestones and notifications", async () => {
    const storage = freshStorage();
    const app = boot(storage);
    app.controller.start(PACK, 100, "gps");
    await app.gps()!.idle();
    expect(app.updates.running).toBe(true);

    // Walk 105 m north at 1.4 m/s in 7 m steps.
    const fixes = Array.from({ length: 16 }, (_, i) => fix(i * 7, i * 5));
    for (const f of fixes) app.task([f]);
    await flush();

    const stored = storage.store.loadActive();
    expect(stored?.state.status).toBe("completed");
    expect(stored?.state.reachedMilestoneIds).toEqual(["a", "b", "c"]);
    // "a" is at the start: shown on screen, not notified.
    expect(app.sent.map((n) => n.data.milestoneId)).toEqual(["b", "c"]);
    expect(app.sent[0]).toEqual({
      title: "Reached b",
      body: "Body b",
      data: { packId: "test-pack", milestoneId: "b" },
    });
    // Completion stops location updates and clears the tracker.
    await app.gps()!.idle();
    expect(app.updates.running).toBe(false);
    expect(storage.kv.get(TRACKER_KEY)).toBeNull();
  });

  it("does not notify when notifications are turned off", async () => {
    const app = boot(freshStorage());
    app.setEnabled(false);
    app.controller.start(PACK, 100, "gps");
    for (let i = 0; i < 16; i++) app.task([fix(i * 7, i * 5)]);
    await flush();
    expect(app.sent).toEqual([]);
    expect(app.log.recent(100).some((e) => e.message.startsWith("Skipped"))).toBe(true);
  });

  it("ignores walking while paused, and keeps the order of OS calls", async () => {
    const storage = freshStorage();
    const app = boot(storage);
    app.controller.start(PACK, 1000, "gps");
    app.task([fix(0, 0)]);
    app.task([fix(7, 5)]);
    app.controller.pause();
    app.task([fix(100, 60)]);
    app.controller.resume();
    await app.gps()!.idle();
    expect(app.updates.calls).toEqual(["start", "stop", "start"]);
    expect(app.updates.running).toBe(true);

    app.task([fix(110, 70)]);
    app.task([fix(117, 75)]);
    expect(storage.store.loadActive()?.state.cumulativeDistanceM).toBeCloseTo(14, 6);
  });

  it("drops fixes that arrive after the journey ended", () => {
    const app = boot(freshStorage());
    app.controller.start(PACK, 100, "gps");
    app.controller.end();
    expect(app.task([fix(0, 0)])).toBeNull();
    expect(app.log.recent(1)[0]?.kind).toBe("error");
  });

  it("surfaces a failure to start location updates", async () => {
    const app = boot(freshStorage());
    app.updates.failStart = true;
    app.controller.start(PACK, 100, "gps");
    await app.gps()!.idle();
    expect(app.hub.getStatus().lastError).toMatch(/permission denied/);
  });

  it("carries on after an app restart, without resetting the GPS total", async () => {
    const storage = freshStorage();
    const first = boot(storage);
    first.controller.start(PACK, 100, "gps");
    first.task([fix(0, 0)]);
    first.task([fix(7, 5)]);
    first.task([fix(14, 10)]);

    // The process dies; the OS later wakes the app headless with new fixes.
    const second = boot(storage);
    second.updates.running = true;
    second.controller.restore();
    second.task([fix(21, 15)]);

    const snap = second.controller.getSnapshot();
    expect(snap.current?.state.cumulativeDistanceM).toBeCloseTo(21, 6);
    await second.gps()!.idle();
    expect(second.updates.calls).toEqual([]); // already running: not restarted
  });

  it("keeps ticking when a listener throws", () => {
    const storage = freshStorage();
    const app = boot(storage);
    app.controller.onEvents(() => {
      throw new Error("boom");
    });
    app.controller.start(PACK, 100, "gps");
    app.task([fix(0, 0)]);
    app.task([fix(7, 5)]);
    expect(storage.store.loadActive()?.state.cumulativeDistanceM).toBeCloseTo(7, 6);
    expect(app.log.recent(100).some((e) => e.message.includes("boom"))).toBe(true);
  });
});

describe("mock journey persistence", () => {
  it("saves every tick and resumes from the saved distance after a restart", () => {
    const storage = freshStorage();
    const first = boot(storage);
    first.controller.start(PACK, 100, "mock");
    first.clock.tick(3);
    expect(storage.store.loadActive()?.state.cumulativeDistanceM).toBe(30);

    const second = boot(storage);
    second.controller.restore();
    expect(second.controller.getSnapshot().current?.state.cumulativeDistanceM).toBe(30);
    second.clock.tick(1);
    expect(storage.store.loadActive()?.state.cumulativeDistanceM).toBe(40);
  });

  it("restores a paused journey without moving until resumed", () => {
    const storage = freshStorage();
    const first = boot(storage);
    first.controller.start(PACK, 100, "mock");
    first.clock.tick(2);
    first.controller.pause();

    const second = boot(storage);
    second.controller.restore();
    second.clock.tick(5);
    expect(storage.store.loadActive()?.state.cumulativeDistanceM).toBe(20);
    second.controller.resume();
    second.clock.tick(1);
    expect(storage.store.loadActive()?.state.cumulativeDistanceM).toBe(30);
  });

  it("discards a stored journey whose pack no longer exists", () => {
    const storage = freshStorage();
    storage.store.saveActive({
      state: {
        id: "old",
        packId: "gone",
        totalDistanceM: 100,
        cumulativeDistanceM: 0,
        reachedMilestoneIds: [],
        startedAt: "x",
        status: "active",
      },
      source: "mock",
      latestMilestoneId: null,
    });
    const app = boot(storage);
    app.controller.restore();
    expect(app.controller.getSnapshot().current).toBeNull();
    expect(storage.store.loadActive()).toBeNull();
  });
});
