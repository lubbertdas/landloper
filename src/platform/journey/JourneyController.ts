/**
 * The thin stateful shell around the pure engine (workplan Stage 3/4).
 *
 * Owns the one current journey, wires a DistanceProvider into `advance()`,
 * and lets the UI (and, at Stage 5, notifications) observe state and events.
 * "Subscribing to the engine" anywhere in the workplan means subscribing
 * here.
 *
 * In-memory only until Stage 7: a journey does not survive an app restart,
 * and history lasts for the session.
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

export interface ActiveJourney {
  pack: ContentPack;
  state: JourneyState;
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

export interface JourneyControllerOptions {
  createProvider: () => DistanceProvider;
  now?: () => string;
  newId?: () => string;
}

export type EventListener = (events: JourneyEvent[], journey: ActiveJourney) => void;

let idCounter = 0;
function defaultId(): string {
  idCounter += 1;
  return `journey-${Date.now().toString(36)}-${idCounter}`;
}

export class JourneyController {
  private readonly createProvider: () => DistanceProvider;
  private readonly now: () => string;
  private readonly newId: () => string;

  private provider: DistanceProvider | null = null;
  private snapshot: JourneySnapshot = { current: null, history: [] };
  private readonly listeners = new Set<() => void>();
  private readonly eventListeners = new Set<EventListener>();

  constructor(options: JourneyControllerOptions) {
    this.createProvider = options.createProvider;
    this.now = options.now ?? (() => new Date().toISOString());
    this.newId = options.newId ?? defaultId;
  }

  // --- observation (shaped for React's useSyncExternalStore) --------------

  getSnapshot = (): JourneySnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** Every batch of engine events, in order. Stage 5 hooks notifications here. */
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
   * Starts a journey. At most one journey may be active or paused at a
   * time (workplan Stage 1); a completed one is replaced.
   */
  start(pack: ContentPack, totalDistanceM: number): void {
    const status = this.snapshot.current?.state.status;
    if (status === "active" || status === "paused") {
      throw new Error("A journey is already in progress; end it first.");
    }

    const { state, events } = startJourney(pack, totalDistanceM, {
      id: this.newId(),
      now: this.now(),
    });
    this.setCurrent({ pack, state, latestMilestoneId: lastReached(events, null) }, events);

    const provider = this.createProvider();
    this.provider = provider;
    provider.onDistance((metres) => this.handleDistance(metres));
    provider.start();
  }

  pause(): void {
    const current = this.snapshot.current;
    if (current === null) return;
    const { state } = pauseJourney(current.state);
    if (state === current.state) return;
    this.provider?.pause();
    this.setCurrent({ ...current, state }, []);
  }

  resume(): void {
    const current = this.snapshot.current;
    if (current === null) return;
    const { state } = resumeJourney(current.state);
    if (state === current.state) return;
    this.provider?.resume();
    this.setCurrent({ ...current, state }, []);
  }

  /**
   * Abandons an unfinished journey, or dismisses a completed one. An
   * abandoned journey is discarded, not recorded in history.
   */
  end(): void {
    this.stopProvider();
    if (this.snapshot.current === null) return;
    this.snapshot = { ...this.snapshot, current: null };
    this.notify();
  }

  // --- internals ----------------------------------------------------------

  private handleDistance(metres: number): void {
    const current = this.snapshot.current;
    if (current === null) return;

    const { state, events } = advance(current.pack, current.state, metres, this.now());
    if (state === current.state) return;

    const next: ActiveJourney = {
      ...current,
      state,
      latestMilestoneId: lastReached(events, current.latestMilestoneId),
    };

    if (state.status === "completed") {
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

  private setCurrent(current: ActiveJourney, events: JourneyEvent[]): void {
    this.snapshot = { ...this.snapshot, current };
    if (events.length > 0) this.emit(events, current);
    this.notify();
  }

  private stopProvider(): void {
    this.provider?.stop();
    this.provider = null;
  }

  private emit(events: JourneyEvent[], journey: ActiveJourney): void {
    for (const listener of this.eventListeners) listener(events, journey);
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
