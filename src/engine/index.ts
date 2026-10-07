/**
 * The Stage 3 journey engine — layer 2 of the architecture.
 *
 * Pure TypeScript over numbers. Zero React Native imports; runs and tests
 * under plain Node. Depends on `src/content` for types only.
 */

export {
  advance,
  JourneyError,
  pause,
  resume,
  startJourney,
  type StartOptions,
} from "./journey";

export type {
  JourneyCompleted,
  JourneyEvent,
  JourneyPack,
  JourneyProgress,
  JourneyResult,
  JourneyState,
  JourneyStatus,
  MilestoneReached,
} from "./types";
