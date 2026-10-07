/**
 * Shared helpers for the pack tooling scripts (Node only, never bundled).
 */

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { AuthoredContentPack } from "../../src/content";

export const REPO_ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)));
export const PACKS_DIR = join(REPO_ROOT, "packs");

/** Attribution prefix marking a generated placeholder image. */
export const PLACEHOLDER_ATTRIBUTION = "PLACEHOLDER";

/** Workplan Stage 2a budgets. */
export const PACK_BUDGET_BYTES = 8 * 1024 * 1024;
export const TOTAL_BUDGET_BYTES = 40 * 1024 * 1024;

/** Every folder under packs/ that contains a pack.json, sorted by name. */
export function listPackDirs(): string[] {
  if (!existsSync(PACKS_DIR)) return [];
  return readdirSync(PACKS_DIR)
    .map((name) => join(PACKS_DIR, name))
    .filter((dir) => existsSync(join(dir, "pack.json")))
    .sort();
}

export function readPack(packDir: string): AuthoredContentPack {
  return JSON.parse(readFileSync(join(packDir, "pack.json"), "utf8")) as AuthoredContentPack;
}

/** Writes pack.json in the committed format: 2-space JSON, LF, trailing newline. */
export function writePack(packDir: string, pack: unknown): void {
  writeFileSync(join(packDir, "pack.json"), JSON.stringify(pack, null, 2) + "\n", "utf8");
}

/**
 * Source-image folder for a pack. Originals (downloads, or generated
 * placeholders) live here so the media pipeline can always be re-run.
 * Never bundled: the app only references the generated images/.
 */
export function sourceDir(packDir: string): string {
  return join(packDir, "source");
}

const SOURCE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".tif", ".tiff"];

/** The source file for a media ref: same base name, any image extension. */
export function findSource(packDir: string, ref: string): string | null {
  const stem = basename(ref, extname(ref));
  for (const ext of SOURCE_EXTENSIONS) {
    const candidate = join(sourceDir(packDir), stem + ext);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

/** Total bytes of every file under a directory, recursively. */
export function directoryBytes(dir: string): number {
  if (!existsSync(dir)) return 0;
  let total = 0;
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const stat = statSync(path);
    total += stat.isDirectory() ? directoryBytes(path) : stat.size;
  }
  return total;
}

export function isPlaceholder(attribution: string | undefined): boolean {
  return attribution?.startsWith(PLACEHOLDER_ATTRIBUTION) ?? false;
}
