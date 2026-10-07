/**
 * Platform Services — layer 3 of the architecture. Distance providers and
 * the journey controller today; notifications, background execution and
 * storage arrive at Stages 4 (GPS), 5 and 7, each behind an interface.
 */

export type { DistanceListener, DistanceProvider } from "./distance/types";
export {
  MockProvider,
  steadyWalk,
  WALKING_SPEED_MPS,
  type Clock,
  type DistanceCurve,
  type MockProviderOptions,
} from "./distance/MockProvider";
export {
  JourneyController,
  type ActiveJourney,
  type EventListener,
  type HistoryEntry,
  type JourneyControllerOptions,
  type JourneySnapshot,
} from "./journey/JourneyController";
