/**
 * The app's PackSource. Bundled packs only in v1 (workplan Stage 2a);
 * Stage 2b swaps in a RemotePackSource here and nothing else changes.
 */

import { BundledPackSource } from "../../content";
import { bundledRegistry } from "../../content/bundled.generated";

export const packSource = new BundledPackSource(bundledRegistry);
