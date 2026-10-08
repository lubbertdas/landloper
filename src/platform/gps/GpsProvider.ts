/**
 * GpsProvider — the DistanceProvider backed by background location updates
 * (workplan Stage 4; ADRs 0010–0011).
 *
 * Distance does not flow through this object's lifetime. The OS wakes the
 * background location task with fixes; the task calls `recordFixes`, which
 * loads the tracker state from storage, filters, saves, and publishes the
 * new cumulative distance on the `gpsHub`. This provider's listeners are
 * hub listeners, so whoever is subscribed when the task runs — normally the
 * app's JourneyController, which exists at module scope even when no screen
 * is mounted — receives it.
 *
 * Plain TypeScript: expo-location sits behind `LocationUpdates`, so tests
 * drive this with a fake.
 */

import type { DistanceListener, DistanceProvider } from "../distance/types";
import type { DiagnosticsLog, KeyValueStore } from "../storage/types";
import {
  DEFAULT_GPS_FILTER,
  initialTrackerState,
  pauseTracker,
  processFixes,
  resumeTracker,
  type FixDecision,
  type GpsFilterOptions,
  type GpsFix,
  type GpsTrackerState,
} from "./GpsTracker";

export const TRACKER_KEY = "gps.tracker";

/** Starting and stopping OS location updates. */
export interface LocationUpdates {
  start(): Promise<void>;
  stop(): Promise<void>;
  isRunning(): Promise<boolean>;
}

export interface GpsStatus {
  /** ISO time location updates were last (re)started; null when off. */
  listeningSince: string | null;
  /** ISO time of the newest fix received, accepted or not. */
  lastFixAt: string | null;
  lastOutcome: FixDecision["outcome"] | null;
  lastAccuracyM: number | null;
  /** The most recent start/stop failure, cleared by a successful start. */
  lastError: string | null;
}

/**
 * In-process fan-out from the background task to listeners, plus a status
 * the live screen can show ("waiting for GPS", "last fix 4 s ago").
 */
export class GpsHub {
  private readonly listeners = new Set<DistanceListener>();
  private readonly statusListeners = new Set<() => void>();
  private status: GpsStatus = {
    listeningSince: null,
    lastFixAt: null,
    lastOutcome: null,
    lastAccuracyM: null,
    lastError: null,
  };

  subscribe(listener: DistanceListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  publish(cumulativeM: number): void {
    for (const listener of [...this.listeners]) listener(cumulativeM);
  }

  getStatus = (): GpsStatus => this.status;

  subscribeStatus = (listener: () => void): (() => void) => {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  };

  updateStatus(patch: Partial<GpsStatus>): void {
    this.status = { ...this.status, ...patch };
    for (const listener of this.statusListeners) listener();
  }
}

function describe(d: FixDecision): string {
  const acc = d.fix.accuracy === null ? "no accuracy" : `±${d.fix.accuracy.toFixed(0)} m`;
  const seg = d.segmentM === undefined ? "" : ` ${d.segmentM.toFixed(1)} m`;
  const speed = d.speedMps === undefined ? "" : ` @ ${d.speedMps.toFixed(2)} m/s`;
  return `${d.outcome}${seg}${speed} (${acc})`;
}

/**
 * The background task's body: filter a batch of fixes and publish the new
 * total. Returns the cumulative metres, or null when no GPS journey is
 * running (fixes after stop are logged and dropped).
 */
export function recordFixes(
  deps: { kv: KeyValueStore; log: DiagnosticsLog; hub: GpsHub },
  fixes: readonly GpsFix[],
  options: GpsFilterOptions = DEFAULT_GPS_FILTER,
): number | null {
  const { kv, log, hub } = deps;
  const before = kv.get<GpsTrackerState>(TRACKER_KEY);
  if (before === null) {
    log.log("error", `${fixes.length} fix(es) arrived with no GPS journey running; dropped`);
    return null;
  }

  const { state, decisions } = processFixes(before, fixes, options);
  kv.set(TRACKER_KEY, state);

  for (const d of decisions) log.log("fix", describe(d));
  const accepted = decisions.filter((d) => d.outcome === "accepted").length;
  log.log(
    "batch",
    `${fixes.length} fix(es), ${accepted} accepted, total ${state.cumulativeM.toFixed(1)} m`,
  );

  const last = decisions[decisions.length - 1];
  if (last !== undefined) {
    hub.updateStatus({
      lastFixAt: new Date(last.fix.timestamp).toISOString(),
      lastOutcome: last.outcome,
      lastAccuracyM: last.fix.accuracy,
    });
  }

  hub.publish(state.cumulativeM);
  return state.cumulativeM;
}

export interface GpsProviderOptions {
  kv: KeyValueStore;
  log: DiagnosticsLog;
  hub: GpsHub;
  updates: LocationUpdates;
  /**
   * Reattach to a journey already in progress (after an app restart):
   * `start()` keeps the saved tracker state instead of resetting it.
   */
  attach?: boolean;
}

export class GpsProvider implements DistanceProvider {
  private readonly unsubscribers = new Set<() => void>();
  private stopped = false;
  private queue: Promise<void> = Promise.resolve();

  constructor(private readonly options: GpsProviderOptions) {}

  start(): void {
    if (this.stopped) return;
    const { kv, log, attach } = this.options;
    if (!attach || kv.get(TRACKER_KEY) === null) {
      kv.set(TRACKER_KEY, initialTrackerState());
      log.log("provider", "GPS started");
    } else {
      log.log("provider", "GPS reattached to journey in progress");
    }
    void this.ensureRunning();
  }

  stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    for (const unsubscribe of this.unsubscribers) unsubscribe();
    this.unsubscribers.clear();
    this.options.kv.remove(TRACKER_KEY);
    this.options.log.log("provider", "GPS stopped");
    this.options.hub.updateStatus({ listeningSince: null });
    void this.call("stop", () => this.options.updates.stop());
  }

  pause(): void {
    if (this.stopped) return;
    this.updateTracker(pauseTracker);
    this.options.log.log("provider", "GPS paused");
    this.options.hub.updateStatus({ listeningSince: null });
    void this.call("stop", () => this.options.updates.stop());
  }

  resume(): void {
    if (this.stopped) return;
    this.updateTracker(resumeTracker);
    this.options.log.log("provider", "GPS resumed");
    void this.ensureRunning();
  }

  onDistance(listener: DistanceListener): () => void {
    const unsubscribe = this.options.hub.subscribe(listener);
    this.unsubscribers.add(unsubscribe);
    return () => {
      unsubscribe();
      this.unsubscribers.delete(unsubscribe);
    };
  }

  private updateTracker(f: (s: GpsTrackerState) => GpsTrackerState): void {
    const { kv } = this.options;
    const state = kv.get<GpsTrackerState>(TRACKER_KEY);
    if (state !== null) kv.set(TRACKER_KEY, f(state));
  }

  private ensureRunning(): Promise<void> {
    const { updates } = this.options;
    return this.call("start", async () => {
      if (!(await updates.isRunning())) await updates.start();
    });
  }

  /**
   * Runs OS calls one at a time, in order, so a quick pause → resume can't
   * see "still running" before the stop has landed.
   */
  private call(what: "start" | "stop", f: () => Promise<void>): Promise<void> {
    this.queue = this.queue.then(async () => {
      try {
        await f();
        if (what === "start") {
          this.options.hub.updateStatus({
            lastError: null,
            listeningSince: new Date().toISOString(),
          });
        }
      } catch (error) {
        const message = `Could not ${what} location updates: ${String(error)}`;
        this.options.log.log("error", message);
        this.options.hub.updateStatus({ lastError: message });
      }
    });
    return this.queue;
  }

  /** Settles once every queued OS call has finished. For tests. */
  idle(): Promise<void> {
    return this.queue;
  }
}
