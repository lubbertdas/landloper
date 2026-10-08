/**
 * React access to the app's single JourneyController and the GPS status.
 * The controller itself lives in `src/runtime/services.ts` (ADR 0010), so
 * the background task drives the same instance with no screen mounted.
 */

import { useSyncExternalStore } from "react";

import type { GpsStatus, JourneySnapshot } from "../../platform";
import { gpsHub, journeyController } from "../../runtime/services";

export { getSimulationSpeed, journeyController, setSimulationSpeed } from "../../runtime/services";

export function useJourney(): JourneySnapshot {
  return useSyncExternalStore(journeyController.subscribe, journeyController.getSnapshot);
}

export function useGpsStatus(): GpsStatus {
  return useSyncExternalStore(gpsHub.subscribeStatus, gpsHub.getStatus);
}
