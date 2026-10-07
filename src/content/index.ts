/**
 * The Stage 1 content contract — the boundary every other layer depends on.
 *
 * Layer 1 of the architecture (Content/Data). Contains types and pure
 * functions only: no filesystem, no React Native, no Expo. `PackSource` and
 * its implementations arrive at Stage 2a; the JSON Schema in this folder is
 * consumed by the Stage 2a validator script.
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
  assertPackInvariants,
  derivePositions,
  PackContractError,
  POSITION_DECIMALS,
  type PositionedContentPack,
} from "./positions";
