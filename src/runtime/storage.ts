/**
 * SQLite-backed implementations of the platform storage seams (ADR 0010).
 *
 * One database file, opened synchronously so the background task can load,
 * advance and save in a straight line. Stage 7 adds history and settings
 * tables through the same migration list.
 */

import { openDatabaseSync, type SQLiteDatabase } from "expo-sqlite";

import type {
  DiagnosticEntry,
  DiagnosticKind,
  DiagnosticsLog,
  JourneyStore,
  KeyValueStore,
  StoredJourney,
} from "../platform";

/** Applied in order; `PRAGMA user_version` records how many have run. */
const MIGRATIONS = [
  `CREATE TABLE kv (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
   CREATE TABLE diagnostics (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     at TEXT NOT NULL,
     kind TEXT NOT NULL,
     message TEXT NOT NULL
   );`,
];

export function openLandloperDatabase(): SQLiteDatabase {
  const db = openDatabaseSync("landloper.db");
  db.execSync("PRAGMA journal_mode = WAL;");
  const row = db.getFirstSync<{ user_version: number }>("PRAGMA user_version");
  const version = row?.user_version ?? 0;
  for (let i = version; i < MIGRATIONS.length; i++) {
    db.withTransactionSync(() => {
      db.execSync(MIGRATIONS[i]!);
      db.execSync(`PRAGMA user_version = ${i + 1}`);
    });
  }
  return db;
}

export class SqliteKeyValueStore implements KeyValueStore {
  constructor(private readonly db: SQLiteDatabase) {}

  get<T>(key: string): T | null {
    const row = this.db.getFirstSync<{ value: string }>("SELECT value FROM kv WHERE key = ?", key);
    return row === null ? null : (JSON.parse(row.value) as T);
  }

  set(key: string, value: unknown): void {
    this.db.runSync(
      "INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      key,
      JSON.stringify(value),
    );
  }

  remove(key: string): void {
    this.db.runSync("DELETE FROM kv WHERE key = ?", key);
  }
}

const ACTIVE_JOURNEY_KEY = "journey.active";

export class SqliteJourneyStore implements JourneyStore {
  constructor(private readonly kv: KeyValueStore) {}

  loadActive(): StoredJourney | null {
    return this.kv.get<StoredJourney>(ACTIVE_JOURNEY_KEY);
  }

  saveActive(journey: StoredJourney | null): void {
    if (journey === null) this.kv.remove(ACTIVE_JOURNEY_KEY);
    else this.kv.set(ACTIVE_JOURNEY_KEY, journey);
  }
}

/** Keeps the newest entries only; a long walk logs a few thousand. */
const MAX_ENTRIES = 5000;
const PRUNE_EVERY = 200;

export class SqliteDiagnosticsLog implements DiagnosticsLog {
  private sincePrune = 0;

  constructor(private readonly db: SQLiteDatabase) {}

  log(kind: DiagnosticKind, message: string): void {
    // Also to the console, so `adb logcat` shows it during development.
    console.log(`[landloper:${kind}] ${message}`);
    try {
      this.db.runSync(
        "INSERT INTO diagnostics (at, kind, message) VALUES (?, ?, ?)",
        new Date().toISOString(),
        kind,
        message,
      );
      if (++this.sincePrune >= PRUNE_EVERY) {
        this.sincePrune = 0;
        this.db.runSync(
          "DELETE FROM diagnostics WHERE id <= (SELECT MAX(id) FROM diagnostics) - ?",
          MAX_ENTRIES,
        );
      }
    } catch (error) {
      console.warn(`Diagnostics log write failed: ${String(error)}`);
    }
  }

  recent(limit: number): DiagnosticEntry[] {
    return this.db.getAllSync<DiagnosticEntry>(
      "SELECT id, at, kind, message FROM diagnostics ORDER BY id DESC LIMIT ?",
      limit,
    );
  }

  clear(): void {
    this.db.runSync("DELETE FROM diagnostics");
  }
}
