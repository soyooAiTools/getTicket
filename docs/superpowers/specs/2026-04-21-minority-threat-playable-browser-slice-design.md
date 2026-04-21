# Minority Threat Playable Browser Slice Design

Date: 2026-04-21
Owner: Codex + Nick
Status: Ready for user review

## Goal

Turn `apps/pit-game` from a browser-hosted systems prototype into a real playable hardcore game slice that happens to run in the browser.

The target is a single complete `Minority Unit - Minority Threat.mp3` experience with:

- a game-first presentation
- a third-person shoulder camera
- a visible player body with readable animation states
- a physical crowd that creates pressure and impact
- a dirty livehouse venue with authored lighting and camera hits
- a full 30-second run that feels complete, not like a debug scene

This slice exists to answer one concrete question:

`Can a browser-hosted hardcore pit game feel like a real game within 10 seconds and feel genuinely playable within 30 seconds?`

## Problem Statement

The current `pit-game` branch has valuable systems:

- authored `Minority Threat` slice data
- fixed-song runtime control
- crowd pressure logic
- audio gating
- a fallback authoring lab

But it still fails the actual player-facing test. The current experience reads too much like a web prototype and not enough like a game because:

- the presentation hierarchy still feels like an app shell first and a game second
- the player body and crowd bodies are too primitive to sell weight, intent, and collision
- the venue is readable as a prototype space, not a convincing livehouse
- the camera and lighting communicate some information, but not yet enough drama or physicality
- the whole thing proves mechanics without yet delivering a complete feeling run

This design intentionally narrows the project to a single polished, authored, browser-playable vertical slice instead of continuing to broaden generic tooling.

## Product Definition

This project is:

- one fixed-song browser game slice
- one authored 30-second run
- one third-person shoulder-camera pit sequence
- one livehouse venue
- one player avatar
- one crowd behavior set
- one minimal end-state flow

This project is not:

- a generic uploaded-song game
- a profile editor
- a sandbox
- a score-chasing rhythm game
- a reusable content platform

The browser is the delivery surface, not the design identity.

The correct player reaction is:

`This is a game that runs in a browser`

not:

`This is a browser tool with a game prototype inside it`

## Experience Targets

The slice should satisfy these player-facing targets:

### 10-Second Target

Within 10 seconds, the player should understand:

- this is a hardcore livehouse
- I control a body inside the pit
- the room is dangerous
- the camera, crowd, and sound are already creating pressure

### 30-Second Target

Within 30 seconds, the player should experience:

- at least one real surge or crush moment
- at least one meaningful decision between `brace`, `slip`, `shove`, or repositioning
- a readable connection between the song's breakdown energy and the playable danger
- a full start-to-finish run with a result state

### Quality Target

The slice should feel:

- dirty
- compact
- physical
- readable
- mean

It should not feel:

- dashboard-heavy
- arcade-clean
- over-designed
- abstract
- like a level editor demo

## Chosen Approach

### Recommended Approach

Keep the project in the browser and keep `Phaser` as the rendering/runtime engine, but shift the implementation from `systems prototype` to `game-first 2.5D slice`.

This means:

- React remains only the boot and shell layer
- the primary experience becomes a canvas-first game scene
- existing authored slice logic is reused where valid
- the visual presentation is rebuilt around a simulated shoulder-camera framing, depth layering, animated bodies, livehouse dressing, and stronger impact language

### Why This Approach

It preserves the current working authored runtime foundation without paying the cost of a full engine migration, while still allowing the game to stop looking like a tool.

It is the fastest realistic path to:

- a complete 30-second run
- a game-like first impression
- stronger body/crowd/venue presentation
- a browser delivery path that still feels like a real game slice

### Rejected Alternatives

#### 1. Continue polishing the current shell-first prototype

Rejected because it would keep improving systems readability while still failing the core fantasy.

#### 2. Migrate immediately to a full 3D browser stack

Rejected for this phase because it would turn the project into an engine/platform rewrite before proving the actual slice.

## Scope

### In Scope

- one fixed song: `Minority Unit - Minority Threat.mp3`
- one authored 30-second run
- one game-first default entry
- one third-person shoulder-framed playable scene
- one player moveset
- one crowd behavior set tuned to this song segment
- one livehouse environment
- one authored event timeline
- one minimal result flow

### Out of Scope

- multiple songs
- uploaded song support for the primary mode
- generic authoring/editor improvements
- online features
- progression systems
- character customization
- story mode
- advanced scoring systems
- enemy archetypes or combat trees

### Explicit Constraint

No feature may be accepted into this slice if it makes the primary 30-second run less complete or less game-like.

## Primary User Flow

The default app flow should be:

1. land directly on the `Minority Threat` game slice
2. see a game-forward title card and venue framing
3. load the exact song file
4. start the slice
5. play through the authored 30-second sequence
6. receive a short result state
7. restart immediately

The authoring lab remains available, but only as a secondary path behind an explicit mode switch.

The default experience must no longer read like a workspace or editor.

## Core Loop

The playable loop for the slice is:

`Read crowd pressure -> reposition -> commit to survival move -> absorb or evade impact -> hold control through the breakdown`

This is a hybrid of action brawler and music-driven survival:

- during ordinary pressure, the player is solving space, balance, and body control
- during authored peaks, music timing hardens the correct response windows

The player is not matching notes.
The player is surviving and asserting control in a hostile body-space that intensifies with the music.

## Slice Structure

The slice should cover one full 30-second authored run with four phases.

### 1. Walk-In Pressure

Duration: approximately 4 seconds

Purpose:

- establish the player body
- establish stage direction
- establish crowd closeness
- show that the room is already moving

Player feeling:

`I am already inside something unstable.`

### 2. Build

Duration: approximately 6 seconds

Purpose:

- increase compression
- introduce crowd lateral drift
- let the player learn positioning under pressure

Player feeling:

`Something worse is arriving and I need to choose where I stand.`

### 3. Breakdown Peak

Duration: approximately 14 seconds

Purpose:

- deliver the hardest playable section
- force correct use of `brace`, `slip`, and `shove`
- bind authored music hits to gameplay intensity spikes

Player feeling:

`If I panic or mash, I lose. If I read this well, I survive by skill.`

### 4. Aftershock

Duration: approximately 6 seconds

Purpose:

- provide a coherent tail after the peak
- let the player stabilize or finally fail
- land the run as a complete experience

Player feeling:

`I got through it` or `that last wave broke me`.

## Player Character Design

The player must be a visible body, not a marker.

### Camera Framing

The camera should frame the player from a close shoulder-follow angle with enough forward visibility to read:

- the immediate lane ahead
- incoming lateral surge
- stage direction
- the crowd body mass nearest the player

The player should occupy the lower center portion of the frame and remain readable without covering the entire pit.

### Visual Readability

The player silhouette needs:

- a stronger contrast than nearby crowd bodies
- a readable upper-body line for `brace` and `shove`
- visible lower-body movement for `slip`, stumble, and recovery

The player does not need final production art, but the body must look intentional and game-ready rather than like a placeholder rectangle.

## Player Moveset

The slice uses a minimal moveset.

### Active Moves

#### Move

Base locomotion with weight and deceleration. Movement is for line choice and breathing-room control, not free navigation.

#### Brace

The main survival move for forward pressure and authored heavy impacts. It trades mobility for control.

#### Slip

A short evasive side-step used to avoid lateral crushes and line intersections. It is the answer to readable side pressure, not a universal dodge.

#### Shove

A short forceful push used to reclaim a small amount of space or commit into a lane. It should feel risky but useful.

### Passive States

#### Stable

Full control.

#### Stagger

Loss of composure, reduced clarity, brief control instability.

#### Down

Knocked down or collapsed state with low camera, recovery urgency, and high vulnerability.

## Player State Machine

The state machine should be simple and legible:

- `idle`
- `move`
- `brace`
- `slip`
- `shove`
- `stagger`
- `fall`
- `recover`

Transitions should be driven by:

- player input
- local crowd pressure
- authored impact windows
- current balance state

The main design rule is:

`the player should always know whether they are still in control`

This matters more than animation quantity.

## Crowd Model

The crowd is the main opponent, but it should behave like a moving mass instead of a collection of AI enemies.

### Required Behavior Types

#### Push Pressure

Continuous compression and directional pressure that forces positioning choices.

#### Lateral Surge

Short horizontal movement patterns that punish bad line reading and make `slip` necessary.

#### Breakdown Crush

The highest-pressure state. Center danger spikes, edge safety narrows, and the player's room to recover shrinks fast.

### Crowd Readability Rules

- the player must be able to read danger before impact
- center and edge must feel materially different
- crowd movement should look trend-driven, not random
- the crowd should look like bodies with momentum, not blobs or static blockers

## Venue Design

The environment is a small dirty livehouse.

### Required Space Read

- clear stage direction
- low ceiling feel
- front-pressure zone near stage
- pit center
- edge lane
- dirty floor and club clutter

### Dressing Priorities

If visual budget is constrained, prioritize:

1. room scale and ceiling feel
2. stage and barrier readability
3. crowd density and body placement
4. floor wear, cables, and monitor silhouettes
5. secondary details

The venue must feel cramped and hostile before it feels detailed.

## Camera and Presentation Language

### Camera States

#### Follow

Stable shoulder-follow motion at rest.

#### Pressure

Slight compression under rising pressure.

#### Impact

Short camera punch, shake, or push on authored major hits and meaningful collisions.

#### Down

Lower angle and reduced horizon when the player falls.

### Presentation Rule

The camera should be calm enough to preserve readability and violent enough at the right moments to sell impact.

`steady by default, brutal on impact`

## Lighting and Effects

Lighting is authored and tied to the slice timeline.

### Palette

- dirty red
- dim amber
- cold white flash
- deep black-brown shadow

### Lighting Behavior

#### Build

Light pressure increases with darker ambient space and more directional emphasis.

#### Pre-Hit Tightening

Brief visual tightening before major breakdown hits.

#### Breakdown Hit

Hard flash, stronger silhouette read, short camera reinforcement.

#### Aftershock

Reduced intensity without returning to a neutral or safe look.

## Animation Language

Animation should prioritize clarity and body weight.

### Required Player Animation Reads

- move with acceleration and stop weight
- brace with visible shoulder and torso compression
- slip with clear lateral cut
- shove with upper-body commitment
- stagger with broken posture
- fall and recover with urgency

### Crowd Animation Reads

Crowd bodies need only enough animation to communicate:

- weight shift
- directional intent
- impact reaction
- surge flow

The crowd does not need deep per-character animation trees in this phase.

## Music and Timeline Contract

The `Minority Threat` slice is hand-authored. No automatic musical interpretation is used for the primary mode.

The authored timeline should remain the single source of truth for:

- phase boundaries
- impact beats
- crowd aggression shifts
- lateral surge timing
- camera emphasis
- lighting emphasis

### Runtime Contract

The game runtime and audio runtime must obey the same start/end rules:

- the slice does not advance before playback begins
- failed or rejected playback does not start gameplay progression
- the slice ends when the authored segment ends
- the final scene state and result state render immediately on completion

Audio and gameplay must feel like one run, not two loosely related systems.

## UI Strategy

The UI must retreat behind the game.

### Keep

- a minimal title/start layer
- stamina/balance if they remain necessary
- very small phase or result information
- restart affordance

### Remove or Minimize

- debug-like copy
- profile/workbench language on the primary path
- dashboard-style panels
- explanatory text that the scene should be carrying visually

The default screen should feel like a game boot flow, not a web app workspace.

## Failure and Completion

### Failure

The player fails if they lose body control through crush pressure or repeated breakdown punishment.

### Survival

The player survives if they make it through the authored end of the slice with sufficient control.

### Result Screen

The result flow should be short and immediate. It only needs to communicate:

- `Survived` or `Dropped`
- number of downs
- a very small performance summary

The correct behavior is rapid replay, not lingering analysis.

## Technical Architecture

### Overall Structure

The app should split cleanly into:

1. `React boot shell`
   Launch flow, file loading, restart flow, and mode switching.
2. `Authored slice controller`
   Slice lifecycle, running/paused/completed state, and session snapshots.
3. `Game scene runtime`
   Phaser-based render loop for venue, crowd, player, camera, and gameplay feel.
4. `Authored timeline and domain data`
   Fixed-song slice definitions and runtime frame derivation.
5. `Secondary lab mode`
   Existing upload/review prototype, preserved but demoted from primary entry.

### Rendering Strategy

This phase stays in Phaser and uses a 2.5D presentation approach:

- depth-sorted body rendering
- shoulder-framed simulated follow camera
- authored lighting and hit reactions
- body-state-driven sprite or shape animation

The goal is to deliver a convincing playable game slice without replatforming the whole project to a new engine during this phase.

## Error Handling

### File Loading

- wrong file name should produce a clear correction message
- audio readiness should gate start
- failed playback should leave the run idle and recoverable

### Runtime Consistency

- scene should repaint on controller-driven completion or reset
- pausing or hiding secondary modes should not leave hidden runtimes active
- authored slice boundaries should always be enforced

### Product Behavior

The user should never be unsure whether:

- the run has started
- the run is paused
- the run is complete
- the file is valid

## Testing Strategy

The slice needs coverage at three levels.

### Domain and Runtime Tests

- authored slice validity
- phase and impact derivation
- controller start/pause/complete behavior
- session stepping and completion
- audio boundary handling
- scene reaction to controller-driven updates outside the main update loop

### Component Tests

- default game-first shell
- file validation and readiness gating
- start flow
- completion flow
- lab preservation as a secondary mode

### Manual Play Validation

A browser play pass must explicitly confirm:

- the default route looks like a game immediately
- the run does not advance before pressing start
- the run ends at the authored segment boundary
- the crowd feels like pressure, not clutter
- the player body remains readable under impact

## Acceptance Criteria

This slice is successful when:

1. the default entry reads as a game, not a tool
2. the player body, venue, and crowd are all visually present within 10 seconds
3. the 30-second run plays start-to-finish with a coherent arc
4. movement, `brace`, `slip`, and `shove` each have a clear job
5. the breakdown peak feels materially harder than the build
6. audio and gameplay start and stop together
7. the player wants to immediately replay after the result

## Risks and Mitigations

### Risk: It still feels like a web app

Mitigation:

- default to the slice immediately
- minimize shell chrome
- prioritize game camera, body, venue, and start flow over utility UI

### Risk: It looks better but still plays shallow

Mitigation:

- keep the moveset minimal
- focus on pressure, readability, and punish/recover rhythm
- tune the breakdown phase first

### Risk: Shoulder-camera readability collapses in Phaser

Mitigation:

- treat this as a constrained 2.5D presentation, not literal free 3D traversal
- keep local space small
- keep the player anchored in a readable lower-frame position

### Risk: Scope grows back into tooling

Mitigation:

- defer authoring and generic song work entirely
- reject any new feature that does not improve the 30-second run directly

## Non-Negotiable Design Rule

This slice must always choose:

`one complete playable hardcore run`

over:

`a broader but less convincing platform`
