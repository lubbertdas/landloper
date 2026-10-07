# Development Workplan v4 — "Landloper"

## Product in one sentence
A fitness app that maps the user's real-world walking distance onto a **scaled journey** through a body of content (solar system, timeline of the universe, Via Dolorosa), notifying them and presenting text and images as they pass each milestone.

## The single most important architectural idea
Every journey type — solar system, cosmic timeline, historical route — is the **same object**: an ordered path of positioned milestones with attached media. Therefore **adding a new domain must be a data operation, not a code change.** The engine knows nothing about planets or saints; it knows only about *positions, thresholds, and content*.

If a future request is "add a Great Wall of China walk" or "add a periodic-table journey," the answer must be: **author a new content pack. No engine or UI changes.** If that is ever not true, the abstraction has leaked and should be corrected.

---

## Stage 0 — Foundational decisions

All decided. Rationale is recorded only where it identifies what would have to change for the decision to change.

- **Stack: React Native via Expo.** Reuses existing JS/TS. Flutter offers no compensating benefit for learning Dart. Plain React produces a website, which cannot accumulate distance in the background or fire lock-screen notifications.
- **Launch platform: Android only.** $25 one-time versus $99/year and a Mac. Nothing in the architecture is Android-specific, so iOS is a later decision, not a rewrite.
- **Build strategy: local only.** No Expo account, no cloud build service, no source leaving the machine. EAS Build is genuinely necessary only for iOS, since Xcode is macOS-only; note that it also generates and holds signing keys on your behalf, making updates depend on an account you don't own.
- **Content delivery: bundled with the app.** All packs ship inside the binary — zero infrastructure, zero cost, offline by construction. New packs arrive via app update. Upgrade path in Stage 2b.
- **Media scope: images only.** Audio is roughly an order of magnitude heavier per milestone and would dominate download size. The schema reserves the field; v1 does not use it.
- **Scaling model: fit-to-distance, and only fit-to-distance.** The pack declares real-world distances between milestones; the app compresses or stretches that whole path to exactly fill the distance chosen for this walk. Walk 2 km or 10 km, you pass every milestone, just spaced differently. No second model, no user-facing choice, no fixed-scale mapping.
- **Distance source: GPS only.** `expo-location` background updates are the only mechanism Expo supports out of the box for accumulating distance with the screen off; a pedometer would require a custom native foreground service. Accepted tradeoffs: **no indoor or treadmill walking**, higher battery use, a persistent notification during an active journey, and the strictest Play permission review. Pedometer is post-v1, behind the `DistanceProvider` interface.
- **Offline-first.** The active journey runs fully offline once started. Bundled packs make this automatic; keep it true if packs later become downloads.
- **Identity.** Display name **Landloper**. Android `applicationId` `com.TODO.landloper` — **must be final before the first Play upload and can never be changed for that listing.**
- **Total cost to ship: $25**, the one-time Play Console registration. Every tool below is free.

**Deliverable:** a decisions record (ADR) capturing the above.

---

## Stage 0.5a — JavaScript toolchain (first, ~30 minutes)

Node LTS, TypeScript, vitest, VS Code. `npm test` runs the suite. This is the entire Stage 3 workflow — no device, no emulator, no Android SDK.

**Deliverable:** an empty TypeScript project where `npm test` runs and passes one trivial test.

---

## Stage 0.5b — Android toolchain

Only once Stages 1 and 3 are done. Expo SDK and CLI; Android Studio installed for the SDK, platform tools and emulator — **not** as your editor; JDK; Expo Go on a physical phone. Three things worth meeting deliberately rather than mid-debugging:

- **Expo Go is not enough.** It is a pre-built app with a fixed set of native modules, and background location is not among them. At Stage 4 you need a **development build**: your own debug APK containing your native modules, from `npx expo run:android`. Fast refresh continues afterwards from your own client. A step, not a wall.
- **The keystore is the one irreversible thing.** Whatever key Google Play first accepts for a listing must be kept forever — lose it and you can never update that listing, only publish a new app under a new package name. Generate it, back it up outside the project, never commit it. Enrol in Play App Signing so a lost upload key is recoverable rather than fatal.
- **Release output is an AAB, not an APK.** See Stage 9.

**Deliverable:** an Expo project running on a physical Android phone via Expo Go, plus one completed development build, proving the local toolchain end to end.

---

## Stage 1 — Domain model & content contract

The contract every other layer depends on. Design it first, freeze it deliberately, version it.

**Units rule: every distance in code and in packs is a number of metres.** No mixed units internally. Display units are a presentation concern.

### ContentPack

| Field | Type | Notes |
|---|---|---|
| `schemaVersion` | int | `1` |
| `id` | string | Stable, kebab-case, unique |
| `title`, `description` | string | |
| `domainType` | string | Label only. Never branched on in code |
| `locale` | string | `"en"` in v1; metadata only, no i18n machinery |
| `version` | string | Semver, for the pack's own content |
| `coverImage` | mediaRef | |
| `scalingModel` | string | Literal `"fit-to-distance"`, the only legal value. Reserved so future models need no migration |
| `realUnitLabel` | string | Display only, e.g. `"km"`, `"years"`, `"m"` |
| `suggestedDistancesM` | int[] | e.g. `[2000, 5000, 10000]` |
| `milestones` | Milestone[] | Ordered, ≥ 1 |

### Milestone

| Field | Type | Notes |
|---|---|---|
| `id` | string | Unique within pack |
| `realValue` | number | Authored real-world position, in `realUnitLabel` units. Non-decreasing across the array |
| `position` | number | **Derived, never authored.** `(realValue − realValue_first) / (realValue_last − realValue_first)` → `0.0–1.0`. Computed by the validator and written into the built pack |
| `title`, `body` | string | |
| `mediaRefs` | mediaRef[] | |
| `notification` | `{ title, body }` | **Fully authored strings.** Code never assembles domain sentences or formats domain numbers |

### MediaAsset

`id`, `type` (`"image"`; `"audio"` reserved, unused), `ref`, `thumbnailRef`, `caption`, `attribution`, `width`, `height`, `bytes`.

### UserJourney (runtime, persisted)

`id`, `packId`, `totalDistanceM`, `cumulativeDistanceM`, `reachedMilestoneIds[]`, `startedAt`, `endedAt?`, `status` (`active` | `paused` | `completed`). **At most one journey may be `active` or `paused` at a time.**

### Design rules

- Normalized `position` is the canonical form the engine consumes. `realValue` exists to derive it and to let authors write packs in natural units.
- **Content is strictly separate from presentation.** No layout or styling in the data — only structured content and media references.
- A `mediaRef` is a **relative path within the pack folder**, never an absolute URL. This is what lets an identical pack be read from the bundle today and from a download directory later without touching the content.
- If `realValue_first == realValue_last`, all positions are `0.0`. See Stage 3.
- Version the schema so old packs keep working as the model evolves.

**Deliverable:** the schema as TypeScript types plus a JSON Schema for validation, and 1–2 hand-authored sample packs used as fixtures for the rest of development.

---

## Stage 2 — Content: bundled packs, free hosting later

### 2a — What ships in v1

A pack is a `pack.json` manifest plus an `/images` directory, living in the repo, bundled into the binary, read from the asset bundle at runtime. No database, no server, no auth, no monthly bill.

**Size budget.** A milestone image at phone resolution, WebP-compressed, runs roughly 100–250 KB; a 30-milestone pack with one image each lands around 5 MB. Hard budget **~8 MB per pack**, checked by the validator, and **~40 MB bundled total (≈5 packs)**. Exceeding the total budget is the trigger for Stage 2b, not a reason to compress harder. The thing that would break these budgets is audio, which is why v1 has none.

### The decision that keeps the door open

```
PackSource
  listPacks()            -> PackSummary[]
  loadPack(id)           -> ContentPack
  resolveMedia(id, ref)  -> local URI
```

`BundledPackSource` reads from the asset bundle. Later, `RemotePackSource` downloads a pack folder into local storage and reads from there. Because the folder has the same shape in both places, everything above this interface — engine, UI, persistence — is unchanged.

### 2b — Upgrade path, when wanted (still $0)

When "users must update the app to get new content" becomes annoying, host packs as **static files** on GitHub Pages, Cloudflare Pages or Netlify. Layout: `/packs/index.json` (available packs plus version numbers) and `/packs/<pack-id>/` containing `pack.json` and `/images`. The app fetches `index.json` when the pack browser opens, downloads a selected pack into local storage, verifies it, and hands it to `RemotePackSource`. Publishing is `git push`; version control, rollback and diffs come free.

A managed database buys an admin UI you don't need for content you author yourself, at the cost of auth, config, quotas, and a service that can suspend your project.

### Build regardless of mode

- **Pack validator** — a Node script, run in CI or by hand: required fields present, `realValue` non-decreasing, ≥ 1 milestone, every `mediaRef` resolving to a file that exists, pack under budget. It also **computes and writes the derived `position` values**. A pack that fails cannot ship.
- **Media pipeline** — a script producing resized, compressed WebP plus thumbnails at fixed dimensions from source images. Authoring must never involve manually exporting images at the right size.

**Deliverable:** two sample packs in the repo, validator and media script running from the command line, and `BundledPackSource` feeding real content into the app.

---

## Stage 3 — Journey engine (build this FIRST, after Stage 1)

Pure TypeScript over numbers, runnable in Node. The part of the app easiest to get subtly wrong, and the part you already know how to write and test. Finishing it first means the hardest logic is verified before you meet your first Gradle error.

### Shape: pure core, thin stateful shell

The core is a **reducer**, not an emitter. No sensors, no UI, no notifications, no clock, no storage inside it.

```ts
startJourney(pack, totalDistanceM)            -> { state, events }
advance(pack, state, cumulativeDistanceM)     -> { state, events }
pause(state) / resume(state)                  -> { state, events }
```

`JourneyState` is exactly the persisted `UserJourney` shape. A separate **adapter** outside the core owns the instance and forwards events to notifications and UI. Anything described elsewhere as "subscribing to the engine" means subscribing to that adapter.

### Rules

- **Distance is clamped monotonic.** `cumulative = min(totalDistanceM, max(state.cumulative, incoming))`. It never decreases; GPS jitter cannot un-reach a milestone.
- **Each milestone fires exactly once**, guarded by `reachedMilestoneIds`.
- **A tick may cross several milestones.** Emit them in ascending `position` order, all in the same result.
- **Milestones at `position === 0`** are emitted at `startJourney` with `atStart: true`. The notification layer suppresses these; the UI shows them as the opening card.
- **Reaching `totalDistanceM`** emits any remaining milestones, then `JourneyCompleted`, sets `status: 'completed'`, and stops accumulating. Further `advance` calls are no-ops.
- **While `paused`**, `advance` is a no-op and emits nothing.
- **Zero-span packs** (all positions `0.0`): the milestone fires at start; the journey completes on reaching `totalDistanceM`.

### Events

`MilestoneReached { milestoneId, atStart }` · `JourneyProgress { progress, distanceToNextM, nextMilestoneId }` · `JourneyCompleted`

### Tests

Synthetic distance sequences asserting the right events at the right thresholds: overshoot crossing several milestones in one tick, backward jitter, pause/resume, exact endpoint, past-endpoint, zero-distance, single-milestone, milestone at position 0, duplicate `advance` with the same value.

**Deliverable:** the engine plus a comprehensive unit-test suite, runnable with `npm test` with zero device dependencies.

---

## Stage 4 — Distance layer (abstracted)

```
DistanceProvider
  start() / stop() / pause() / resume()
  onDistance(cumulativeMetres)   // monotonic, since journey start
```

- **MockProvider** — replays a distance curve at an accelerated rate. **Write this first**; it is what lets you demo and test the whole app at a desk.
- **GpsProvider** — accumulated displacement via `expo-location` background updates, registered through `expo-task-manager`.
- **PedometerProvider is deferred**, not stubbed. The interface is the seam; do not write a placeholder.

### GPS specifics

- `startLocationUpdatesAsync` with a background task; `Accuracy.High`, `distanceInterval` ≈ 10 m, `timeInterval` ≈ 5 s.
- **Filtering, all in this layer:** discard fixes with `accuracy > 25 m`; discard segments implying speed above ~4 m/s or below ~0.2 m/s; Haversine between consecutive accepted fixes; ignore displacement under 5 m.
- Requires `ACCESS_FINE_LOCATION` plus `ACCESS_BACKGROUND_LOCATION`, requested as a **separate second prompt** on Android 10+, and a **foreground service** with a persistent notification for the duration of the journey. That notification is unavoidable and should be designed rather than tolerated.

### Who owns the tick

The background task, not the React tree, drives the loop: **task wakes → provider computes new cumulative distance → load `JourneyState` from storage → `advance()` → write state back → hand events to the notification layer.** The UI observes persisted state and is never on the critical path. Spell this out before writing any of it; it is the piece most likely to end up accidentally coupled to a component lifecycle.

**Deliverable:** provider interface with MockProvider and GpsProvider both driving the real engine; GPS verified on a real walk.

---

## Stage 5 — Notifications & background behaviour

Milestone crossings become **local notifications** via `expo-notifications`, using the milestone's authored `notification.title` and `notification.body`. They must fire while the app is backgrounded or the phone is locked.

- Consume `MilestoneReached` from the Stage 4 loop; suppress those flagged `atStart`.
- Deep-link a notification tap to the milestone detail screen with its images.
- **The hardest platform-specific piece. Prototype it immediately after GpsProvider works in the foreground**, before building any UI on top of it.

**Deliverable:** reliable background milestone notifications end-to-end on a real Android device, screen off, app backgrounded, over a 30+ minute walk.

---

## Stage 6 — UX & UI

All visual and layout logic lives in this layer only. It consumes engine state and pack content and defines neither.

1. **Pack browser** — available packs with cover images and descriptions.
2. **Setup flow** — pick a pack → see suggested distances → choose journey distance → grant permissions → start. No scaling-model choice, no distance-source choice; both are decided by the app.
3. **Live journey** — progress along the path, distance walked and remaining, next milestone and distance to it, current milestone media on passing one. **Glanceable** — people are walking.
4. **Milestone detail** — title, body, images, attribution. Reachable live, from a notification tap, or from history.
5. **History** — completed journeys, with drill-down to milestones reached.
6. **Settings** — display units (km/mi), notification preferences.

**Deliverable:** navigable UI wired to the engine and a real bundled pack, with images rendering as milestones are passed.

---

## Stage 7 — Persistence & progress

- Persist the active journey so it survives app restarts and resumes mid-walk. This store is also what the background task reads and writes, so it must be usable outside React.
- Record completed journeys (pack, distance, date, milestones reached) for history.
- Store preferences (display units, notification settings). **No stride length** — that was pedometer-only.
- Prefer `expo-sqlite` over `AsyncStorage`, given the background-task access pattern and a queryable history screen.
- *(Pack and media caching arrives only with Stage 2b; with bundled packs there is nothing to cache.)*

**Deliverable:** durable local storage; resume-in-progress and journey history both working.

---

## Stage 8 — Testing, offline, performance, accessibility

- Engine unit tests kept green; integration tests for provider → engine → notification.
- Field-test real walks: short (2 km), long (10 km), paused mid-walk, phone locked throughout, and a walk overshooting the target distance.
- **Offline check with no SIM and Wi-Fi off, not airplane mode** — airplane mode can disable or badly delay GPS first fix on some devices, testing the wrong thing. Expect a slow first fix without network-assisted GPS, and make the UI say so.
- Battery and performance profiling of background tracking over a long walk.
- Accessibility: readable-while-moving typography, TalkBack, image alt text and captions.

**Deliverable:** test suite plus a field-test checklist with results.

---

## Stage 9 — Release & content operations

- Play registration is a one-time $25 with no renewal, but requires **identity verification**, and new personal developer accounts must run a **closed test with a minimum number of testers over a minimum period** before production unlocks. This rule has changed more than once — check current Play Console requirements before planning around it, recruit testers early, and budget several weeks of calendar time.
- **Background location is the strictest permission on Play.** Expect a permissions declaration form and a **demonstration video** of the in-app use case. Justify it plainly: the app counts walking distance to advance a virtual journey.
- A **privacy policy** at a public URL is required. Set up the free static host (GitHub Pages) **at this stage** — it serves the policy now and becomes the pack host at Stage 2b.
- Confirm `applicationId` is final, and the keystore is backed up outside the project, before the first upload.
- Release artifact: `cd android && ./gradlew bundleRelease` → `android/app/build/outputs/bundle/release/app-release.aab`, signed and uploaded by hand. `npx expo run:android --variant release` builds an **APK** and is not the upload artifact.
- **Content-ops runbook:** how a new pack gets authored — write `pack.json`, drop images in the folder, run the media script, run the validator, open a PR. Write it for a non-engineer collaborator, not for yourself. This document is the proof that "new domain = data only" is real.

**Deferred:** iOS release, remote packs (2b), audio narration, pedometer provider, indoor/treadmill support, pack sharing, leaderboards, AR overlays.

---

## Architecture summary

Four decoupled layers, dependencies pointing inward toward the engine:

1. **Content/Data** — packs and media as folders, defined by the Stage 1 contract, read through `PackSource`.
2. **Journey Engine** — pure reducer: scaling, positions, milestone events. Knows nothing about the domain, the platform, or where content came from.
3. **Platform Services** — distance providers, notifications, background execution, storage, all behind interfaces. Owns the tick loop.
4. **Presentation** — React Native UI consuming persisted state and pack content.

---

## Build order

1. **0.5a** — Node, TypeScript, vitest. Nothing mobile.
2. **Stage 1** — schema plus one real sample pack.
3. **Stage 3** — engine and full unit-test suite, in Node.
4. **0.5b** — Expo project on the phone, hello world, one development build.
5. **Stage 4 (MockProvider only)** — mock driving the real engine inside the app, logging to console.
6. **Stage 2a** — `BundledPackSource`, real content loading, validator, media pipeline.
7. **Stage 6** — UI driven by the mock provider. A demoable app that never leaves your desk.
8. **Stage 4 (GPS) + Stage 5** — real sensors, background accumulation, background notifications. The genuinely hard part, attempted only once everything above it is known-good.
9. **Stages 7–9.**

---

## Open items before coding

- **`applicationId`** — `com.TODO.landloper` needs a real value. Irreversible after first Play upload.
- **Play closed-testing rules** — verify current requirements before scheduling release.
