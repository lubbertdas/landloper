# 0004. Positions are strictly proportional to real distance

Date: 2026-10-07
Status: Accepted

## Context

Fit-to-distance derives each milestone's `position` linearly from its
`realValue`. For the solar-system pack this puts the Sun, Mercury, Venus,
Earth and Mars within the first ~77 m of a 2 km walk (~193 m of a 5 km
walk), followed by long stretches with nothing to reach. ADR 0003 left open
whether that is an acceptable experience.

## Decision

It is the intended experience. Positions stay strictly proportional to
`realValue`. The tight cluster near the start and the long empty stretches
afterwards are the point: the walk makes the emptiness of the solar system
felt.

Never compress, rescale, re-space, or split a pack to even out milestone
spacing — not in the engine, not in the validator, and not by authoring
`realValue`s that are not the real values.

## Consequences

- `derivePositions` stays a plain linear map; no non-linear options.
- Packs with clustered milestones will fire several notifications close
  together. Any handling of that (e.g. grouping notifications that arrive
  within seconds of each other) is a presentation concern and must not move
  positions.
- This is not an open item; future stages should not re-raise it.
