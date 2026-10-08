/**
 * The background location task (workplan Stage 4, "Who owns the tick").
 *
 * Must be defined at module scope during app start, before anything else
 * renders, so the OS can deliver fixes to it even when it launches the app
 * headless. The root `index.ts` imports this file first.
 *
 * task wakes → recordFixes (load tracker, filter, save) → hub → controller
 * (load journey, advance, save) → notifications.
 */

import type { LocationObject } from "expo-location";
import * as TaskManager from "expo-task-manager";

import { recordFixes } from "../platform";
import { LOCATION_TASK } from "./location";
import { diagnostics, gpsHub, kv } from "./services";

TaskManager.defineTask<{ locations: LocationObject[] }>(LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    diagnostics.log("error", `Location task error: ${error.message}`);
    return;
  }
  try {
    const fixes = (data?.locations ?? []).map((l) => ({
      latitude: l.coords.latitude,
      longitude: l.coords.longitude,
      accuracy: l.coords.accuracy,
      timestamp: l.timestamp,
    }));
    recordFixes({ kv, log: diagnostics, hub: gpsHub }, fixes);
  } catch (e) {
    diagnostics.log("error", `Location task failed: ${String(e)}`);
  }
});
