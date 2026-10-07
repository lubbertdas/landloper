/**
 * Pack validator (workplan Stage 2a). A pack that fails cannot ship.
 *
 *   npm run validate              check every pack; write derived positions
 *   npm run validate -- --release also reject placeholder or missing credits
 *
 * Checks: JSON Schema, cross-field invariants, derived positions, that every
 * referenced file exists, that media dimensions are present and current,
 * image credits, and the size budgets. On success it regenerates
 * src/content/bundled.generated.ts, the list of packs the app bundles.
 */

import Ajv2020 from "ajv/dist/2020.js";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, join, relative } from "node:path";

import {
  assertPackInvariants,
  derivePositions,
  type AuthoredContentPack,
  type AuthoredMilestone,
} from "../src/content";
import {
  directoryBytes,
  isPlaceholder,
  listPackDirs,
  PACK_BUDGET_BYTES,
  readPack,
  REPO_ROOT,
  TOTAL_BUDGET_BYTES,
  writePack,
} from "./lib/packs";

export interface ValidationResult {
  packId: string;
  packDir: string;
  errors: string[];
  warnings: string[];
  /** True when positions were rewritten (only with `write`). */
  rewrote: boolean;
  bytes: number;
  pack: AuthoredContentPack;
}

export interface ValidateOptions {
  release: boolean;
  write: boolean;
}

const schema = JSON.parse(
  readFileSync(join(REPO_ROOT, "src/content/pack.schema.json"), "utf8"),
) as object;
const ajv = new Ajv2020({ allErrors: true, strict: true });
const validateSchema = ajv.compile(schema);

/** Copies a milestone with `position` placed right after `realValue`. */
function withPosition(m: AuthoredMilestone, position: number): AuthoredMilestone {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(m)) {
    if (key === "position") continue;
    out[key] = value;
    if (key === "realValue") out.position = position;
  }
  return out as unknown as AuthoredMilestone;
}

export function validatePack(packDir: string, options: ValidateOptions): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let pack = readPack(packDir);
  let rewrote = false;
  const result = (): ValidationResult => ({
    packId: pack.id ?? basename(packDir),
    packDir,
    errors,
    warnings,
    rewrote,
    bytes: directoryBytes(join(packDir, "images")),
    pack,
  });

  // 1. Shape.
  if (!validateSchema(pack)) {
    for (const e of validateSchema.errors ?? []) {
      errors.push(`schema: ${e.instancePath || "/"} ${e.message ?? ""}`.trim());
    }
    return result();
  }
  if (pack.id !== basename(packDir)) {
    errors.push(`pack id "${pack.id}" must match its folder name "${basename(packDir)}".`);
  }

  // 2. Cross-field invariants.
  try {
    assertPackInvariants(pack);
  } catch (error) {
    errors.push((error as Error).message);
    return result();
  }

  // 3. Derived positions.
  const derived = derivePositions(pack).milestones;
  const stale = pack.milestones.filter(
    (m, i) => (m as { position?: number }).position !== derived[i]?.position,
  );
  if (stale.length > 0) {
    if (options.write) {
      pack = {
        ...pack,
        milestones: pack.milestones.map((m, i) => withPosition(m, derived[i]!.position)),
      };
      writePack(packDir, pack);
      rewrote = true;
    } else {
      errors.push(`positions are stale for: ${stale.map((m) => m.id).join(", ")}.`);
    }
  }

  // 4–6. Media files, dimensions, credits.
  for (const asset of pack.media) {
    if (asset.type !== "image") {
      errors.push(`media "${asset.ref}": type "${asset.type}" is reserved and unused in v1.`);
      continue;
    }
    for (const ref of [asset.ref, asset.thumbnailRef]) {
      if (ref !== undefined && !existsSync(join(packDir, ref))) {
        errors.push(`media file missing: ${ref} (run \`npm run media\`).`);
      }
    }
    if (asset.width === undefined || asset.height === undefined || asset.bytes === undefined) {
      errors.push(`media "${asset.ref}" has no width/height/bytes (run \`npm run media\`).`);
    } else if (existsSync(join(packDir, asset.ref)) &&
               statSync(join(packDir, asset.ref)).size !== asset.bytes) {
      errors.push(`media "${asset.ref}" bytes are stale (run \`npm run media\`).`);
    }

    const credit = asset.attribution;
    if (credit === undefined || credit.trim() === "") {
      (options.release ? errors : warnings).push(`media "${asset.ref}" has no attribution.`);
    } else if (isPlaceholder(credit)) {
      (options.release ? errors : warnings).push(`media "${asset.ref}" is a placeholder.`);
    }
  }

  // 7. Per-pack budget.
  const bytes = directoryBytes(join(packDir, "images"));
  if (bytes > PACK_BUDGET_BYTES) {
    errors.push(`images total ${mb(bytes)}, over the ${mb(PACK_BUDGET_BYTES)} per-pack budget.`);
  }

  return result();
}

function mb(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

/** Source of src/content/bundled.generated.ts for the given packs. */
export function registrySource(results: ValidationResult[]): string {
  const outDir = join(REPO_ROOT, "src/content");
  const rel = (path: string) => relative(outDir, path).replace(/\\/g, "/");
  const lines = [
    "// GENERATED by scripts/validate-packs.ts — do not edit. Run `npm run validate`.",
    "//",
    "// Metro only bundles files reached by a literal require(), so every pack",
    "// and image the app ships is listed here.",
    "",
    'import type { BundledRegistry } from "./BundledPackSource";',
    "",
    "export const bundledRegistry: BundledRegistry = {",
  ];
  for (const r of results) {
    lines.push(`  ${JSON.stringify(r.pack.id)}: {`);
    lines.push(`    pack: require(${JSON.stringify(rel(join(r.packDir, "pack.json")))}),`);
    lines.push("    media: {");
    const refs = r.pack.media.flatMap((a) =>
      a.thumbnailRef === undefined ? [a.ref] : [a.ref, a.thumbnailRef],
    );
    for (const ref of refs) {
      lines.push(
        `      ${JSON.stringify(ref)}: require(${JSON.stringify(rel(join(r.packDir, ref)))}),`,
      );
    }
    lines.push("    },");
    lines.push("  },");
  }
  lines.push("};", "");
  return lines.join("\n");
}

function main(): void {
  const options: ValidateOptions = {
    release: process.argv.includes("--release"),
    write: !process.argv.includes("--check"),
  };

  const results = listPackDirs().map((dir) => validatePack(dir, options));
  let failed = false;

  for (const r of results) {
    const status = r.errors.length > 0 ? "FAIL" : "ok";
    console.log(`${status}  ${r.packId}  (${mb(r.bytes)})${r.rewrote ? "  positions written" : ""}`);
    for (const e of r.errors) console.log(`  error    ${e}`);
    for (const w of r.warnings) console.log(`  warning  ${w}`);
    if (r.errors.length > 0) failed = true;
  }

  const total = results.reduce((sum, r) => sum + r.bytes, 0);
  console.log(`total bundled images: ${mb(total)} of ${mb(TOTAL_BUDGET_BYTES)}`);
  if (total > TOTAL_BUDGET_BYTES) {
    console.log("  error    over the bundled total budget — time for Stage 2b.");
    failed = true;
  }

  if (failed) {
    console.log("\nValidation failed; registry not regenerated.");
    process.exit(1);
  }

  const out = join(REPO_ROOT, "src/content/bundled.generated.ts");
  writeFileSync(out, registrySource(results), "utf8");
  console.log(`\nwrote ${relative(REPO_ROOT, out)}`);
}

if (process.argv[1] !== undefined && import.meta.url.endsWith(basename(process.argv[1]))) {
  main();
}
