/**
 * Derivation of the normalized `position` field, plus the cross-field pack
 * invariants that JSON Schema cannot express.
 *
 * This is a pure function over an already-parsed pack: no filesystem, no
 * image decoding, no byte budget. Those belong to the Stage 2a validator,
 * which calls this function to do the arithmetic (workplan Stage 2: the
 * validator "computes and writes the derived `position` values").
 */

import type {
  AuthoredContentPack,
  AuthoredMilestone,
  Milestone,
} from "./types";

/**
 * A pack whose positions have been derived. Media is still authored-shaped:
 * `width`/`height`/`bytes` are filled by the Stage 2a media pipeline, which
 * is a separate step from this one.
 */
export type PositionedContentPack = Omit<AuthoredContentPack, "milestones"> & {
  milestones: Milestone[];
};

/** Thrown when a pack violates the Stage 1 contract. */
export class PackContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PackContractError";
  }
}

/**
 * Decimal places kept on derived positions. Six places is 1 mm of resolution
 * on a 1 km walk and 1 cm on a 10 km walk — far below GPS accuracy — while
 * keeping committed packs readable and their diffs stable.
 */
export const POSITION_DECIMALS = 6;

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * Checks the invariants that span more than one field, and so cannot live in
 * the JSON Schema: ordering, uniqueness, and media cross-references.
 *
 * Throws on the first violation, with a message naming the offending id.
 */
export function assertPackInvariants(pack: AuthoredContentPack): void {
  const { milestones, media } = pack;

  if (milestones.length === 0) {
    throw new PackContractError(
      `Pack "${pack.id}" has no milestones; at least one is required.`,
    );
  }

  // --- milestones: unique ids, finite and non-decreasing realValue ---------
  const seenMilestoneIds = new Set<string>();
  let previous: AuthoredMilestone | undefined;

  for (const milestone of milestones) {
    if (seenMilestoneIds.has(milestone.id)) {
      throw new PackContractError(
        `Pack "${pack.id}" has a duplicate milestone id "${milestone.id}".`,
      );
    }
    seenMilestoneIds.add(milestone.id);

    if (!Number.isFinite(milestone.realValue)) {
      throw new PackContractError(
        `Milestone "${milestone.id}" has a non-finite realValue.`,
      );
    }

    if (previous !== undefined && milestone.realValue < previous.realValue) {
      throw new PackContractError(
        `realValue must be non-decreasing: milestone "${milestone.id}" ` +
          `(${milestone.realValue}) comes after "${previous.id}" ` +
          `(${previous.realValue}).`,
      );
    }

    previous = milestone;
  }

  // --- media: unique refs, every reference resolvable ----------------------
  const knownRefs = new Set<string>();
  for (const asset of media) {
    if (knownRefs.has(asset.ref)) {
      throw new PackContractError(
        `Pack "${pack.id}" declares media ref "${asset.ref}" more than once.`,
      );
    }
    knownRefs.add(asset.ref);
  }

  if (!knownRefs.has(pack.coverImage)) {
    throw new PackContractError(
      `coverImage "${pack.coverImage}" is not declared in the media table.`,
    );
  }

  for (const milestone of milestones) {
    for (const ref of milestone.mediaRefs) {
      if (!knownRefs.has(ref)) {
        throw new PackContractError(
          `Milestone "${milestone.id}" references media "${ref}", ` +
            `which is not declared in the media table.`,
        );
      }
    }
  }

  for (const asset of media) {
    if (asset.thumbnailRef !== undefined && asset.thumbnailRef === asset.ref) {
      throw new PackContractError(
        `Media "${asset.ref}" uses itself as its own thumbnail.`,
      );
    }
  }
}

/**
 * Returns a copy of the pack with `position` derived for every milestone.
 *
 * `position = (realValue − first) / (last − first)`, so the first milestone
 * is always 0.0 and the last always 1.0. A zero-span pack — every milestone
 * at the same `realValue` — gets 0.0 throughout, which the engine handles by
 * firing them all at start (workplan Stage 3, zero-span packs).
 *
 * Any `position` already present on the input is ignored and recomputed; the
 * authored `realValue` is always the source of truth.
 */
export function derivePositions(
  pack: AuthoredContentPack,
): PositionedContentPack {
  assertPackInvariants(pack);

  const first = pack.milestones[0];
  const last = pack.milestones[pack.milestones.length - 1];

  // Guaranteed by assertPackInvariants, but the compiler cannot see that.
  if (first === undefined || last === undefined) {
    throw new PackContractError(`Pack "${pack.id}" has no milestones.`);
  }

  const span = last.realValue - first.realValue;

  const milestones: Milestone[] = pack.milestones.map((milestone) => ({
    ...milestone,
    position:
      span === 0
        ? 0
        : round(
            (milestone.realValue - first.realValue) / span,
            POSITION_DECIMALS,
          ),
  }));

  return { ...pack, milestones };
}
