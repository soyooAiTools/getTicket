# Hardcore Music Game Design

## Context

This document defines a music-driven hardcore-show game built around three pillars:

1. `pit survival`
   The player must remain standing and mentally composed inside a chaotic live hardcore crowd.
2. `style expression`
   The player is rewarded for moving with the right timing, choosing the right actions for the current section, and reading the room rather than mashing buttons.
3. `music-driven simulation`
   Uploaded songs directly reshape crowd behavior, player opportunity windows, task generation, lighting, camera pressure, and overall match flow.

The approved fantasy is not "a rhythm game with a punk skin." The approved fantasy is:

- `player role`: a regular fan inside the crowd
- `game feel`: chaos that is dangerous but readable
- `core structure`: survival as the floor, style and live-scene tasks as the score ceiling
- `content strategy`: a hybrid of authored systems plus semi-automatic song-to-show generation

## Approved Decisions

The following decisions are already approved and should be treated as fixed input for this design:

1. `genre direction`
   The game is a hybrid of rhythm action and crowd simulation, not a pure rhythm game, a pure brawler, or a pure show-management simulation.
2. `player fantasy`
   The player is a regular fan in the pit, not a vocalist, not a crew leader, and not a backstage director.
3. `success model`
   Each run uses a mixed evaluation model: survival is mandatory, while style and live-scene tasks drive higher ratings.
4. `moment-to-moment focus`
   The game must support hardcore-specific crowd behaviors such as mosh pressure, two-step windows, side-to-side preparation, breakdown explosions, and recovery aftermath.
5. `music ingestion`
   Players can upload songs and use them as the basis for generated runs.
6. `generation strategy`
   Song-driven content generation is `semi-automatic`, not fully automatic and not a full authoring-first editor.
7. `editing philosophy`
   Users do not build full charts from scratch. The system auto-generates a playable show profile, then the user corrects the most important labels and impact points.

## Product Definition

The approved product is a music-driven action game where each song becomes a live-show scenario.

The player enters a venue as a regular fan and survives a full song by:

1. reading crowd movement and pressure
2. choosing the right action for the current section
3. staying upright through high-risk moments
4. taking style opportunities during musically appropriate windows
5. completing situational live-scene tasks that emerge from the current song structure

The defining differentiator is that uploaded music changes the actual runtime behavior of the game. The game does not merely swap background audio. It generates a `Song Profile` that drives:

1. crowd density and motion trends
2. action reward windows
3. event timing and mission selection
4. lighting and camera behavior
5. difficulty pacing across the entire run

## Goals

This design must achieve the following outcomes:

1. Make pit survival feel physically stressful but fair.
2. Reward players for understanding hardcore-show etiquette and timing, not for random aggression.
3. Make different songs produce noticeably different crowd behavior and match pacing.
4. Keep the song upload workflow accessible through a lightweight correction pass rather than a heavy editor.
5. Provide a small but convincing first demo that proves the game's feel before content expansion.

## Non-Goals

This design does not include the following in version 1:

1. online song sharing, hosting, or distribution
2. large-scale rights management or commercial music licensing workflows
3. full manual chart-authoring tools comparable to a professional rhythm editor
4. complex character classes or large RPG progression trees
5. a broad collection of venue gimmicks such as stage diving, crowd surfing, or wall-of-death variants in the first demo

## Core Experience

The intended feeling is:

`the room looks out of control, but skilled players realize it has readable structure`

This means the game must consistently create tension between:

1. `music`
   Sections, impacts, pauses, and builds define when the room is about to shift.
2. `space`
   The venue becomes tighter, wider, or more violent depending on current crowd state.
3. `body management`
   The player must preserve stamina and balance while making expressive decisions.
4. `scene awareness`
   The best results come from acting with the crowd's logic, not against it.

## Core Loop

A single run represents one song or one short set segment. The player repeatedly loops through:

1. `hear the section`
   Read the song's current structure and anticipate a state shift.
2. `read the crowd`
   Identify center pressure, edge safety, incoming flow, and likely collision patterns.
3. `choose the right move`
   Decide whether to step, shove, slip, brace, lift, reposition, or commit to style.
4. `take or avoid risk`
   Enter the pit, hold the edge, cross the center line, save someone, or play conservatively.
5. `cash out`
   Survive, gain respect, complete a task, or stabilize in preparation for the next section.

The loop must feel different across sections even when the map remains the same.

## Match Structure

A song should be translated into five gameplay phases:

1. `gather`
   The room forms, pressure builds, and the player learns the crowd's baseline behavior.
2. `probe`
   Small pushes and controlled disorder begin. The player chooses an initial risk posture.
3. `tension build`
   The game signals that a more dangerous state is coming through music, motion, and presentation.
4. `breakout`
   The highest-pressure section, where crowd aggression, mission density, and action opportunity all peak together.
5. `aftermath`
   The room loosens enough for recovery, rescue, repositioning, and emotional release before the next wave.

These macro phases describe the run shape. Individual generated section labels such as `push`, `two-step`, `side-to-side prep`, and `breakdown` are the lower-level semantic states that live inside this overall structure.

Longer play sessions can chain multiple songs into a set, but the first demo should validate the single-song structure first.

## Win, Loss, and Evaluation

The game should use three layers of outcome:

1. `hard failure`
   The player is removed from the pit after being downed and overwhelmed for too long, or completely loses control through combined stamina and balance collapse.
2. `soft failure`
   The player survives but misses key section opportunities, plays off-beat, or behaves in a way that lowers respect.
3. `rating`
   The player receives a post-song evaluation across four axes:
   `Survival`, `Rhythm`, `Presence`, and `Respect`

The final rating should use scene-flavored labels rather than generic letter grades.

## Player Systems

### Core Actions

The initial move set should remain small and legible:

1. `move`
   Core positioning tool used for line selection, edge control, and repositioning.
2. `two-step`
   A timing-sensitive expression move that becomes highly valuable in the right sections.
3. `shove`
   Creates breathing room at close range, but can destabilize the player if used carelessly.
4. `slip`
   A short evasive move used to dodge incoming pressure, cross openings, or avoid lateral surges.
5. `brace`
   A defensive posture that protects balance during dangerous impacts but is low-value in calm moments.
6. `lift`
   Used to recover from a fall or help up a fallen fan, reinforcing scene etiquette.

### Core Stats

The player state should be built around three readable resources:

1. `stamina`
   Governs repeated action usage and recovery pacing.
2. `balance`
   Represents physical control under pressure. When depleted, the player falls.
3. `respect`
   Tracks whether the player is moving with the room's logic and etiquette. It influences scoring and the overall quality of the run.

### Progression Philosophy

Progression should represent better scene understanding, not raw violence. It can grow through:

1. action mastery
2. crowd-reading clarity
3. etiquette-oriented bonuses
4. light build choices centered on survival, style, awareness, or task play

## Crowd Simulation

The crowd should be simulated primarily through local zone behavior rather than individual high-complexity actors.

### Venue Zones

The first venue should expose four readable zones:

1. `center pit`
   The highest-risk area and primary site of major collisions.
2. `pit edge`
   The observation and re-entry band. Safer, but not passive.
3. `front pressure`
   High sustained compression near the stage.
4. `side lanes`
   Transitional space for repositioning and angle changes.

### Zone Parameters

Each zone should vary over time through a small set of shared runtime parameters:

1. `density`
2. `flow direction`
3. `aggression`
4. `recovery rate`
5. `fall risk`

### Section-Driven Behavior

The same venue should feel different from song to song because each section type changes these parameters differently. For example:

1. `two-step section`
   Creates rhythmic openings and style windows inside a still-dangerous crowd state.
2. `side-to-side section`
   Pulls the center open, shifts bodies left and right, then releases a lateral collision.
3. `breakdown section`
   Raises aggression and fall risk sharply while compressing decision time.
4. `recovery section`
   Reduces pressure enough to allow rescue, regrouping, and tactical reset.

## Mission System

The game should generate moment-appropriate objectives rather than relying on fixed scripted tasks.

Mission prompts should be drawn from three pools:

1. `survival missions`
   Examples: remain standing through a high-pressure window, avoid collapse for a duration.
2. `style missions`
   Examples: complete a two-step phrase cleanly, hit an impact window with the right move timing.
3. `live-scene missions`
   Examples: help up a fallen fan, cross the center line during side-to-side, survive inside the center during a breakdown.

The mission generator should read both the current section type and current crowd heat before surfacing tasks.

## Presentation

Presentation must support readability and pressure, not just excitement.

### Visual Direction

The art direction should favor:

1. small and crowded venues
2. low-angle body-heavy framing
3. dirty warm lights, harsh white flashes, and heavy silhouette readability
4. texture emphasis on shoes, shirts, arms, shoulders, sweat, and compression rather than clean hero portraiture

### Camera Direction

The best default camera is a close third-person or over-shoulder view that keeps the player inside the crush.

Camera state should shift with section meaning:

1. gentle instability during normal pressure
2. clearer framing during tension-build moments so players can read what is coming
3. short violent push-in behavior on major breakdown hits
4. lower collapsed framing when the player falls

### Audio Direction

The soundtrack is not enough by itself. The mix should also emphasize:

1. breath
2. cloth movement
3. shoulder and body impacts
4. foot scrape
5. passing shouts and crowd surges

## Song Upload System

### Product Definition

Uploaded songs must produce playable runtime behavior, not just cosmetic variation.

The approved approach is `semi-automatic generation`:

1. the user imports a local song file
2. the system analyzes it and generates a draft `Song Profile`
3. the user corrects only the most important uncertain labels
4. the game uses the resulting profile to drive the entire run

### Supported Input

Version 1 should support local import of:

1. `mp3`
2. `wav`
3. `ogg`

The first version should remain local-first and avoid networked upload, public publishing, or rights-management workflows.

### Audio Preprocessing

The import pipeline should normalize the song before analysis:

1. format normalization
2. loudness normalization
3. obvious silence cleanup
4. waveform and timing preparation for downstream analysis

## Music Analysis Pipeline

The song analysis system should operate in two layers.

### Layer 1: Structural Analysis

This layer extracts raw musical structure:

1. BPM and tempo shifts
2. beat positions
3. bar boundaries
4. energy changes
5. pause and silence detection
6. impact-heavy moments
7. probable section boundaries

### Layer 2: Gameplay Semantics

This layer translates structure into show logic using rules plus confidence values:

1. `gather`
2. `push`
3. `two-step`
4. `side-to-side prep`
5. `breakdown`
6. `recovery`

The system should prefer conservative interpretation. If it is unsure, it should fall back to a generic high-pressure segment rather than misclassifying a section with a strong bespoke behavior.

## Song Profile

The core generated artifact should be a `Song Profile`. It is not just a note chart. It is a runtime show blueprint containing:

1. `beat grid`
2. `section timeline`
3. `energy curve`
4. `impact markers`
5. `crowd directives`
6. `action opportunity windows`
7. `mission candidates`
8. `presentation cues`
9. `difficulty estimate`

This artifact is the contract between song analysis and gameplay runtime.

## Review Pass

The user correction workflow should be intentionally lightweight.

### Editing Philosophy

The user should not be asked to inspect every second of the song. The system should highlight uncertainty and ask for targeted confirmation.

### Default Timeline View

After analysis, the review screen should show:

1. waveform
2. beat and bar guides
3. energy curve
4. generated section blocks
5. low-confidence markers

### Allowed Corrections

Version 1 should expose only four high-value edit types:

1. `section type`
   Re-label a section as push, two-step, side-to-side, breakdown, or recovery.
2. `impact point`
   Insert or move a major hit or drop marker.
3. `chaos intensity`
   Raise or lower the local show intensity for a segment.
4. `special event marker`
   Add lightweight directives such as center open, crowd surge, or side-to-side start.

### Editing Model

The model should be annotation-oriented, not chart-authoring-oriented. Users correct the system's interpretation rather than rebuilding the song manually.

### Guided Review

The system should prioritize low-confidence regions for review, such as:

1. uncertain breakdown labels
2. possible side-to-side preparation
3. beat offset anomalies

### Preview

Every correction should support immediate local preview of the affected segment so the user can validate feel rather than only data.

## Runtime Architecture

The game runtime should be organized around a central `Show Director`.

### Show Director Responsibilities

The `Show Director` reads the active `Song Profile` and current song position, then distributes synchronized state to the rest of the game.

It must control:

1. `crowd state`
   Density, flow, aggression, fall probability, and recovery pressure by zone.
2. `player opportunity`
   Which actions currently receive bonus value or defensive importance.
3. `mission selection`
   Which survival, style, or live-scene tasks fit the current section.
4. `presentation state`
   Lighting patterns, camera push behavior, shake intensity, and atmospheric emphasis.
5. `difficulty guardrails`
   Safety adjustments that preserve readability when song analysis is imperfect.

### Data Flow

The end-to-end data flow should be:

1. local song import
2. preprocessing
3. structural analysis
4. semantic section inference
5. `Song Profile` generation
6. user review pass
7. runtime playback through `Show Director`

## Difficulty Normalization

Songs will vary too much to trust direct one-to-one translation without safeguards. A `Difficulty Normalizer` should adjust gameplay response without altering the music itself.

It may tune:

1. crowd aggression
2. high-pressure duration
3. fall-event frequency
4. action timing generosity
5. mission density

This allows the same song to remain recognizable across multiple difficulty settings while preserving its identity.

## Error Handling and Fallbacks

The system must fail gracefully when song analysis is imperfect.

1. If BPM detection is uncertain, the review pass should prominently surface timing correction.
2. If section classification confidence is low, the system should fall back to general pressure behavior rather than advanced bespoke states.
3. If a special event cannot be inferred confidently, it should be omitted rather than guessed.
4. If import preprocessing fails, the user should receive a clear local error and the song should not enter runtime generation.
5. If a reviewed `Song Profile` becomes inconsistent, validation should block play until section ordering and impact references are repaired.

## Version 1 Demo Scope

The first playable demo should stay intentionally small:

1. `one venue`
   A small indoor room with a visible stage, center pit, edge band, and side lane readability.
2. `one playable role`
   The regular fan only.
3. `six actions`
   Move, two-step, shove, slip, brace, and lift.
4. `three crowd states`
   General pressure, side-to-side, and breakdown explosion.
5. `one short song flow`
   Roughly ninety seconds to two minutes, whether authored or generated from upload.
6. `three dynamic mission patterns`
   One survival-driven, one style-driven, and one rescue or crossing-driven pattern.
7. `basic post-run rating`
   Survival, Rhythm, Presence, and Respect with a scene-flavored overall label.
8. `semi-automatic upload path`
   Enough analysis and review tooling to prove the song-to-show pipeline, even if the first supported profile types are limited.

## Risks

The project is most likely to fail in the following ways:

1. `unreadable chaos`
   If players cannot read crowd trends, the game feels random instead of tense.
2. `weak music coupling`
   If actions do not gain or lose value based on section meaning, the music upload feature loses its reason to exist.
3. `wrong incentives`
   If the scoring model rewards mindless aggression, the game loses its hardcore-scene identity.
4. `editor overload`
   If the review pass becomes too complex, the semi-automatic promise collapses into manual authoring.
5. `presentation overload`
   If camera, shake, lighting, and crowd effects all peak at once without hierarchy, the game becomes exhausting and unreadable.

## Testing Strategy

The design should be validated through three layers of testing:

1. `feel tests`
   Confirm that the core loop is readable and satisfying even with temporary visuals.
2. `generation tests`
   Verify that uploaded songs produce distinct and stable `Song Profile` outputs.
3. `correction tests`
   Confirm that users can repair weak analysis in a short review pass without needing expert tools.

The first milestone is successful if the demo proves three things:

1. acting with the song feels better than acting randomly
2. the crowd appears to change behavior meaningfully across sections
3. a user can import a song, make a few corrections, and quickly get to a playable run

## Next Planning Boundary

This design is intentionally scoped for a first implementation-planning pass. The next planning document should break the work into:

1. core combat and movement prototype
2. crowd zone simulation prototype
3. song import and analysis pipeline
4. review-pass editor shell
5. `Song Profile` runtime and `Show Director`
6. first demo integration and validation milestones
