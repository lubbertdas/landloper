# 0009. Stage 6 UI scope (mock-driven)

Date: 2026-10-07
Status: Accepted

## Context

Stage 6 builds the six screens in the workplan, driven by the mock
provider, before GPS (Stage 4), notifications (Stage 5) and persistence
(Stage 7) exist. Several screens touch things those stages own.

## Decision

- **Screens** (Expo Router, one file each): pack browser `app/index.tsx`,
  setup `app/pack/[packId].tsx`, live journey `app/journey.tsx`, milestone
  detail `app/milestone/[packId]/[milestoneId].tsx`, history
  `app/history/index.tsx` + `app/history/[journeyId].tsx`, settings
  `app/settings.tsx`.
- **Look and feel** comes only from `src/ui/theme.ts` and the components
  in `src/ui/components/` (ADR 0006). Screens hold layout, not colours.
- **Setup** offers the pack's suggested distances plus a custom distance.
  There is no permissions step yet; it arrives with GPS.
- **Live journey** includes a *development-only* simulated-speed control
  (1×, 10×, 50×, 200×; default 20×), so a 2 km walk can be demonstrated in
  about a minute. It goes when GPS replaces the mock in release builds.
- **Ending an unfinished journey** returns to the browser and discards it
  (ADR 0007). A completed journey stays on the live screen as a summary
  until dismissed.
- **Distances shown to the user** are formatted in `src/ui/format.ts`
  (metres under 1 km, else km or miles). Pack `realValue`s are never shown
  or formatted; packs author their own domain text.
- **Settings and history are in memory**, and the screens say so, until
  Stage 7. The notifications toggle is stored but has no effect until
  Stage 5.
- **Images** render through `MediaImage`, which sizes a frame view and
  fills it with the image: an Android bundled `<Image>` sized directly by
  percentage fell back to the file's intrinsic size.

## Consequences

Stage 5 adds notification-tap deep links to the existing milestone-detail
route; Stage 7 swaps the in-memory stores for persisted ones behind the
same hooks (`useJourney`, `useSettings`).
