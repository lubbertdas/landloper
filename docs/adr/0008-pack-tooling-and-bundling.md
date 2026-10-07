# 0008. Pack tooling and bundling

Date: 2026-10-07
Status: Accepted

## Context

Stage 2a delivers `BundledPackSource`, the pack validator and the media
pipeline. The workplan states what each must do, not how files are laid out
or how bundling works under Metro.

## Decision

### Tooling

- Scripts live in `scripts/`, run with `tsx`, and are dev-only:
  `npm run media`, `npm run validate`, and `npm run packs` (both, in order).
  Dev dependencies: `tsx`, `sharp` (images), `ajv` (JSON Schema 2020-12).
- **Originals live in `packs/<id>/source/`**, committed, with the same base
  name as their ref (`source/earth.jpg` → `images/earth.webp`). Nothing in
  `source/` is bundled. `images/` is entirely generated.
- **Media pipeline output:** main image WebP q80 fitted inside 1080×1080;
  thumbnail WebP q70 cropped to 320×320. It writes `width`, `height`,
  `bytes` into `pack.json` in place (ADR 0003).
- **Validator** checks schema, invariants, positions, file existence,
  dimension freshness, credits, the 8 MB per-pack and 40 MB total budgets,
  and that the pack id matches its folder. By default it writes stale
  positions in place (`--check` reports instead). `--release` turns
  placeholder or missing credits from warnings into errors.

### Placeholders

When an image has no original, the pipeline generates a labelled
placeholder into `source/` and sets `attribution` to start with
`PLACEHOLDER`. Placeholders are for development builds only; a release
build must pass `npm run validate -- --release`.

### Bundling

Metro bundles only files reached by a literal `require()`. The validator
therefore generates `src/content/bundled.generated.ts`, a registry of each
pack's JSON and every image, on success only. It is committed so the app
builds without running tooling first. `BundledPackSource` takes this
registry by injection, so it stays testable under Node.

### PackSource shape

`listPacks()` and `loadPack()` are async (a remote source will need it);
`resolveMedia()` is synchronous and returns a `MediaSource` — a Metro asset
id (number) for bundled media, `{ uri }` for downloaded media later —
rather than the workplan's "local URI", because bundled assets in React
Native are module ids, not paths. Both forms are directly usable as an
`<Image source>`.

## Consequences

- Adding a pack: folder under `packs/`, originals in `source/`, then
  `npm run packs`. No code changes; the registry regenerates.
- Forgetting `npm run validate` after adding a pack means the app does not
  see it; the validator test in `npm test` fails if a committed pack is
  invalid.
