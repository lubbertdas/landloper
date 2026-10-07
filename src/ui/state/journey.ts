/**
 * The app's single JourneyController, plus React hooks to observe it.
 *
 * Distance comes from MockProvider until Stage 4 (GPS). `simulationSpeed`
 * is how many times faster than real walking the mock runs.
 */

import { useSyncExternalStore } from "react";

import {
  JourneyController,
  MockProvider,
  type JourneySnapshot,
} from "../../platform";

let simulationSpeed = 20;

export const journeyController = new JourneyController({
  createProvider: () => new MockProvider({ timeScale: simulationSpeed }),
});

export function useJourney(): JourneySnapshot {
  return useSyncExternalStore(journeyController.subscribe, journeyController.getSnapshot);
}

export function getSimulationSpeed(): number {
  return simulationSpeed;
}

/** Applies to the running mock walk immediately, and to later ones. */
export function setSimulationSpeed(speed: number): void {
  simulationSpeed = speed;
  const provider = journeyController.getProvider();
  if (provider instanceof MockProvider) provider.setTimeScale(speed);
}
