/**
 * MockProvider — replays a distance curve at an accelerated rate, so the
 * whole app can be demonstrated and tested at a desk (workplan Stage 4).
 *
 * Pure TypeScript: the timer is injected, so tests drive it with fake
 * timers and the app uses `setInterval`.
 */

import type { DistanceListener, DistanceProvider } from "./types";

/** Metres walked after `seconds` of simulated walking. */
export type DistanceCurve = (seconds: number) => number;

/** An average walking pace, ~5 km/h. */
export const WALKING_SPEED_MPS = 1.4;

/** Constant-speed walking. */
export function steadyWalk(speedMps: number = WALKING_SPEED_MPS): DistanceCurve {
  return (seconds) => seconds * speedMps;
}

export interface Clock {
  setInterval(callback: () => void, ms: number): unknown;
  clearInterval(handle: unknown): void;
}

const realClock: Clock = {
  setInterval: (callback, ms) => setInterval(callback, ms),
  clearInterval: (handle) => clearInterval(handle as ReturnType<typeof setInterval>),
};

export interface MockProviderOptions {
  curve?: DistanceCurve;
  /** Simulated seconds per real second. 1 = real time. */
  timeScale?: number;
  /** Real milliseconds between distance updates. */
  tickMs?: number;
  clock?: Clock;
}

export class MockProvider implements DistanceProvider {
  private readonly curve: DistanceCurve;
  private readonly tickMs: number;
  private readonly clock: Clock;
  private timeScale: number;

  private listeners = new Set<DistanceListener>();
  private handle: unknown = null;
  /** Simulated seconds of walking so far; frozen while paused. */
  private simSeconds = 0;
  private lastEmitted = 0;
  private stopped = false;

  constructor(options: MockProviderOptions = {}) {
    this.curve = options.curve ?? steadyWalk();
    this.timeScale = options.timeScale ?? 1;
    this.tickMs = options.tickMs ?? 250;
    this.clock = options.clock ?? realClock;
  }

  start(): void {
    if (this.stopped || this.handle !== null) return;
    this.simSeconds = 0;
    this.lastEmitted = 0;
    this.run();
  }

  stop(): void {
    this.halt();
    this.stopped = true;
    this.listeners.clear();
  }

  pause(): void {
    this.halt();
  }

  resume(): void {
    if (this.stopped || this.handle !== null) return;
    this.run();
  }

  /** Change simulation speed mid-walk. Takes effect on the next tick. */
  setTimeScale(timeScale: number): void {
    this.timeScale = timeScale;
  }

  getTimeScale(): number {
    return this.timeScale;
  }

  onDistance(listener: DistanceListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private run(): void {
    this.handle = this.clock.setInterval(() => this.tick(), this.tickMs);
  }

  private halt(): void {
    if (this.handle === null) return;
    this.clock.clearInterval(this.handle);
    this.handle = null;
  }

  private tick(): void {
    this.simSeconds += (this.tickMs / 1000) * this.timeScale;
    // The contract is monotonic, whatever shape the curve has.
    const metres = Math.max(this.lastEmitted, this.curve(this.simSeconds));
    this.lastEmitted = metres;
    for (const listener of this.listeners) listener(metres);
  }
}
