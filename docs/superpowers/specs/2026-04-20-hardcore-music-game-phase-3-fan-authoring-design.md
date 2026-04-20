# Hardcore Music Game Phase 3 Fan Authoring Design

## Context

`apps/pit-game` has already shipped a playable vertical slice and a Phase 2 alpha polish pass. The current prototype can:

1. upload a local song
2. decode browser audio into a draft `SongProfile`
3. let the player review section kind and chaos overrides
4. save reviewed profiles locally
5. run a playable crowd-simulation loop with readable HUD, results, and regression fixtures

That foundation is enough to prove the game fantasy, but it exposes the next product risk:

`the system can draft a show profile, but hardcore fans still need a better way to turn that draft into a trustworthy authored run`

Phase 3 therefore shifts the product emphasis away from "make the automatic analyzer smarter at all costs" and toward:

`build a fast semi-editor that lets scene-literate players correct the room logic themselves`

## Approved Decisions

The following decisions are treated as fixed input for this design:

1. `genre scope`
   Phase 3 only needs to serve `hardcore`, `beatdown`, and `metalcore` style songs. It does not need to generalize to arbitrary music genres.
2. `analysis runtime`
   Song analysis remains `browser-local`. No backend service, hosted DSP pipeline, or model-assisted classification is in scope.
3. `product philosophy`
   Fans, not the analyzer, should own the final semantic judgment for `breakdown`, `two-step`, `recovery`, and other crowd-relevant moments.
4. `editing depth`
   Phase 3 should be a `half-editor`, not a full professional charting tool. A typical song should be reviewable in roughly `3 to 10 minutes`.
5. `automatic role`
   Automatic analysis should act as a `drafting assistant` and `suggestion layer`, not as the final authority.
6. `runtime contract`
   The gameplay runtime should continue to consume a deterministic, validated `SongProfile`.

## Product Definition

Phase 3 adds a `fan-assisted authoring workflow` on top of the current upload-and-review loop.

The user journey becomes:

1. import a local song
2. let the browser generate a draft profile
3. open a lightweight timeline editor
4. correct the song's live-scene semantics through sections, impacts, and chaos tuning
5. locally preview small windows of the song through audio and gameplay
6. save a reviewed profile that can be replayed and re-edited locally

The key change is that the product no longer frames the review pass as "approve the analyzer." It frames the workflow as:

`the system gives you a starting sketch; you author the final pit logic`

## Goals

Phase 3 must achieve the following outcomes:

1. Let a fan quickly convert a machine draft into a reliable, playable `SongProfile`.
2. Keep editing focused on `show semantics`, not low-level DSP concepts.
3. Provide fast local validation through short-window preview instead of forcing full-song reruns.
4. Preserve a clean separation between machine suggestions and human-authored decisions.
5. Keep the workflow small enough that it still feels like a game tool, not a DAW.

## Non-Goals

Phase 3 does not include the following:

1. online profile sharing, moderation, or community publishing
2. remote analysis services or server-side audio processing
3. full multi-track authoring comparable to professional rhythm-game editors
4. arbitrary event scripting for every gameplay subsystem
5. support for non-heavy music genres as a primary target

## Core Product Shift

Previous phases treated the upload flow as:

`decode song -> auto-generate profile -> lightly correct mistakes`

Phase 3 redefines it as:

`decode song -> draft authoring scaffold -> fan-authored semantic edit pass -> playable reviewed profile`

This shift has two implications:

1. `accuracy matters differently`
   The analyzer should still be helpful, but it no longer needs to fully understand the song. It only needs to provide useful anchors, candidate segments, and confidence signals.
2. `editor quality now matters more than classifier ambition`
   The highest-value investment is in a fast timeline workflow, strong constraints, and deterministic preview loops.

## Architecture Overview

Phase 3 should preserve the current architecture split:

1. `analysis modules`
   Browser-local audio decode and draft generation.
2. `review domain`
   Pure TypeScript structures and operations for sections, impacts, overlays, validation, and preview-window state.
3. `persistence`
   Local browser storage for draft overlays and reviewed profiles.
4. `runtime controller`
   Existing gameplay runtime that consumes reviewed profiles plus new preview-specific control paths.
5. `React shell`
   Timeline editor, inspector, preview controls, and profile management UI.

The new work should extend these layers rather than collapsing logic into `App.tsx`.

## Data Model

Phase 3 should formalize three distinct layers of song data:

### 1. `AnalysisDraft`

Machine-generated, read-only draft data derived from browser-local analysis.

It should contain:

1. beat grid and bar-aligned timing anchors
2. coarse section suggestions
3. impact candidates
4. confidence annotations
5. warning or suggestion metadata such as "possible split", "possible merge", or "low-confidence segment"

This layer can be recalculated in future versions without discarding human decisions.

### 2. `ReviewOverlay`

Human-authored corrections that sit on top of the draft.

It should contain:

1. section kind overrides
2. section boundary edits
3. section split and merge operations
4. section chaos overrides
5. impact additions, deletions, and type edits
6. review state such as `suggested`, `accepted`, `modified`, or `confirmed`
7. editor metadata such as loop range or preferred display name if needed

This layer is the real authored work and must be durable across analyzer upgrades.

### 3. `ReviewedSongProfile`

The validated runtime payload produced by combining `AnalysisDraft` and `ReviewOverlay`.

This remains the only profile shape the gameplay runtime consumes.

## Editor Information Architecture

The Phase 3 editor should use a `single timeline + inspector + preview` layout rather than a dense multi-track production UI.

### Timeline Region

The timeline should show five conceptual layers:

1. `audio foundation`
   Waveform or energy strip, playhead, time ticks, and beat-grid markers.
2. `section track`
   Segment blocks showing kind, start/end, chaos, and review state.
3. `impact track`
   Point markers for `hit`, `drop`, `stop`, and `accent`.
4. `suggestion layer`
   Low-confidence flags, split/merge suggestions, and analyzer candidates displayed as clearly non-authoritative overlays.
5. `loop selection`
   A simple windowing control for previewing a local range.

### Inspector Region

When the user selects a section or impact, the inspector should expose only the relevant fields for that object.

For `sections`, it should include:

1. section kind
2. start and end
3. chaos value
4. review status
5. analyzer confidence
6. optional crowd-behavior summary

For `impacts`, it should include:

1. impact type
2. timestamp
3. source state such as `candidate`, `confirmed`, or `user-added`
4. optional conflict warnings

### Preview Region

The bottom preview area should support:

1. `local audio preview`
   Loop a short song window with visible beat and marker context.
2. `local playable preview`
   Launch the gameplay runtime into a short deterministic slice with a small pre-roll before the selected segment.

Pure non-interactive crowd auto-preview is optional future work and should not block Phase 3.

## Editing Workflow

The intended workflow for a single song is:

1. `import`
   Browser-local analysis creates an `AnalysisDraft`.
2. `scan`
   The user surveys the full song structure and spots obvious mistakes.
3. `repair sections`
   The user first fixes section kinds, boundaries, splits, merges, and chaos.
4. `repair impacts`
   The user then adds, removes, or retypes high-value moments such as `drop`, `stop`, and `hit`.
5. `preview locally`
   The user repeatedly loops and test-plays short windows until the section feels right.
6. `save reviewed profile`
   The edited result is stored as a durable local reviewed profile.

The workflow intentionally prioritizes `section correctness before point-event polish` because runtime feel depends more on semantic section structure than on individual impact markers alone.

## Section Editing Rules

Phase 3 should keep section editing powerful but constrained.

### Supported Operations

Sections should support only these five primary operations:

1. change section kind
2. drag start or end boundary
3. split at the playhead or nearest snapped beat
4. merge with an adjacent compatible section
5. adjust chaos

### Supported Section Kinds

The editor should continue using the current domain vocabulary:

1. `gather`
2. `push`
3. `two-step`
4. `side-to-side prep`
5. `breakdown`
6. `recovery`

### Hard Constraints

The editor should enforce the following rules:

1. section boundaries snap to beat markers by default, with optional bar-level snap when available
2. sections may not overlap
3. sections may not leave gaps in the full-song coverage
4. minimum section duration should be expressed in beats or bars, not free-form milliseconds
5. highly semantic section types such as `breakdown` and `recovery` should resist being fragmented into tiny slices

These constraints are important because they keep the authored data semantically legible and safe for the gameplay runtime.

## Impact Editing Rules

Impact editing should remain narrow in scope.

### Supported Impact Types

Phase 3 should only support:

1. `hit`
2. `drop`
3. `stop`
4. `accent`

### Hard Constraints

The editor should enforce or warn on the following:

1. impacts are point events, never ranges
2. impacts snap to nearby beats
3. very dense impact stacking in a tiny window should be discouraged
4. impacts that conflict with section semantics should produce warnings, not hard failures

Example warnings include:

1. repeated `drop` markers inside a calm `recovery` segment
2. a `stop` marker placed where the analyzer found no meaningful pause candidate

The user should remain free to override the system, but the tool should help prevent obviously noisy authoring.

## Review State Semantics

Review state should be tracked per authored object, not only per song.

Each `section` and `impact` should be able to show a lightweight state such as:

1. `suggested`
2. `accepted`
3. `modified`
4. `user-added`

This gives users a clean answer to:

1. what the analyzer guessed
2. what they personally confirmed
3. what they added by hand

It also makes future re-editing and diff-style inspection much easier.

## Local Preview Design

Preview is the key product differentiator for this phase because it closes the loop between authoring and play feel.

### Audio Preview

Audio preview should:

1. play only a short looped window, typically around `5 to 15 seconds`
2. show the playhead over beats, sections, and impacts
3. make section boundaries and candidate markers easy to audit

This is primarily for timing validation.

### Playable Preview

Playable preview should:

1. start slightly before the selected segment
2. include a short pre-roll so the user can feel the section transition
3. run against the current reviewed profile state
4. reuse the existing runtime rather than invent a separate simulation path

This is primarily for semantic validation:

`does this section feel like the right kind of pit when actually played`

### Determinism Requirement

Preview windows must be deterministic for the same profile and seed. Otherwise users cannot reliably tell whether a change improved the authored result or whether the room merely rolled a different random outcome.

## Role Of Automatic Analysis

Phase 3 intentionally narrows the analyzer's role.

It should help by providing:

1. beat and bar timing anchors
2. coarse section draft blocks
3. impact candidates
4. low-confidence flags
5. merge or split suggestions
6. lightweight semantic warnings

It should not behave as:

1. the final classifier
2. an opaque source of truth
3. a system that silently overwrites fan-authored decisions

This means the analyzer should appear in UI as a `suggestion layer`, visually distinct from confirmed authored data.

## Runtime Integration

The runtime contract should remain simple:

1. editing produces a validated `ReviewedSongProfile`
2. preview mode builds a local runtime slice from the current profile state
3. full-song play continues to use the same runtime entry path as earlier phases

Preview integration should be additive. It should not fork the gameplay logic into a separate authoring-only ruleset.

## Persistence And Re-entry

Phase 3 should extend local persistence so a user can:

1. save a reviewed profile
2. reopen it for continued editing
3. distinguish draft-derived profiles from fully reviewed profiles
4. preserve authored overlays even if analysis heuristics change later

The storage model should prefer saving `overlay + reviewed profile metadata` rather than only a flattened final profile, because that preserves the author's decisions as structured edit intent.

## Error Handling

The editor should handle the following failure modes explicitly:

1. `audio decode failure`
   Show a clear local-browser limitation or unsupported-file message.
2. `analysis insufficiency`
   If the analyzer cannot produce reliable candidates, still allow manual editing on a coarse scaffold instead of blocking the workflow.
3. `invalid authoring state`
   Prevent save or preview when gaps, overlaps, or impossible durations exist, and explain the exact offending object.
4. `preview launch failure`
   Fall back to local audio preview so the user can continue editing.
5. `local storage unavailability`
   Allow temporary in-session editing with a warning that the reviewed profile cannot be persisted.

## Testing Strategy

Phase 3 should emphasize pure-domain tests first, with thin UI integration tests around the editor shell.

### Domain Tests

Add or expand tests for:

1. section split, merge, boundary snapping, and duration constraints
2. impact insertion, deletion, snapping, and conflict warnings
3. draft-plus-overlay merge logic
4. preview-window slicing and deterministic seed behavior
5. persistence of overlays and reviewed profiles across reloads

### Regression Fixtures

Keep a small internal library of heavy-song fixtures that cover:

1. beatdown-heavy breakdown spikes
2. two-step-oriented grooves
3. metalcore-style tension builds and recovery tails
4. mid-tempo push sections
5. songs with obvious stop/drop punctuation

The purpose of these fixtures is not genre completeness. It is to keep the authoring workflow stable for the exact scene vocabulary this game targets first.

### Manual Acceptance

Phase 3 should be considered successful when:

1. a fan can review a song in roughly `3 to 10 minutes`
2. local preview clearly answers whether a section feels correct
3. analyzer suggestions reduce editing time instead of creating noise
4. reopening a reviewed profile preserves the author's intent cleanly

## Risks And Mitigations

### Risk 1: The editor becomes too heavy

If too many tracks or event types are added at once, the tool will stop feeling approachable.

Mitigation:

1. keep to one timeline
2. keep impact types narrow
3. defer full event-track authoring

### Risk 2: The analyzer and authoring layers blur together

If machine guesses and human decisions look identical, users will lose trust and re-editing will become confusing.

Mitigation:

1. keep separate draft and overlay data layers
2. keep distinct visual states for guessed versus confirmed data

### Risk 3: Preview feels inconsistent

If preview results vary too much run to run, authoring feedback will be unusable.

Mitigation:

1. seed preview deterministically
2. always preview with a short pre-roll
3. reuse the production runtime path

### Risk 4: The project drifts back toward generic music analysis

Trying to support every genre too early will dilute the design and create low-value complexity.

Mitigation:

1. optimize first for heavy music only
2. keep fixtures and heuristics scoped to hardcore, beatdown, and metalcore

## Recommended Phase 3 Vertical Slice

The smallest meaningful Phase 3 implementation should include:

1. a timeline editor with beat grid, section track, impact track, and loop range
2. section editing for type, boundary, split, merge, and chaos
3. impact editing for `hit`, `drop`, `stop`, and `accent`
4. local audio preview
5. local playable preview
6. persistence for reviewed overlays and re-entry
7. a heavy-music sample fixture set for regression and demo use

This is enough to validate the real product hypothesis:

`scene-literate players can quickly turn a rough machine draft into a playable, convincing hardcore-show run`
