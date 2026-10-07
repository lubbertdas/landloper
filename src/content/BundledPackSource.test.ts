import { describe, expect, it } from "vitest";

import { BundledPackSource, PackNotFoundError, type BundledRegistry } from "./BundledPackSource";

function packJson(id: string, title: string, withPositions = true) {
  return {
    schemaVersion: 1,
    id,
    title,
    description: `${title} description`,
    domainType: "test",
    locale: "en",
    version: "1.0.0",
    coverImage: "images/cover.webp",
    scalingModel: "fit-to-distance",
    realUnitLabel: "km",
    suggestedDistancesM: [2000],
    media: [{ ref: "images/cover.webp", type: "image", width: 10, height: 10, bytes: 5 }],
    milestones: [
      { id: "a", realValue: 0, ...(withPositions ? { position: 0 } : {}), title: "A", body: "A",
        mediaRefs: [], notification: { title: "A", body: "A" } },
    ],
  };
}

const registry: BundledRegistry = {
  zeta: { pack: packJson("zeta", "Zeta walk"), media: { "images/cover.webp": 101 } },
  alpha: { pack: packJson("alpha", "Alpha walk"), media: { "images/cover.webp": 202 } },
  broken: { pack: packJson("broken", "Broken", false), media: {} },
};

describe("BundledPackSource", () => {
  const source = new BundledPackSource({ zeta: registry.zeta!, alpha: registry.alpha! });

  it("lists packs as summaries, sorted by title", async () => {
    const list = await source.listPacks();
    expect(list.map((p) => p.id)).toEqual(["alpha", "zeta"]);
    expect(list[0]).toEqual({
      id: "alpha",
      title: "Alpha walk",
      description: "Alpha walk description",
      domainType: "test",
      version: "1.0.0",
      coverImage: "images/cover.webp",
      suggestedDistancesM: [2000],
      milestoneCount: 1,
    });
  });

  it("loads a full pack", async () => {
    const pack = await source.loadPack("zeta");
    expect(pack.milestones[0]?.position).toBe(0);
  });

  it("resolves media to the bundled module", () => {
    expect(source.resolveMedia("alpha", "images/cover.webp")).toBe(202);
  });

  it("throws PackNotFoundError for unknown packs and refs", async () => {
    await expect(source.loadPack("nope")).rejects.toBeInstanceOf(PackNotFoundError);
    expect(() => source.resolveMedia("nope", "x")).toThrow(PackNotFoundError);
    expect(() => source.resolveMedia("alpha", "images/none.webp")).toThrow(PackNotFoundError);
  });

  it("refuses a pack whose derived fields are missing", () => {
    const bad = new BundledPackSource({ broken: registry.broken! });
    expect(() => bad.loadPackSync("broken")).toThrow(/no position/);
  });
});
