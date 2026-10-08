/**
 * User preferences (workplan Stage 6, Settings). Plain module state, so the
 * background notification path can read them without React. In memory
 * until Stage 7 persists them.
 */

import type { DistanceSource } from "../platform";
import type { DistanceUnits } from "../ui/format";

export interface Settings {
  units: DistanceUnits;
  notificationsEnabled: boolean;
  /**
   * Development builds only: simulated walking or real GPS (ADR 0011).
   * Release builds always use GPS.
   */
  devDistanceSource: DistanceSource;
}

let settings: Settings = {
  units: "km",
  notificationsEnabled: true,
  devDistanceSource: "mock",
};
const listeners = new Set<() => void>();

export function getSettings(): Settings {
  return settings;
}

export function updateSettings(patch: Partial<Settings>): void {
  settings = { ...settings, ...patch };
  for (const listener of listeners) listener();
}

export function subscribeSettings(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The source a new journey uses. */
export function distanceSourceForNewJourney(): DistanceSource {
  return __DEV__ ? settings.devDistanceSource : "gps";
}
