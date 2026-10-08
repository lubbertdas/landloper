/**
 * Platform Services — layer 3 of the architecture. Distance providers, the
 * journey controller, storage seams and notification rules. Plain
 * TypeScript; the expo-backed implementations live in `src/runtime/`
 * (ADR 0010).
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
  type ProviderFactory,
} from "./journey/JourneyController";
export {
  MemoryDiagnosticsLog,
  MemoryJourneyStore,
  MemoryKeyValueStore,
  type DiagnosticEntry,
  type DiagnosticKind,
  type DiagnosticsLog,
  type DistanceSource,
  type JourneyStore,
  type KeyValueStore,
  type StoredJourney,
} from "./storage/types";
export {
  DEFAULT_GPS_FILTER,
  haversineM,
  initialTrackerState,
  processFixes,
  type FixDecision,
  type FixOutcome,
  type GpsFilterOptions,
  type GpsFix,
  type GpsTrackerState,
} from "./gps/GpsTracker";
export {
  GpsHub,
  GpsProvider,
  recordFixes,
  TRACKER_KEY,
  type GpsProviderOptions,
  type GpsStatus,
  type LocationUpdates,
} from "./gps/GpsProvider";
export {
  connectNotifications,
  milestoneNotifications,
  type MilestoneNotification,
  type Notifier,
} from "./notifications/milestoneNotifications";
