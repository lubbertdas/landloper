/**
 * React access to user preferences. The store itself lives in
 * `src/runtime/settings.ts` so the background path can read it too.
 */

import { useSyncExternalStore } from "react";

import { getSettings, subscribeSettings, type Settings } from "../../runtime/settings";

export { getSettings, updateSettings, type Settings } from "../../runtime/settings";

export function useSettings(): Settings {
  return useSyncExternalStore(subscribeSettings, getSettings);
}
