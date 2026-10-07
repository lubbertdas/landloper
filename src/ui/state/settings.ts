/**
 * User preferences (workplan Stage 6, Settings). In memory until Stage 7
 * persists them.
 */

import { useSyncExternalStore } from "react";

import type { DistanceUnits } from "../format";

export interface Settings {
  units: DistanceUnits;
  /** Milestone notifications. Stored now; acted on from Stage 5. */
  notificationsEnabled: boolean;
}

let settings: Settings = { units: "km", notificationsEnabled: true };
const listeners = new Set<() => void>();

export function getSettings(): Settings {
  return settings;
}

export function updateSettings(patch: Partial<Settings>): void {
  settings = { ...settings, ...patch };
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, getSettings);
}
