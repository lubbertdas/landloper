/**
 * The Stage 1 content contract — the boundary every other layer depends on.
 *
 * Layer 1 of the architecture (Content/Data). Contains types and pure
 * functions only: no filesystem, no React Native, no Expo. `PackSource` and
 * `BundledPackSource` take their registry by injection; the app passes the
 * generated `bundled.generated.ts` (not exported here, so Node code never
 * loads its Metro-only requires). The JSON Schema in this folder is
 * consumed by scripts/validate-packs.ts.
 */

export type {
  AuthoredContentPack,
  AuthoredMediaAsset,
  AuthoredMilestone,
  ContentPack,
  MediaAsset,
  MediaRef,
  MediaType,
  Milestone,
  MilestoneNotification,
  PackSummary,
  ScalingModel,
  SchemaVersion,
} from "./types";

export {
  BundledPackSource,
  PackNotFoundError,
  summarize,
  type BundledRegistry,
  type MediaSource,
  type PackSource,
} from "./BundledPackSource";

export {
  assertPackInvariants,
  derivePositions,
  PackContractError,
  POSITION_DECIMALS,
  type PositionedContentPack,
} from "./positions";
