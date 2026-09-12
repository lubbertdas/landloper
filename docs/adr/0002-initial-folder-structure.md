# 0002. Initial folder structure

Date: 2026-09-03
Status: Accepted

## Context

Stage 0.5a only needs to support the pure-TypeScript engine layer and its
tests — no Expo/React Native project exists yet. The Architecture Summary
defines four layers (Content/Data, Journey Engine, Platform Services,
Presentation), but only the first two are relevant to plain-Node work today.

## Decision

Create only:

- `src/engine/` — pure TypeScript, zero React Native imports. Runs and
  tests under plain Node indefinitely, independent of the mobile app.
- `docs/adr/` — append-only decision records, one file per decision. Never
  edit a past ADR; a changed decision gets a new ADR that supersedes it.

Explicitly deferred:

- A folder for the **Content/Data** layer (packs + media) — not created
  yet. Whether this is one folder or split (e.g. `src/packs` vs.
  `src/content`) will be decided at Stage 1, once the pack schema exists
  and it's clear what it needs to hold.
- Folders for **Platform Services** and **Presentation** — these don't
  exist until the Expo project is scaffolded at Stage 0.5b.

## Consequences

Today's scope is deliberately narrow: two folders, not a full project
skeleton. Nothing here should be read as pre-deciding Stage 1's content
layout.