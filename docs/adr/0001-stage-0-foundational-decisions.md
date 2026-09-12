# 0001. Stage 0 foundational decisions

Date: 2026-09-03
Status: Accepted

## Context

Before any code is written, several architectural and platform decisions need
to be locked in, since changing them later would mean rework rather than
extension.

## Decision

- **Stack:** React Native via Expo. Reuses existing JS/TS knowledge; plain
  React can't accumulate distance in the background or fire lock-screen
  notifications; Flutter offers no benefit worth learning Dart for.
- **Launch platform:** Android only. $25 one-time vs. $99/year + a Mac for
  iOS. Nothing in the architecture is Android-specific, so iOS remains a
  later addition, not a rewrite.
- **Build strategy:** local builds only. No Expo account, no cloud build
  service. EAS Build is only truly necessary for iOS (Xcode is macOS-only),
  and it also holds signing keys on Expo's servers rather than ours.
- **Content delivery:** all packs bundled inside the app binary. Zero
  infrastructure, zero cost, offline by construction. New packs ship via app
  update; a remote-pack upgrade path is deferred to Stage 2b.
- **Media scope:** images only for v1. Audio is roughly an order of
  magnitude heavier per milestone. Schema reserves the field but doesn't use
  it yet.
- **Scaling model:** fit-to-distance only. The pack declares real-world
  distances between milestones; the app compresses/stretches the whole path
  to exactly fill the chosen walk distance. No alternate model, no
  user-facing toggle.
- **Distance source:** GPS only, via `expo-location` background updates.
  Accepted tradeoffs: no indoor/treadmill walking, higher battery use, a
  persistent notification during an active journey, and the strictest Play
  Store permission review. Pedometer support is post-v1, behind a
  `DistanceProvider` interface.
- **Offline-first:** the active journey runs fully offline once started.
- **Identity.** Display name "Landloper". Android `applicationId`
  finalized as `io.github.lubbertdas.landloper`. Set in `app.json` at
  Stage 0.5b; cannot change after the first Play upload.
- **Total cost to ship:** $25 (one-time Play Console registration). All
  tooling otherwise free.

## Consequences

These decisions bound every later stage. In particular: no server-side
component is ever required for v1, background GPS accuracy/battery tradeoffs
are accepted rather than solved, and the `applicationId` must be finalized
before the first Play upload — there is no second chance on that value.