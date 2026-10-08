/**
 * expo-location behind the platform's `LocationUpdates` seam, and the
 * permission requests that must come before it (ADR 0011).
 */

import * as Location from "expo-location";

import type { LocationUpdates } from "../platform";

/** The background task that receives fixes; defined in locationTask.ts. */
export const LOCATION_TASK = "landloper-location";

export interface ForegroundServiceText {
  title: string;
  body: string;
}

export class ExpoLocationUpdates implements LocationUpdates {
  constructor(
    private readonly serviceText: () => ForegroundServiceText,
    private readonly serviceColor: string,
  ) {}

  async start(): Promise<void> {
    const text = this.serviceText();
    await Location.startLocationUpdatesAsync(LOCATION_TASK, {
      accuracy: Location.Accuracy.High,
      distanceInterval: 10,
      timeInterval: 5000,
      foregroundService: {
        notificationTitle: text.title,
        notificationBody: text.body,
        notificationColor: this.serviceColor,
        killServiceOnDestroy: false,
      },
    });
  }

  async stop(): Promise<void> {
    if (await this.isRunning()) await Location.stopLocationUpdatesAsync(LOCATION_TASK);
  }

  isRunning(): Promise<boolean> {
    return Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);
  }
}

export type LocationPermission =
  | { granted: true }
  | { granted: false; step: "services" | "foreground" | "background"; canAskAgain: boolean };

/**
 * Asks for location "while in use" and then, as a separate second prompt,
 * "all the time" (Android 10+). On Android 11+ the second prompt is the
 * app's system settings page, where the user picks "Allow all the time".
 */
export async function requestLocationPermissions(): Promise<LocationPermission> {
  if (!(await Location.hasServicesEnabledAsync())) {
    return { granted: false, step: "services", canAskAgain: true };
  }
  const fg = await Location.requestForegroundPermissionsAsync();
  if (!fg.granted) return { granted: false, step: "foreground", canAskAgain: fg.canAskAgain };
  const bg = await Location.requestBackgroundPermissionsAsync();
  if (!bg.granted) return { granted: false, step: "background", canAskAgain: bg.canAskAgain };
  return { granted: true };
}
