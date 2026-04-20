# Minority Threat Vertical Slice Design

Date: 2026-04-21
Owner: Codex + Nick
Status: Ready for user review

## Goal

Build a real 30-second playable hardcore vertical slice around a single authored segment of:

`C:\Users\Nick\Desktop\Minority Unit - Minority Threat.mp3`

This slice exists to answer one question quickly and honestly:

`Does a hardcore pit feel fun, legible, and intense when turned into a game loop?`

The slice is not a generic uploader demo, not a profile-authoring tool, and not a full game mode. It is a fixed, hand-authored, high-intensity gameplay segment meant to replace the current systems-prototype feel with something that reads as a real game immediately.

## Problem Statement

The current `pit-game` prototype proves some internal systems, but it does not yet communicate playable value to a player. The main gaps are:

- The scene reads like a debug prototype rather than a venue.
- The player does not have a strong on-screen body or movement identity.
- The crowd is too abstract to communicate mosh pressure and collision trends.
- The song integration feels systemic rather than authored for impact.
- The player cannot quickly understand what to do, what is dangerous, or what feels good.

This slice narrows scope aggressively so the project can validate game feel before investing further in general-purpose authoring or song upload systems.

## Experience Targets

The slice should make these things true:

- Within 10 seconds, a player can tell this is a hardcore show and not a debug sandbox.
- Within 30 seconds, a player feels crowd pressure, reacts to music-driven peaks, and understands that position and timing matter.
- The player can survive by reading flow and using the correct defensive or evasive move at the right time.
- A second or third run feels better than the first because the player starts learning where the danger and opportunity windows are.

The slice should feel dense, physical, dirty, and pressurized rather than flashy or arcade-clean.

## Scope

### In Scope

- One fixed song
- One fixed authored 30-second segment from that song
- One small indoor hardcore venue
- One playable character presentation
- One crowd simulation tuned specifically for this segment
- One authored show timeline that drives pressure, camera, and lighting
- One minimal end-state summary

### Out of Scope

- Generic uploaded-song support
- Automatic audio-to-level generation
- Phase 3 fan authoring tools
- Multiple songs or selectable playlists
- Progression, unlocks, builds, or narrative
- Online features
- Full scoring or mission depth

## Core Loop

The player loop for this slice is:

`Read pressure -> move for space -> commit to the center or edge -> absorb or evade impact -> survive the peak`

This is a survival-forward action slice, not a note-matching rhythm game. Music still drives the experience, but through authored pressure changes rather than direct chart prompts.

The player should succeed by understanding:

- where the pit is about to collapse,
- when to hold ground,
- when to slip out of a line,
- when to shove for breathing room,
- when to accept that the breakdown hit is stronger than their current position.

## Segment Structure

The 30-second slice is divided into three phases.

### 1. Tension In

Length: roughly 4-6 seconds.

Purpose:

- establish venue geography,
- show the crowd beginning to shift,
- give the player a short setup window,
- communicate that a violent peak is imminent.

Behavior:

- crowd density rises,
- lateral movement begins,
- lighting tightens,
- camera settles and starts to load tension.

### 2. Breakdown Peak

Length: roughly 18-20 seconds.

Purpose:

- deliver the core playable fantasy,
- make the crowd feel like a dangerous moving body,
- force repeated use of movement, brace, shove, and slip.

Behavior:

- center pressure spikes,
- edge safety becomes relative rather than absolute,
- lateral crush and surge events happen on authored beats,
- camera punch and lighting hits reinforce the musical impacts.

This phase is the heart of the slice and should consume most implementation attention.

### 3. Aftershock

Length: roughly 4-6 seconds.

Purpose:

- let the player survive the tail of the chaos,
- provide a clean sense of closure,
- make the run feel like a complete moment rather than a cut-off test.

Behavior:

- pressure falls but remains unstable,
- crowd keeps drifting and bumping,
- presentation relaxes without going flat.

## Player Moveset

The playable moveset is intentionally minimal.

### Move

Base repositioning across center, edge, and front-pressure space. Movement exists to find or lose footing, not to explore a map.

### Shove

A short-range force move that makes temporary breathing room. It is not an attack combo; it is a survival and spacing tool.

### Brace

The primary heavy-pressure response. The player plants, protects their body, and trades mobility for impact resistance.

### Slip

A short evasive sidestep used to avoid line collisions and lateral surges. It should feel sharper and more intentional than normal movement.

### Stagger / Fall

The punishment state. Repeated bad positioning or mistimed reactions causes stagger, then knockdown. This is how the game teaches that the crowd is stronger than the player when read badly.

## Crowd Model

The crowd should be represented as readable bodies, not abstract blocks. Intelligence can remain simple as long as group trends are legible.

### Required Behaviors

#### Push Swell

General pressure build and directional compression.

#### Lateral Surge

Short horizontal crush patterns that make slip valuable and make the player read cross-flow.

#### Breakdown Crush

The hardest state. Center aggression spikes, edge pressure rises, and the player feels that the room is closing around them.

### Crowd Design Rules

- The player should be able to see crowd intent before impact.
- The center must feel different from the edge.
- The crowd should not look random; it should look trend-driven.
- Pressure is more important than enemy-like individuality.

## Venue and Presentation

This slice needs a strong venue read with minimal asset scope.

### Venue Requirements

- small indoor room
- visible stage direction
- front-pressure zone near the band
- center pit space
- edge lane for relative safety and repositioning
- grimy floor and low-light atmosphere

### Camera

Use a close overhead or shoulder-high combat-readable view that still shows local crowd shape. Camera behavior should include:

- subtle live motion at rest,
- impact shake on collisions,
- short punch-in on major breakdown hits,
- low collapse angle on falls.

### Lighting

Lighting should be authored to the segment, not fully procedural. Use dirty white, dim amber, red, and harsh flashes to sell venue mood and impact peaks.

### HUD

The HUD should stay minimal:

- stamina,
- balance,
- current phase label when useful.

Anything that feels like a debug panel should be removed from the primary play view.

## Authored Song Integration

This slice does not rely on auto-analysis.

The selected 30-second segment from `Minority Threat.mp3` will be hand-authored into a show timeline. That timeline will explicitly define:

- segment start and end,
- tension-in window,
- center open or close moments,
- lateral surge moments,
- breakdown hit moments,
- aftershock ramp-down.

That authored timeline becomes the single source of truth for:

- crowd aggression,
- zone pressure,
- camera hits,
- lighting changes,
- player opportunity windows.

The goal is to tune by feel, not by extraction accuracy.

## Failure and End State

The slice needs only a minimal completion model.

### Fail Conditions

- the player is knocked down too often,
- the player loses balance completely and cannot recover through the peak,
- the player is effectively consumed by repeated crush states.

### End Summary

At the end of the segment, show a short result such as:

- `Survived`
- `Dropped`
- `Hit Windows`

This summary exists to give closure, not to become a deep metagame.

## Implementation Constraints

To keep the slice real and finishable:

- Prefer strong temporary art direction over incomplete systemic ambition.
- Prefer authored moments over generalized logic.
- Prefer one convincing venue over reusable content frameworks.
- Do not spend slice time on upload flow, profile persistence, or editor UX.

This work should live alongside the current prototype architecture where practical, but it is allowed to bypass generic systems when that is the fastest route to a convincing playable result.

## Testing Strategy

This slice needs both technical verification and feel verification.

### Technical

- build passes,
- automated tests cover authored timeline loading and deterministic event sequencing where applicable,
- the fixed song asset path and demo bootstrap path fail clearly when unavailable.

### Play Validation

The slice is considered successful only if a fresh player can answer yes to most of these:

- Can I tell where I am in the room?
- Can I tell when danger is rising?
- Do my inputs visibly change my survival?
- Does the music peak actually change the crowd and camera?
- Does this feel like a game and not a debug scene?

## Success Criteria

The vertical slice is successful when:

- it visually reads as a hardcore venue and pit,
- the player has a visible body and readable reaction states,
- the crowd creates believable pressure trends,
- the authored segment feels synchronized to the chosen song section,
- the run is short, brutal, and replayable,
- the project gains a trustworthy base for deciding whether to expand back into authoring and upload features later.
