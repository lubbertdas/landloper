/**
 * Storage seams (ADR 0010). The background task and the UI share state only
 * through these interfaces, so the tick never depends on a React component
 * being mounted. Synchronous on purpose: the SQLite implementation uses
 * expo-sqlite's synchronous API, which keeps load → advance → save a
 * straight line with no interleaving.
 *
 * Stage 7 extends this with history and settings; until then those stay
 * in memory.
 */

import type { JourneyState } from "../../engine";

/** Where a journey's distance comes from. Decided by the app, not the user. */
export type DistanceSource = "gps" | "mock";

/** The one active, paused or just-completed journey. */
export interface StoredJourney {
  state: JourneyState;
  source: DistanceSource;
  /** Most recently reached milestone, for the live screen's current card. */
  latestMilestoneId: string | null;
}

export interface JourneyStore {
  loadActive(): StoredJourney | null;
  /** `null` clears it. */
  saveActive(journey: StoredJourney | null): void;
}

/** Small JSON values keyed by name, e.g. the GPS tracker state. */
export interface KeyValueStore {
  get<T>(key: string): T | null;
  set(key: string, value: unknown): void;
  remove(key: string): void;
}

export type DiagnosticKind =
  | "fix"
  | "batch"
  | "tick"
  | "milestone"
  | "notification"
  | "provider"
  | "journey"
  | "error";

export interface DiagnosticEntry {
  id: number;
  /** ISO-8601. */
  at: string;
  kind: DiagnosticKind;
  message: string;
}

/**
 * What happened during a walk, readable in the app afterwards (ADR 0012).
 * Writes never throw: a failing log must not break tracking.
 */
export interface DiagnosticsLog {
  log(kind: DiagnosticKind, message: string): void;
  /** Newest first. */
  recent(limit: number): DiagnosticEntry[];
  clear(): void;
}

export class MemoryJourneyStore implements JourneyStore {
  private journey: StoredJourney | null = null;

  loadActive(): StoredJourney | null {
    return this.journey;
  }

  saveActive(journey: StoredJourney | null): void {
    // Round-trip through JSON, as the real store does, so tests catch
    // anything that would not survive persistence.
    this.journey = journey === null ? null : JSON.parse(JSON.stringify(journey));
  }
}

export class MemoryKeyValueStore implements KeyValueStore {
  private readonly values = new Map<string, string>();

  get<T>(key: string): T | null {
    const raw = this.values.get(key);
    return raw === undefined ? null : (JSON.parse(raw) as T);
  }

  set(key: string, value: unknown): void {
    this.values.set(key, JSON.stringify(value));
  }

  remove(key: string): void {
    this.values.delete(key);
  }
}

export class MemoryDiagnosticsLog implements DiagnosticsLog {
  private entries: DiagnosticEntry[] = [];
  private nextId = 1;

  constructor(private readonly now: () => string = () => new Date().toISOString()) {}

  log(kind: DiagnosticKind, message: string): void {
    this.entries.push({ id: this.nextId++, at: this.now(), kind, message });
  }

  recent(limit: number): DiagnosticEntry[] {
    return this.entries.slice(-limit).reverse();
  }

  clear(): void {
    this.entries = [];
  }
}
