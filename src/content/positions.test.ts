import { describe, expect, it } from "vitest";

import { assertPackInvariants, derivePositions } from "./positions";
import type { AuthoredContentPack, AuthoredMilestone } from "./types";

/** A milestone with the boilerplate filled in, so tests show only intent. */
function milestone(
  id: string,
  realValue: number,
  mediaRefs: string[] = [],
): AuthoredMilestone {
  return {
    id,
    realValue,
    title: id,
    body: `Body for ${id}.`,
    mediaRefs,
    notification: { title: id, body: `Reached ${id}.` },
  };
}

function pack(
  milestones: AuthoredMilestone[],
  overrides: Partial<AuthoredContentPack> = {},
): AuthoredContentPack {
  return {
    schemaVersion: 1,
    id: "test-pack",
    title: "Test pack",
    description: "Fixture.",
    domainType: "test",
    locale: "en",
    version: "1.0.0",
    coverImage: "images/cover.webp",
    scalingModel: "fit-to-distance",
    realUnitLabel: "km",
    suggestedDistancesM: [2000],
    media: [{ ref: "images/cover.webp", type: "image" }],
    milestones,
    ...overrides,
  };
}

function positionsOf(authored: AuthoredContentPack): number[] {
  return derivePositions(authored).milestones.map((m) => m.position);
}

describe("derivePositions", () => {
  it("maps the first milestone to 0 and the last to 1", () => {
    const result = positionsOf(
      pack([milestone("a", 0), milestone("b", 50), milestone("c", 100)]),
    );
    expect(result).toEqual([0, 0.5, 1]);
  });

  it("is unaffected by where the scale starts", () => {
    // A timeline pack might run from −13.8 billion years to 0.
    const result = positionsOf(
      pack([milestone("a", -100), milestone("b", -50), milestone("c", 0)]),
    );
    expect(result).toEqual([0, 0.5, 1]);
  });

  it("spaces milestones unevenly when the real values are uneven", () => {
    const result = positionsOf(
      pack([milestone("a", 0), milestone("b", 10), milestone("c", 1000)]),
    );
    expect(result).toEqual([0, 0.01, 1]);
  });

  it("gives a single milestone position 0", () => {
    expect(positionsOf(pack([milestone("only", 42)]))).toEqual([0]);
  });

  it("gives every milestone position 0 in a zero-span pack", () => {
    // Workplan Stage 1: "If realValue_first == realValue_last, all
    // positions are 0.0." The engine then fires them all at start.
    const result = positionsOf(
      pack([milestone("a", 7), milestone("b", 7), milestone("c", 7)]),
    );
    expect(result).toEqual([0, 0, 0]);
  });

  it("allows equal consecutive values, since ordering is non-decreasing", () => {
    const result = positionsOf(
      pack([milestone("a", 0), milestone("b", 50), milestone("c", 50), milestone("d", 100)]),
    );
    expect(result).toEqual([0, 0.5, 0.5, 1]);
  });

  it("rounds to six decimal places", () => {
    const result = positionsOf(
      pack([milestone("a", 0), milestone("b", 1), milestone("c", 3)]),
    );
    expect(result).toEqual([0, 0.333333, 1]);
  });

  it("recomputes from realValue, ignoring any position already present", () => {
    const stale = pack([milestone("a", 0), milestone("b", 100)]);
    // Simulates a hand-edited or stale committed value.
    const withStalePosition = {
      ...stale,
      milestones: stale.milestones.map((m) => ({ ...m, position: 0.9 })),
    };
    expect(positionsOf(withStalePosition)).toEqual([0, 1]);
  });

  it("does not mutate the input pack", () => {
    const input = pack([milestone("a", 0), milestone("b", 100)]);
    derivePositions(input);
    expect(input.milestones.map((m) => "position" in m)).toEqual([false, false]);
  });
});

describe("assertPackInvariants", () => {
  it("rejects an empty milestone array", () => {
    expect(() => assertPackInvariants(pack([]))).toThrow(/at least one/i);
  });

  it("rejects decreasing realValue", () => {
    expect(() =>
      assertPackInvariants(
        pack([milestone("a", 0), milestone("c", 100), milestone("b", 50)]),
      ),
    ).toThrow(/non-decreasing/i);
  });

  it("rejects a duplicate milestone id", () => {
    expect(() =>
      assertPackInvariants(pack([milestone("a", 0), milestone("a", 100)])),
    ).toThrow(/duplicate milestone id/i);
  });

  it("rejects a non-finite realValue", () => {
    expect(() =>
      assertPackInvariants(pack([milestone("a", 0), milestone("b", NaN)])),
    ).toThrow(/non-finite/i);
  });

  it("rejects a coverImage missing from the media table", () => {
    expect(() =>
      assertPackInvariants(
        pack([milestone("a", 0)], { coverImage: "images/absent.webp" }),
      ),
    ).toThrow(/coverImage/);
  });

  it("rejects a milestone mediaRef missing from the media table", () => {
    expect(() =>
      assertPackInvariants(pack([milestone("a", 0, ["images/absent.webp"])])),
    ).toThrow(/not declared in the media table/);
  });

  it("rejects a media ref declared twice", () => {
    expect(() =>
      assertPackInvariants(
        pack([milestone("a", 0)], {
          media: [
            { ref: "images/cover.webp", type: "image" },
            { ref: "images/cover.webp", type: "image" },
          ],
        }),
      ),
    ).toThrow(/more than once/);
  });

  it("rejects an asset used as its own thumbnail", () => {
    expect(() =>
      assertPackInvariants(
        pack([milestone("a", 0)], {
          media: [
            {
              ref: "images/cover.webp",
              type: "image",
              thumbnailRef: "images/cover.webp",
            },
          ],
        }),
      ),
    ).toThrow(/own thumbnail/);
  });

  it("accepts a media asset that no milestone references", () => {
    // The cover image is exactly this case, and it must stay legal.
    expect(() => assertPackInvariants(pack([milestone("a", 0)]))).not.toThrow();
  });
});
