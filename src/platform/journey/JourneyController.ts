/**
 * The thin stateful shell around the pure engine (workplan Stage 3/4).
 *
 * Owns the one current journey, wires a DistanceProvider into `advance()`,
 * and lets the UI and the notification layer observe state and events.
 * "Subscribing to the engine" anywhere in the workplan means subscribing
 * here.
 *
 * Storage is the source of truth (ADR 0010). Every distance tick is
 * load → advance → save → hand events on, so the same path works whether
 * the distance came from the in-app mock or from the background location
 * task with no screen mounted. The controller is a plain object created at
 * module scope; it never depends on a React component's lifecycle.
 *
 * History is still in memory until Stage 7.
 */

import type { ContentPack } from "../../content";
import {
  advance,
  pause as pauseJourney,
  resume as resumeJourney,
  startJourney,
  type JourneyEvent,
  type JourneyState,
} from "../../engine";
import type { DistanceProvider } from "../distance/types";
import type { DiagnosticsLog, DistanceSource, JourneyStore, StoredJourney } from "../storage/types";

export interface ActiveJourney {
  pack: ContentPack;
  state: JourneyState;
  source: DistanceSource;
  /** Most recently reached milestone, for the live screen's current card. */
  latestMilestoneId: string | null;
}

export interface HistoryEntry {
  pack: ContentPack;
  state: JourneyState;
}

export interface JourneySnapshot {
  /** The active, paused, or just-completed journey; null when none. */
  current: ActiveJourney | null;
  /** Completed journeys, newest first. */
  history: readonly HistoryEntry[];
}

/** `resume` is set when taking over a journey already in progress. */
export type ProviderFactory = (
  source: DistanceSource,
  resume: { fromM: number } | null,
) => DistanceProvider;

export interface JourneyControllerOptions {
  store: JourneyStore;
  getPack: (id: string) => ContentPack | undefined;
  createProvider: ProviderFactory;
  log?: DiagnosticsLog;
  now?: () => string;
  newId?: () => string;
}

export type EventListener = (events: JourneyEvent[], journey: ActiveJourney) => void;

let idCounter = 0;
function defaultId(): string {
  idCounter += 1;
  return `journey-${Date.now().toString(36)}-${idCounter}`;
}

const noLog: DiagnosticsLog = { log: () => {}, recent: () => [], clear: () => {} };

export class JourneyController {
  private readonly store: JourneyStore;
  private readonly getPack: (id: string) => ContentPack | undefined;
  private readonly createProvider: ProviderFactory;
  private readonly log: DiagnosticsLog;
  private readonly now: () => string;
  private readonly newId: () => string;

  private provider: DistanceProvider | null = null;
  private snapshot: JourneySnapshot = { current: null, history: [] };
  private readonly listeners = new Set<() => void>();
  private readonly eventListeners = new Set<EventListener>();

  constructor(options: JourneyControllerOptions) {
    this.store = options.store;
    this.getPack = options.getPack;
    this.createProvider = options.createProvider;
    this.log = options.log ?? noLog;
    this.now = options.now ?? (() => new Date().toISOString());
    this.newId = options.newId ?? defaultId;
  }

  // --- observation (shaped for React's useSyncExternalStore) --------------

  getSnapshot = (): JourneySnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** Every batch of engine events, in order. Notifications hook in here. */
  onEvents(listener: EventListener): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  /** The current provider, so a dev control can change mock speed. */
  getProvider(): DistanceProvider | null {
    return this.provider;
  }

  // --- commands -----------------------------------------------------------

  /**
   * Picks up the stored journey after an app (re)start, including a start
   * caused by the background task waking a killed app. Call once.
   */
  restore(): void {
    const stored = this.store.loadActive();
    if (stored === null) return;

    const pack = this.getPack(stored.state.packId);
    if (pack === undefined) {
      this.log.log("error", `Stored journey's pack "${stored.state.packId}" is gone; discarded`);
      this.store.saveActive(null);
      return;
    }

    const current: ActiveJourney = { pack, ...stored };
    this.snapshot = { ...this.snapshot, current };
    this.log.log(
      "journey",
      `Restored ${stored.state.status} ${stored.source} journey at ${stored.state.cumulativeDistanceM.toFixed(1)} m`,
    );

    if (stored.state.status !== "completed") {
      const provider = this.attachProvider(stored.source, {
        fromM: stored.state.cumulativeDistanceM,
      });
      // A paused provider is started by resume().
      if (stored.state.status === "active") provider.start();
    }
    this.notify();
  }

  /**
   * Starts a journey. At most one journey may be active or paused at a
   * time (workplan Stage 1); a completed one is replaced.
   */
  start(pack: ContentPack, totalDistanceM: number, source: DistanceSource): void {
    const status = this.snapshot.current?.state.status;
    if (status === "active" || status === "paused") {
      throw new Error("A journey is already in progress; end it first.");
    }

    const { state, events } = startJourney(pack, totalDistanceM, {
      id: this.newId(),
      now: this.now(),
    });
    const current: ActiveJourney = {
      pack,
      state,
      source,
      latestMilestoneId: lastReached(events, null),
    };
    this.save(current);
    this.log.log("journey", `Started ${source} journey: ${pack.id}, ${totalDistanceM} m`);
    this.setCurrent(current, events);

    this.attachProvider(source, null).start();
  }

  pause(): void {
    const current = this.snapshot.current;
    if (current === null) return;
    const { state } = pauseJourney(current.state);
    if (state === current.state) return;
    const next = { ...current, state };
    this.save(next);
    this.provider?.pause();
    this.log.log("journey", "Paused");
    this.setCurrent(next, []);
  }

  resume(): void {
    const current = this.snapshot.current;
    if (current === null) return;
    const { state } = resumeJourney(current.state);
    if (state === current.state) return;
    const next = { ...current, state };
    this.save(next);
    this.provider?.resume();
    this.log.log("journey", "Resumed");
    this.setCurrent(next, []);
  }

  /**
   * Abandons an unfinished journey, or dismisses a completed one. An
   * abandoned journey is discarded, not recorded in history.
   */
  end(): void {
    this.stopProvider();
    if (this.snapshot.current === null) return;
    this.store.saveActive(null);
    this.log.log("journey", "Ended");
    this.snapshot = { ...this.snapshot, current: null };
    this.notify();
  }

  // --- internals ----------------------------------------------------------

  private attachProvider(
    source: DistanceSource,
    resume: { fromM: number } | null,
  ): DistanceProvider {
    const provider = this.createProvider(source, resume);
    this.provider = provider;
    provider.onDistance((metres) => this.handleDistance(metres));
    return provider;
  }

  /** The tick: load → advance → save → events. */
  private handleDistance(metres: number): void {
    const stored = this.store.loadActive();
    const current = this.snapshot.current;
    if (stored === null || current === null || stored.state.id !== current.state.id) return;

    const { state, events } = advance(current.pack, stored.state, metres, this.now());
    if (state === stored.state) return;

    const next: ActiveJourney = {
      pack: current.pack,
      state,
      source: stored.source,
      latestMilestoneId: lastReached(events, stored.latestMilestoneId),
    };
    this.save(next);
    this.log.log("tick", `${state.cumulativeDistanceM.toFixed(1)} m of ${state.totalDistanceM} m`);
    for (const e of events) {
      if (e.type === "MilestoneReached") this.log.log("milestone", `Reached ${e.milestoneId}`);
    }

    if (state.status === "completed") {
      this.log.log("journey", "Completed");
      this.stopProvider();
      this.snapshot = {
        current: next,
        history: [{ pack: next.pack, state }, ...this.snapshot.history],
      };
      this.emit(events, next);
      this.notify();
      return;
    }

    this.setCurrent(next, events);
  }

  private save(journey: ActiveJourney): void {
    const stored: StoredJourney = {
      state: journey.state,
      source: journey.source,
      latestMilestoneId: journey.latestMilestoneId,
    };
    this.store.saveActive(stored);
  }

  private setCurrent(current: ActiveJourney, events: JourneyEvent[]): void {
    this.snapshot = { ...this.snapshot, current };
    if (events.length > 0) this.emit(events, current);
    this.notify();
  }

  private stopProvider(): void {
    this.provider?.stop();
    this.provider = null;
  }

  /** A failing listener (say, a notification) must not break the tick. */
  private emit(events: JourneyEvent[], journey: ActiveJourney): void {
    for (const listener of this.eventListeners) {
      try {
        listener(events, journey);
      } catch (error) {
        this.log.log("error", `Event listener failed: ${String(error)}`);
      }
    }
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }
}

function lastReached(events: JourneyEvent[], fallback: string | null): string | null {
  let latest = fallback;
  for (const e of events) if (e.type === "MilestoneReached") latest = e.milestoneId;
  return latest;
}
