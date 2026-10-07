/**
 * Landloper content contract — Stage 1.
 *
 * UNITS — three kinds of number, never mixed:
 *
 *   1. `realValue` is in the PACK'S OWN unit, named by `realUnitLabel`:
 *      m, km, million km, years — whatever the content is measured in. It
 *      can be negative (a timeline counting up to "now" = 0). It is never
 *      converted to metres. Its only job is to derive `position`.
 *   2. `position` is a unitless fraction, 0.0–1.0, along the journey.
 *   3. Walking distances are metres, and only those fields are metres:
 *      `suggestedDistancesM`, `totalDistanceM`, `cumulativeDistanceM`. Every
 *      metres field ends in `M`.
 *
 * The workplan's "every distance is metres" rule applies to walking
 * distances only; it does not reach `realValue`.
 *
 * Two shapes of the same data:
 *   - `Authored*` — what a human types into `pack.json`.
 *   - unprefixed  — what tooling has completed, and what the engine, UI and
 *                   `PackSource` consume. Derived fields are required here.
 *
 * The only difference is derived fields: `position` (computed by
 * `derivePositions`) and the media dimensions written by the Stage 2a media
 * pipeline. Authors never type either.
 */

/** Schema version of the pack format itself, not of the pack's content. */
export type SchemaVersion = 1;

/**
 * The only legal scaling model. Reserved as a field so that a future model
 * needs no schema migration (workplan Stage 0).
 */
export type ScalingModel = "fit-to-distance";

/**
 * A relative path within the pack folder — never an absolute URL, never
 * `..`, never a leading `/`. This is what lets an identical pack be read
 * from the app bundle today and from a download directory later without
 * touching the content (workplan Stage 1, design rules).
 *
 * Example: `"images/earth.webp"`.
 */
export type MediaRef = string;

/** `"audio"` is reserved by Stage 0 and unused in v1. */
export type MediaType = "image" | "audio";

// ---------------------------------------------------------------------------
// Media
// ---------------------------------------------------------------------------

/** A media asset as authored: the path, plus the human-written text. */
export interface AuthoredMediaAsset {
  /** Relative path within the pack folder. Unique; acts as the asset's key. */
  ref: MediaRef;
  type: MediaType;
  /** Smaller derivative produced by the Stage 2a media pipeline. */
  thumbnailRef?: MediaRef;
  /** Shown with the image; doubles as alt text for TalkBack (Stage 8). */
  caption?: string;
  /** Source credit. Required at ship time by the validator, not by the type. */
  attribution?: string;
  /** Written by the media pipeline, not by the author. */
  width?: number;
  /** Written by the media pipeline, not by the author. */
  height?: number;
  /** On-disk size of `ref`, in bytes. Written by the media pipeline. */
  bytes?: number;
}

/** A media asset after the media pipeline has run. */
export interface MediaAsset extends AuthoredMediaAsset {
  width: number;
  height: number;
  bytes: number;
}

// ---------------------------------------------------------------------------
// Milestone
// ---------------------------------------------------------------------------

/** Notification copy. Fully authored — code never assembles these. */
export interface MilestoneNotification {
  title: string;
  body: string;
}

export interface AuthoredMilestone {
  /** Unique within the pack. */
  id: string;
  /**
   * Authored real-world position, in the pack's `realUnitLabel` units.
   * Non-decreasing across the milestones array.
   */
  realValue: number;
  title: string;
  body: string;
  /** Relative paths that must each appear in the pack's `media` table. */
  mediaRefs: MediaRef[];
  notification: MilestoneNotification;
}

export interface Milestone extends AuthoredMilestone {
  /**
   * Derived, never authored:
   *   (realValue − realValue_first) / (realValue_last − realValue_first)
   * Always within 0.0–1.0 inclusive. All positions are 0.0 for a zero-span
   * pack. This normalized value is the canonical form the engine consumes.
   */
  position: number;
}

// ---------------------------------------------------------------------------
// Pack
// ---------------------------------------------------------------------------

interface ContentPackBase {
  schemaVersion: SchemaVersion;
  /** Stable, kebab-case, unique across all packs. Never reused. */
  id: string;
  title: string;
  description: string;
  /** Label only. Never branched on in code. */
  domainType: string;
  /** `"en"` in v1; metadata only, no i18n machinery. */
  locale: string;
  /** Semver, for the pack's own content — independent of `schemaVersion`. */
  version: string;
  coverImage: MediaRef;
  scalingModel: ScalingModel;
  /** Display only, e.g. `"km"`, `"years"`, `"million km"`. */
  realUnitLabel: string;
  /** Offered in the setup flow, in metres, e.g. `[2000, 5000, 10000]`. */
  suggestedDistancesM: number[];
}

/** A pack as authored: `pack.json` before tooling completes it. */
export interface AuthoredContentPack extends ContentPackBase {
  media: AuthoredMediaAsset[];
  /** Ordered by `realValue`, at least one. */
  milestones: AuthoredMilestone[];
}

/**
 * A completed pack: what `PackSource.loadPack` returns and what the engine,
 * the UI and persistence all consume.
 */
export interface ContentPack extends ContentPackBase {
  media: MediaAsset[];
  milestones: Milestone[];
}

/**
 * Listing entry for the pack browser (workplan Stage 2, `PackSource`).
 * Deliberately excludes `milestones` so the browser never loads full packs.
 */
export interface PackSummary {
  id: string;
  title: string;
  description: string;
  domainType: string;
  version: string;
  coverImage: MediaRef;
  suggestedDistancesM: number[];
  milestoneCount: number;
}
