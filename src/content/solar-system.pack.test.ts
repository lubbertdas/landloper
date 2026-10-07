/**
 * Contract test over the real committed pack.
 *
 * Its main job is the staleness guard: the `position` values committed in
 * pack.json must equal what `derivePositions` computes from the authored
 * `realValue` values. Edit a realValue without re-deriving and this fails,
 * which is what makes it safe to keep derived data in the authored file.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { assertPackInvariants, derivePositions } from "./positions";
import type { AuthoredContentPack } from "./types";

const packUrl = new URL("../../packs/solar-system/pack.json", import.meta.url);
const pack = JSON.parse(readFileSync(packUrl, "utf8")) as AuthoredContentPack;

describe("solar-system pack", () => {
  it("declares schema version 1 and the only legal scaling model", () => {
    expect(pack.schemaVersion).toBe(1);
    expect(pack.scalingModel).toBe("fit-to-distance");
    expect(pack.id).toBe("solar-system");
  });

  it("satisfies the cross-field pack invariants", () => {
    expect(() => assertPackInvariants(pack)).not.toThrow();
  });

  it("has committed positions matching the derived values", () => {
    const committed = pack.milestones.map((m) => ({
      id: m.id,
      position: (m as { position?: number }).position,
    }));
    const derived = derivePositions(pack).milestones.map((m) => ({
      id: m.id,
      position: m.position,
    }));
    expect(committed).toEqual(derived);
  });

  it("runs from position 0 to position 1", () => {
    const positions = derivePositions(pack).milestones.map((m) => m.position);
    expect(positions.at(0)).toBe(0);
    expect(positions.at(-1)).toBe(1);
  });

  it("has strictly increasing positions, so no two milestones coincide", () => {
    const positions = derivePositions(pack).milestones.map((m) => m.position);
    const sortedUnique = [...new Set(positions)].sort((a, b) => a - b);
    expect(positions).toEqual(sortedUnique);
  });

  it("gives every milestone an image and authored notification copy", () => {
    for (const m of pack.milestones) {
      expect(m.mediaRefs.length, `${m.id} has no image`).toBeGreaterThan(0);
      expect(m.notification.title.length, `${m.id} title`).toBeGreaterThan(0);
      expect(m.notification.body.length, `${m.id} body`).toBeGreaterThan(0);
    }
  });

  it("offers at least one suggested journey distance, in metres", () => {
    expect(pack.suggestedDistancesM.length).toBeGreaterThan(0);
    for (const d of pack.suggestedDistancesM) {
      expect(Number.isInteger(d)).toBe(true);
      expect(d).toBeGreaterThan(0);
    }
  });
});
