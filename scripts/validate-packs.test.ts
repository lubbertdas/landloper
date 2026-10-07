import { describe, expect, it } from "vitest";

import { listPackDirs } from "./lib/packs";
import { registrySource, validatePack } from "./validate-packs";

describe("pack validator over the committed packs", () => {
  const dirs = listPackDirs();

  it("finds at least one pack", () => {
    expect(dirs.length).toBeGreaterThan(0);
  });

  for (const dir of dirs) {
    it(`passes in check mode: ${dir.split(/[\\/]/).pop()}`, () => {
      const result = validatePack(dir, { release: false, write: false });
      expect(result.errors).toEqual([]);
    });
  }

  it("generates a registry listing every pack and image", () => {
    const results = dirs.map((d) => validatePack(d, { release: false, write: false }));
    const source = registrySource(results);
    expect(source).toContain('"solar-system": {');
    expect(source).toContain('require("../../packs/solar-system/pack.json")');
    expect(source).toContain('"images/pluto.thumb.webp": require(');
  });
});
