# Images for the solar-system pack

**Everything in this folder is generated** by the Stage 2a media pipeline
(`npm run media`) from originals in `../source/`. Never edit or export files
here by hand.

**Current images are placeholders**: a coloured disc with the milestone's
name, generated because no original exists yet in `source/`. Their
`attribution` in `pack.json` starts with `PLACEHOLDER`, which
`npm run validate -- --release` rejects. Placeholders are fine for
development builds only.

## Replacing a placeholder

1. Put the original in `../source/` with the same base name as the ref,
   e.g. `source/earth.jpg` for `images/earth.webp`. Delete the placeholder
   `source/earth.png`.
2. In `pack.json`, set that media entry's `attribution` to the credit line
   the source asks for.
3. Run `npm run packs` (media pipeline, then validator).

## Sourcing

NASA imagery is the obvious candidate and most of it is not subject to
copyright, but that is a per-image question, not a blanket rule — some NASA
material is contributed by third parties or carries separate terms, and the
agency's guidelines restrict using its identifiers in ways that imply
endorsement. Check the source page for each file, record the credit line it
asks for in `attribution`, and keep the original in `source/` so the
pipeline can be re-run.

Expected base names: `cover`, `sun`, `mercury`, `venus`, `earth`, `mars`,
`asteroid-belt`, `jupiter`, `saturn`, `uranus`, `neptune`, `pluto`.
