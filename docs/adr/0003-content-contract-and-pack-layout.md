# 0003. Content contract and pack layout

Date: 2026-10-07
Status: Accepted

## Context

Stage 1 defines the content contract. The workplan specifies the fields of
`ContentPack`, `Milestone` and `MediaAsset`, but three questions have to be
answered before the contract can exist as files, and none of them is settled
by the workplan or by ADR 0001/0002:

1. Where the Content/Data layer lives — ADR 0002 deferred this explicitly to
   Stage 1, "once the pack schema exists and it's clear what it needs to
   hold".
2. How derived fields are stored. The workplan says `position` is "derived,
   never authored", computed by the validator and "written into the built
   pack". It does not say whether the built pack is a separate file from the
   authored one.
3. How a `mediaRef` on a milestone relates to a `MediaAsset` record. The
   workplan describes `mediaRef` as "a relative path within the pack folder",
   and separately lists `MediaAsset` as an entity with its own `id`. Those
   two statements imply different reference mechanisms.

## Decision

### 1. Packs are data at the repo root; the contract is code under `src/`

```
src/content/                  # the contract: layer 1 of the architecture
  types.ts                    # TypeScript types
  positions.ts                # derivePositions + cross-field invariants
  pack.schema.json            # JSON Schema, consumed by the Stage 2a validator
  index.ts
packs/<pack-id>/
  pack.json
  images/
```

Packs sit at the repo root rather than under `src/` because they are assets
bundled by the Expo asset pipeline, not modules compiled by TypeScript.
Keeping them outside `src/` keeps the code/content boundary visible, and
the layout `packs/<pack-id>/pack.json` + `images/` is byte-for-byte the
layout Stage 2b will serve from static hosting. The same folder shape then
holds in the repo, in the app bundle, and on the host — which is the property
that lets `BundledPackSource` and `RemotePackSource` differ only in how they
resolve a path.

`src/content` holds types and pure functions only: no filesystem access, no
Expo imports. `PackSource` and its implementations arrive at Stage 2a.

### 2. Derived fields are written into `pack.json` in place, guarded by a test

There is one file per pack, not an authored source plus a generated build
artifact. The validator writes `position` into `pack.json`; the media
pipeline writes `width`, `height` and `bytes` the same way. Derived values
are committed, so the shipped pack needs no build step to be readable.

The obvious hazard is a stale derived value — someone edits a `realValue`
and does not re-derive. That is handled by a test that recomputes positions
from the committed `realValue` values and fails on any mismatch
(`src/content/solar-system.pack.test.ts`). CI catches staleness; the
alternative of a second file per pack does not, it merely relocates the
problem into whether the build ran.

Consequently there is **one** JSON Schema, not one per shape, and derived
fields are optional in it. The schema validates a pack before and after
tooling completes it; the requirement that derived fields be *present* at
ship time is enforced by the Stage 2a validator, which is the component that
knows whether it has run. Cross-field rules — `realValue` ordering, unique
ids, media cross-references — are not expressible in JSON Schema and live in
`src/content/positions.ts`.

TypeScript keeps the two shapes distinct, so no layer has to defend against
a missing derived field:

- `AuthoredContentPack` / `AuthoredMilestone` — what a human types.
- `ContentPack` / `Milestone` — what the engine, UI and `PackSource`
  consume, with `position` and the media dimensions required.

### 3. A `mediaRef` is a relative path, and the path is the asset's key

A milestone's `mediaRefs` are relative paths. The pack carries a top-level
`media` array whose `ref` field is that same path, and which holds
everything else about the asset: caption, attribution, thumbnail, and the
dimensions the pipeline writes.

`MediaAsset` therefore has no separate `id`, departing from the workplan's
field list. A second identifier namespace would have to be kept consistent
with the filenames by hand, for no gain: the path is already unique within
the pack and is already what `PackSource.resolveMedia(id, ref)` takes. One
asset referenced by several milestones is declared once and credited once.

## Consequences

- Adding a pack touches no code: a folder under `packs/`, and nothing else.
  This is the property the whole architecture is built to protect.
- `src/engine` will import types from `src/content`. The architecture
  summary describes dependencies as pointing inward toward the engine, and
  this is the one inward-pointing edge — unavoidable given the Stage 3
  signatures take a `pack` argument. It is a dependency on the contract
  only, never on a loader or a file.
- `position` being committed means pack diffs show derived churn when a
  `realValue` changes. Accepted in exchange for no build step.
- Media metadata is absent from the solar-system pack until the Stage 2a
  pipeline runs, so that pack will fail the validator's file-existence check
  until its images exist. Expected, and noted in
  `packs/solar-system/images/README.md`.

## Related

Milestone spacing is strictly proportional to `realValue`, so the inner
solar system bunches up near the start of the walk. That is intended, and is
recorded as a decision in ADR 0004.
