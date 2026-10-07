# Images for the solar-system pack

**These files do not exist yet.** `pack.json` declares them so that the
Stage 1 contract is exercised end to end, but producing them is Stage 2a's
media pipeline, which generates resized WebP images plus thumbnails at fixed
dimensions from source files.

Consequences until that runs:

- The Stage 2a validator's "every `mediaRef` resolves to a file" check will
  fail for this pack. That is expected, not a regression.
- `width`, `height` and `bytes` are absent from every entry in the `media`
  table. The pipeline writes them, the same way the validator writes
  `position`. They are optional in the schema for exactly this reason.
- `attribution` is absent. Captions are authored (they double as alt text
  for TalkBack), but a credit can only be written once a specific image is
  chosen.

## Sourcing

NASA imagery is the obvious candidate and most of it is not subject to
copyright, but that is a per-image question, not a blanket rule — some NASA
material is contributed by third parties or carries separate terms, and the
agency's guidelines restrict using its identifiers in ways that imply
endorsement. Check the source page for each file, record the credit line it
asks for in `attribution`, and keep the original download alongside the
generated WebP so the pipeline can be re-run.

Expected filenames are listed in the `media` table of `pack.json`:
`cover`, `sun`, `mercury`, `venus`, `earth`, `mars`, `asteroid-belt`,
`jupiter`, `saturn`, `uranus`, `neptune`, `pluto` — each as
`<name>.webp` plus `<name>.thumb.webp`.
