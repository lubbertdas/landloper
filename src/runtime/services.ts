/**
 * The composition root (ADR 0010): the app's single database, journey
 * controller, GPS hub and notification wiring, created at module scope.
 *
 * Both the UI and the background location task import this module. When
 * the OS wakes a killed app to deliver fixes, importing it restores the
 * stored journey and reattaches its provider before the task runs, so the
 * tick needs no screen to be mounted.
 */

import { BundledPackSource, type ContentPack } from "../content";
import { bundledRegistry } from "../content/bundled.generated";
import {
  connectNotifications,
  GpsHub,
  GpsProvider,
  JourneyController,
  MockProvider,
  type DistanceSource,
} from "../platform";
import { theme } from "../ui/theme";
import { ExpoLocationUpdates, type ForegroundServiceText } from "./location";
import { configureNotificationHandling, ExpoNotifier } from "./notifications";
import { getSettings } from "./settings";
import {
  openLandloperDatabase,
  SqliteDiagnosticsLog,
  SqliteJourneyStore,
  SqliteKeyValueStore,
} from "./storage";

export const packSource = new BundledPackSource(bundledRegistry);

const db = openLandloperDatabase();
export const kv = new SqliteKeyValueStore(db);
export const diagnostics = new SqliteDiagnosticsLog(db);
export const gpsHub = new GpsHub();

/** Mock speed: simulated seconds per real second (development only). */
let simulationSpeed = 20;

function getPack(id: string): ContentPack | undefined {
  try {
    return packSource.loadPackSync(id);
  } catch {
    return undefined;
  }
}

// The persistent notification Android shows while GPS runs. Its words are
// presentation; restyle them here (colour comes from the theme).
function foregroundServiceText(): ForegroundServiceText {
  const pack = journeyController.getSnapshot().current?.pack;
  return {
    title: pack === undefined ? "Landloper" : `Walking: ${pack.title}`,
    body: "Measuring your walk with GPS. Tap to open.",
  };
}

const locationUpdates = new ExpoLocationUpdates(foregroundServiceText, theme.colors.accent);

function createProvider(source: DistanceSource, resume: { fromM: number } | null) {
  if (source === "mock") {
    return new MockProvider({ timeScale: simulationSpeed, startAtM: resume?.fromM ?? 0 });
  }
  return new GpsProvider({
    kv,
    log: diagnostics,
    hub: gpsHub,
    updates: locationUpdates,
    attach: resume !== null,
  });
}

export const journeyController = new JourneyController({
  store: new SqliteJourneyStore(kv),
  getPack,
  createProvider,
  log: diagnostics,
});

configureNotificationHandling();
connectNotifications(journeyController, new ExpoNotifier(), {
  isEnabled: () => getSettings().notificationsEnabled,
  log: diagnostics,
});

journeyController.restore();

export function getSimulationSpeed(): number {
  return simulationSpeed;
}

/** Applies to the running mock walk immediately, and to later ones. */
export function setSimulationSpeed(speed: number): void {
  simulationSpeed = speed;
  const provider = journeyController.getProvider();
  if (provider instanceof MockProvider) provider.setTimeScale(speed);
}
