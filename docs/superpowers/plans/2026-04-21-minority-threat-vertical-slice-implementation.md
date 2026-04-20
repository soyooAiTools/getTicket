# Minority Threat Vertical Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a real 30-second playable vertical slice for `Minority Unit - Minority Threat.mp3` with a visible player body, readable crowd pressure, authored breakdown events, and a default app entry that feels like a game instead of a debug tool.

**Architecture:** Keep the existing upload/review prototype intact behind a secondary `lab` entry, but add a dedicated fixed-song slice path that bypasses generic authoring abstractions where needed. The new slice will use a hand-authored fixture, a dedicated slice director/session/controller, a purpose-built Phaser scene, and a small React shell that loads the required local song file and starts the 30-second segment from the authored offset.

**Tech Stack:** TypeScript, React 18, Phaser 3, Vite, Vitest

---

## File Structure

### Create

- `apps/pit-game/src/game/domain/vertical-slice.ts`
  - Fixed-song vertical-slice types, authored phase/event definitions, and fixture validation helpers.
- `apps/pit-game/src/game/domain/vertical-slice.spec.ts`
  - Tests for fixture shape, authored phase coverage, and song-path metadata.
- `apps/pit-game/src/game/domain/vertical-slice-director.ts`
  - Converts authored phases/events into playable frame data: pressure, camera cue, light cue, recommended move.
- `apps/pit-game/src/game/domain/vertical-slice-director.spec.ts`
  - Tests for phase transitions, breakdown event promotion, and recommended-action shifts.
- `apps/pit-game/src/game/fixtures/minority-threat-vertical-slice.ts`
  - The one fixed song fixture with local path metadata, segment offsets, 30-second `SongProfile`, phases, and authored events.
- `apps/pit-game/src/game/runtime/vertical-slice-session.ts`
  - Slice-specific player state, fail/completion rules, and deterministic session stepping.
- `apps/pit-game/src/game/runtime/vertical-slice-session.spec.ts`
  - Tests for survival, collapse, and end-summary outcomes.
- `apps/pit-game/src/game/runtime/vertical-slice-controller.ts`
  - Publish/subscribe controller for the fixed slice runtime.
- `apps/pit-game/src/game/runtime/vertical-slice-scene.ts`
  - Phaser scene for venue rendering, crowd bodies, player body poses, shake, and HUD overlays.
- `apps/pit-game/src/game/runtime/vertical-slice-scene.spec.ts`
  - Tests for pure helper functions exported from the scene file: input resolution, crowd layout, pose styling.
- `apps/pit-game/src/game/runtime/create-vertical-slice-game.ts`
  - Phaser bootstrap for the dedicated slice scene.
- `apps/pit-game/src/game/runtime/vertical-slice-audio.ts`
  - File validation and `HTMLAudioElement` setup for starting the authored segment from the correct original-song offset.
- `apps/pit-game/src/game/runtime/vertical-slice-audio.spec.ts`
  - Tests for filename validation and segment seek behavior.
- `apps/pit-game/src/components/MinorityThreatShell.tsx`
  - React shell for loading the song, showing instructions, mounting the slice runtime, and displaying end-state summary.
- `apps/pit-game/src/components/MinorityThreatShell.spec.ts`
  - Component tests for missing-song messaging, loaded-song ready state, and result-summary rendering.
- `apps/pit-game/src/App.legacy.tsx`
  - Exact copy of the current upload/review prototype app so the old system remains reachable after `App.tsx` is simplified.
- `apps/pit-game/src/components/PrototypeWorkbench.tsx`
  - Extracted current upload/review prototype UI so `App.tsx` can switch between the new slice and the legacy lab.
- `apps/pit-game/src/components/PrototypeWorkbench.spec.ts`
  - Migrated tests that currently exercise the old `App` upload/review flows.

### Modify

- `apps/pit-game/src/App.tsx`
  - Switch default mode to the new fixed-song slice and provide a way to open the legacy lab.
- `apps/pit-game/src/App.spec.ts`
  - Replace the old review-shell assertions with mode-switch coverage for the new top-level app shell.
- `apps/pit-game/src/styles.css`
  - Add layout and visual styles for the new slice shell, venue chrome, result overlay, and mode switcher.

---

### Task 1: Add the authored Minority Threat slice fixture and validation

**Files:**
- Create: `apps/pit-game/src/game/domain/vertical-slice.ts`
- Create: `apps/pit-game/src/game/domain/vertical-slice.spec.ts`
- Create: `apps/pit-game/src/game/fixtures/minority-threat-vertical-slice.ts`

- [ ] **Step 1: Write the failing fixture test**

```ts
import { describe, expect, it } from 'vitest';

import { minorityThreatVerticalSlice } from '../fixtures/minority-threat-vertical-slice';
import { validateVerticalSliceFixture } from './vertical-slice';

describe('minorityThreatVerticalSlice', () => {
  it('defines a single valid 30-second authored slice for Minority Threat', () => {
    expect(minorityThreatVerticalSlice.audio.fileName).toBe('Minority Unit - Minority Threat.mp3');
    expect(minorityThreatVerticalSlice.audio.localPath).toBe(
      'C:/Users/Nick/Desktop/Minority Unit - Minority Threat.mp3',
    );
    expect(minorityThreatVerticalSlice.audio.segmentEndMs - minorityThreatVerticalSlice.audio.segmentStartMs).toBe(30_000);
    expect(minorityThreatVerticalSlice.phases.map((phase) => phase.kind)).toEqual([
      'tension-in',
      'breakdown-peak',
      'aftershock',
    ]);
    expect(validateVerticalSliceFixture(minorityThreatVerticalSlice)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `corepack pnpm --filter pit-game exec vitest run src/game/domain/vertical-slice.spec.ts`

Expected: FAIL with `Cannot find module '../fixtures/minority-threat-vertical-slice'` or `Cannot find module './vertical-slice'`.

- [ ] **Step 3: Write the minimal vertical-slice types and fixture**

```ts
// apps/pit-game/src/game/domain/vertical-slice.ts
import type { ImpactMarker, SongProfile } from './song-profile';

export type VerticalSlicePhaseKind = 'tension-in' | 'breakdown-peak' | 'aftershock';
export type VerticalSliceEventKind = 'crowd-build' | 'lateral-surge' | 'breakdown-hit' | 'aftershock-drop';

export interface VerticalSliceAudioSource {
  artist: string;
  title: string;
  fileName: string;
  localPath: string;
  segmentStartMs: number;
  segmentEndMs: number;
}

export interface VerticalSlicePhase {
  kind: VerticalSlicePhaseKind;
  startMs: number;
  endMs: number;
  intensity: number;
}

export interface VerticalSliceEvent {
  atMs: number;
  kind: VerticalSliceEventKind;
  strength: number;
}

export interface VerticalSliceFixture {
  id: string;
  label: string;
  audio: VerticalSliceAudioSource;
  profile: SongProfile;
  phases: VerticalSlicePhase[];
  events: VerticalSliceEvent[];
}

function validateBoundaries(phases: VerticalSlicePhase[], durationMs: number): string[] {
  const errors: string[] = [];

  if (phases[0]?.startMs !== 0) {
    errors.push('first slice phase must start at 0');
  }

  if (phases[phases.length - 1]?.endMs !== durationMs) {
    errors.push('last slice phase must end at the slice duration');
  }

  for (let index = 0; index < phases.length; index += 1) {
    const current = phases[index];
    const previous = phases[index - 1];

    if (current.startMs >= current.endMs) {
      errors.push(`phase ${index} has a non-positive range`);
    }

    if (previous && previous.endMs !== current.startMs) {
      errors.push(`phase ${index} must start when phase ${index - 1} ends`);
    }
  }

  return errors;
}

export function createSliceImpact(kind: VerticalSliceEventKind, atMs: number): ImpactMarker {
  return {
    atMs,
    strength: kind === 'breakdown-hit' ? 'drop' : kind === 'aftershock-drop' ? 'accent' : 'hit',
  };
}

export function validateVerticalSliceFixture(fixture: VerticalSliceFixture): string[] {
  const errors = validateBoundaries(fixture.phases, fixture.profile.durationMs);

  if (fixture.audio.segmentEndMs - fixture.audio.segmentStartMs !== fixture.profile.durationMs) {
    errors.push('audio segment duration must match the profile duration');
  }

  if (fixture.events.length === 0) {
    errors.push('slice must contain authored events');
  }

  return errors;
}
```

```ts
// apps/pit-game/src/game/fixtures/minority-threat-vertical-slice.ts
import type { SongProfile } from '../domain/song-profile';
import { createSliceImpact, type VerticalSliceFixture } from '../domain/vertical-slice';

const beatMs = 60_000 / 176;
const profile: SongProfile = {
  id: 'minority-threat-slice',
  title: 'Minority Threat',
  durationMs: 30_000,
  bpm: 176,
  beatGridMs: Array.from({ length: 89 }, (_, index) => Math.round(index * beatMs)),
  sections: [
    { kind: 'push', startMs: 0, endMs: 5_000, confidence: 1, chaos: 0.46 },
    { kind: 'side-to-side prep', startMs: 5_000, endMs: 9_000, confidence: 1, chaos: 0.72 },
    { kind: 'breakdown', startMs: 9_000, endMs: 24_000, confidence: 1, chaos: 0.98 },
    { kind: 'recovery', startMs: 24_000, endMs: 30_000, confidence: 1, chaos: 0.42 },
  ],
  impacts: [
    createSliceImpact('crowd-build', 3_000),
    createSliceImpact('lateral-surge', 7_500),
    createSliceImpact('breakdown-hit', 9_000),
    createSliceImpact('breakdown-hit', 15_000),
    createSliceImpact('aftershock-drop', 24_000),
  ],
};

export const minorityThreatVerticalSlice: VerticalSliceFixture = {
  id: 'minority-threat-vertical-slice',
  label: 'Minority Threat Vertical Slice',
  audio: {
    artist: 'Minority Unit',
    title: 'Minority Threat',
    fileName: 'Minority Unit - Minority Threat.mp3',
    localPath: 'C:/Users/Nick/Desktop/Minority Unit - Minority Threat.mp3',
    segmentStartMs: 46_000,
    segmentEndMs: 76_000,
  },
  profile,
  phases: [
    { kind: 'tension-in', startMs: 0, endMs: 6_000, intensity: 0.44 },
    { kind: 'breakdown-peak', startMs: 6_000, endMs: 24_000, intensity: 1 },
    { kind: 'aftershock', startMs: 24_000, endMs: 30_000, intensity: 0.5 },
  ],
  events: [
    { atMs: 3_000, kind: 'crowd-build', strength: 0.58 },
    { atMs: 7_500, kind: 'lateral-surge', strength: 0.82 },
    { atMs: 9_000, kind: 'breakdown-hit', strength: 1 },
    { atMs: 15_000, kind: 'breakdown-hit', strength: 0.92 },
    { atMs: 24_000, kind: 'aftershock-drop', strength: 0.64 },
  ],
};
```

- [ ] **Step 4: Run the fixture test to verify it passes**

Run: `corepack pnpm --filter pit-game exec vitest run src/game/domain/vertical-slice.spec.ts`

Expected: PASS with `1 passed`.

- [ ] **Step 5: Commit**

```bash
git add apps/pit-game/src/game/domain/vertical-slice.ts apps/pit-game/src/game/domain/vertical-slice.spec.ts apps/pit-game/src/game/fixtures/minority-threat-vertical-slice.ts
git commit -m "feat: add minority threat vertical slice fixture"
```

### Task 2: Add the authored slice director, session rules, and controller

**Files:**
- Create: `apps/pit-game/src/game/domain/vertical-slice-director.ts`
- Create: `apps/pit-game/src/game/domain/vertical-slice-director.spec.ts`
- Create: `apps/pit-game/src/game/runtime/vertical-slice-session.ts`
- Create: `apps/pit-game/src/game/runtime/vertical-slice-session.spec.ts`
- Create: `apps/pit-game/src/game/runtime/vertical-slice-controller.ts`

- [ ] **Step 1: Write the failing director and session tests**

```ts
import { describe, expect, it } from 'vitest';

import { minorityThreatVerticalSlice } from '../fixtures/minority-threat-vertical-slice';
import { createVerticalSliceFrame } from './vertical-slice-director';
import { createVerticalSliceSession, stepVerticalSliceSession } from '../runtime/vertical-slice-session';

describe('createVerticalSliceFrame', () => {
  it('promotes authored breakdown hits into the strongest pressure frame', () => {
    const frame = createVerticalSliceFrame(minorityThreatVerticalSlice, 9_000);

    expect(frame.phase.kind).toBe('breakdown-peak');
    expect(frame.event?.kind).toBe('breakdown-hit');
    expect(frame.zonePressure.center).toBeGreaterThan(frame.zonePressure.edge);
    expect(frame.recommendedAction).toBe('brace');
    expect(frame.cameraCue).toBe('punch');
  });
});

describe('vertical slice session', () => {
  it('fails when the player idles through the breakdown peak', () => {
    let session = createVerticalSliceSession(minorityThreatVerticalSlice);

    for (let index = 0; index < 30; index += 1) {
      session = stepVerticalSliceSession(session, { action: 'idle', targetZone: 'center' }, 1_000);
      if (session.failed) {
        break;
      }
    }

    expect(session.failed).toBe(true);
    expect(session.summary?.label).toBe('Dropped');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `corepack pnpm --filter pit-game exec vitest run src/game/domain/vertical-slice-director.spec.ts src/game/runtime/vertical-slice-session.spec.ts`

Expected: FAIL with missing-module errors for the new director or session files.

- [ ] **Step 3: Implement the director, session, and controller**

```ts
// apps/pit-game/src/game/domain/vertical-slice-director.ts
import type { VerticalSliceEvent, VerticalSliceFixture, VerticalSlicePhase } from './vertical-slice';

export type SliceRecommendedAction = 'move' | 'shove' | 'brace' | 'slip';
export type SliceCameraCue = 'steady' | 'build' | 'punch' | 'collapse';
export type SliceLightCue = 'room' | 'tension' | 'hit' | 'aftershock';

export interface VerticalSliceFrame {
  phase: VerticalSlicePhase;
  event: VerticalSliceEvent | null;
  zonePressure: {
    front: number;
    center: number;
    edge: number;
    side: number;
  };
  recommendedAction: SliceRecommendedAction;
  cameraCue: SliceCameraCue;
  lightCue: SliceLightCue;
}

function findPhase(fixture: VerticalSliceFixture, atMs: number): VerticalSlicePhase {
  const phase = fixture.phases.find((candidate) => atMs >= candidate.startMs && atMs < candidate.endMs);

  if (!phase) {
    throw new Error(`No slice phase found for ${atMs}`);
  }

  return phase;
}

function findEvent(fixture: VerticalSliceFixture, atMs: number): VerticalSliceEvent | null {
  return fixture.events.find((event) => Math.abs(event.atMs - atMs) <= 250) ?? null;
}

export function createVerticalSliceFrame(fixture: VerticalSliceFixture, atMs: number): VerticalSliceFrame {
  const phase = findPhase(fixture, atMs);
  const event = findEvent(fixture, atMs);

  if (event?.kind === 'breakdown-hit') {
    return {
      phase,
      event,
      zonePressure: { front: 88, center: 100, edge: 74, side: 78 },
      recommendedAction: 'brace',
      cameraCue: 'punch',
      lightCue: 'hit',
    };
  }

  if (phase.kind === 'tension-in') {
    return {
      phase,
      event,
      zonePressure: { front: 50, center: 58, edge: 30, side: 36 },
      recommendedAction: 'move',
      cameraCue: 'build',
      lightCue: 'tension',
    };
  }

  if (phase.kind === 'breakdown-peak') {
    return {
      phase,
      event,
      zonePressure: { front: 82, center: 92, edge: 66, side: 72 },
      recommendedAction: event?.kind === 'lateral-surge' ? 'slip' : 'brace',
      cameraCue: event?.kind === 'lateral-surge' ? 'build' : 'steady',
      lightCue: 'tension',
    };
  }

  return {
    phase,
    event,
    zonePressure: { front: 54, center: 62, edge: 34, side: 42 },
    recommendedAction: 'shove',
    cameraCue: 'steady',
    lightCue: 'aftershock',
  };
}
```

```ts
// apps/pit-game/src/game/runtime/vertical-slice-session.ts
import { createVerticalSliceFrame, type SliceRecommendedAction, type VerticalSliceFrame } from '../domain/vertical-slice-director';
import type { VerticalSliceFixture } from '../domain/vertical-slice';

export type VerticalSliceZone = 'front' | 'center' | 'edge' | 'side';
export type VerticalSliceAction = 'idle' | 'move' | 'shove' | 'brace' | 'slip';

export interface VerticalSliceInput {
  action: VerticalSliceAction;
  targetZone: VerticalSliceZone;
}

export interface VerticalSlicePlayerState {
  zone: VerticalSliceZone;
  stamina: number;
  balance: number;
  pose: 'move' | 'shove' | 'brace' | 'slip' | 'stagger' | 'fall';
  status: 'upright' | 'staggered' | 'down';
}

export interface VerticalSliceSummary {
  label: 'Survived' | 'Dropped';
  downCount: number;
  hitWindows: number;
}

export interface VerticalSliceSession {
  fixture: VerticalSliceFixture;
  elapsedMs: number;
  frame: VerticalSliceFrame;
  player: VerticalSlicePlayerState;
  failed: boolean;
  completed: boolean;
  summary: VerticalSliceSummary | null;
  downCount: number;
  hitWindows: number;
}

function createPlayer(): VerticalSlicePlayerState {
  return {
    zone: 'edge',
    stamina: 100,
    balance: 100,
    pose: 'move',
    status: 'upright',
  };
}

function scoreActionMatch(frame: VerticalSliceFrame, action: VerticalSliceAction): boolean {
  return (
    (frame.recommendedAction === 'move' && action === 'move') ||
    (frame.recommendedAction === 'shove' && action === 'shove') ||
    (frame.recommendedAction === 'brace' && action === 'brace') ||
    (frame.recommendedAction === 'slip' && action === 'slip')
  );
}

function poseForAction(action: VerticalSliceAction, balance: number): VerticalSlicePlayerState['pose'] {
  if (balance <= 0) {
    return 'fall';
  }

  if (balance <= 18) {
    return 'stagger';
  }

  if (action === 'brace' || action === 'slip' || action === 'shove') {
    return action;
  }

  return 'move';
}

export function createVerticalSliceSession(fixture: VerticalSliceFixture): VerticalSliceSession {
  const frame = createVerticalSliceFrame(fixture, 0);

  return {
    fixture,
    elapsedMs: 0,
    frame,
    player: createPlayer(),
    failed: false,
    completed: false,
    summary: null,
    downCount: 0,
    hitWindows: 0,
  };
}

export function stepVerticalSliceSession(
  session: VerticalSliceSession,
  input: VerticalSliceInput,
  dtMs: number,
): VerticalSliceSession {
  if (session.failed || session.completed) {
    return session;
  }

  const elapsedMs = Math.min(session.fixture.profile.durationMs, session.elapsedMs + dtMs);
  const frame = createVerticalSliceFrame(session.fixture, Math.min(elapsedMs, session.fixture.profile.durationMs - 1));
  const seconds = dtMs / 1_000;
  const pressure = frame.zonePressure[input.targetZone] * seconds * 0.32;
  const mitigation =
    input.action === 'brace' ? 18 * seconds : input.action === 'slip' ? 14 * seconds : input.action === 'shove' ? 8 * seconds : 0;
  const balance = Math.max(0, session.player.balance - Math.max(0, pressure - mitigation));
  const stamina = Math.max(0, session.player.stamina - (input.action === 'idle' ? 8 : 16) * seconds);
  const failed = balance === 0;
  const completed = !failed && elapsedMs >= session.fixture.profile.durationMs;
  const hitWindows = session.hitWindows + (scoreActionMatch(frame, input.action) ? 1 : 0);
  const downCount = session.downCount + (failed ? 1 : 0);

  return {
    ...session,
    elapsedMs,
    frame,
    player: {
      zone: input.targetZone,
      stamina,
      balance,
      pose: poseForAction(input.action, balance),
      status: failed ? 'down' : balance <= 18 ? 'staggered' : 'upright',
    },
    failed,
    completed,
    downCount,
    hitWindows,
    summary:
      failed || completed
        ? {
            label: failed ? 'Dropped' : 'Survived',
            downCount,
            hitWindows,
          }
        : null,
  };
}
```

```ts
// apps/pit-game/src/game/runtime/vertical-slice-controller.ts
import type { VerticalSliceFixture } from '../domain/vertical-slice';
import type { VerticalSliceInput, VerticalSliceSession } from './vertical-slice-session';
import { createVerticalSliceSession, stepVerticalSliceSession } from './vertical-slice-session';

export interface VerticalSliceController {
  subscribe(listener: (session: VerticalSliceSession) => void): () => void;
  getSnapshot(): VerticalSliceSession;
  step(input: VerticalSliceInput, dtMs: number): void;
  reset(): void;
}

export function createVerticalSliceController(fixture: VerticalSliceFixture): VerticalSliceController {
  let snapshot = createVerticalSliceSession(fixture);
  const listeners = new Set<(session: VerticalSliceSession) => void>();

  function publish() {
    listeners.forEach((listener) => listener(snapshot));
  }

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot() {
      return snapshot;
    },
    step(input, dtMs) {
      snapshot = stepVerticalSliceSession(snapshot, input, dtMs);
      publish();
    },
    reset() {
      snapshot = createVerticalSliceSession(fixture);
      publish();
    },
  };
}
```

- [ ] **Step 4: Run the new tests to verify they pass**

Run: `corepack pnpm --filter pit-game exec vitest run src/game/domain/vertical-slice-director.spec.ts src/game/runtime/vertical-slice-session.spec.ts`

Expected: PASS with both spec files green.

- [ ] **Step 5: Commit**

```bash
git add apps/pit-game/src/game/domain/vertical-slice-director.ts apps/pit-game/src/game/domain/vertical-slice-director.spec.ts apps/pit-game/src/game/runtime/vertical-slice-session.ts apps/pit-game/src/game/runtime/vertical-slice-session.spec.ts apps/pit-game/src/game/runtime/vertical-slice-controller.ts
git commit -m "feat: add minority threat slice runtime core"
```

### Task 3: Build the Phaser venue scene with crowd bodies, player poses, and impact cues

**Files:**
- Create: `apps/pit-game/src/game/runtime/vertical-slice-scene.ts`
- Create: `apps/pit-game/src/game/runtime/vertical-slice-scene.spec.ts`
- Create: `apps/pit-game/src/game/runtime/create-vertical-slice-game.ts`

- [ ] **Step 1: Write failing tests for the scene helper functions**

```ts
import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Scene: class {},
  },
}));

import { minorityThreatVerticalSlice } from '../fixtures/minority-threat-vertical-slice';
import { createVerticalSliceFrame } from '../domain/vertical-slice-director';
import { buildCrowdBodyLayout, resolveSliceInput, resolvePlayerPoseStyle } from './vertical-slice-scene';

describe('vertical slice scene helpers', () => {
  it('resolves keyboard state into one action and one zone', () => {
    expect(
      resolveSliceInput(
        {
          shove: false,
          brace: true,
          slip: false,
          move: false,
          front: false,
          center: true,
          edge: false,
          side: false,
        },
        'edge',
      ),
    ).toEqual({
      action: 'brace',
      targetZone: 'center',
    });
  });

  it('creates a dense center-body layout during the peak', () => {
    const frame = createVerticalSliceFrame(minorityThreatVerticalSlice, 9_000);
    const bodies = buildCrowdBodyLayout(frame);

    expect(bodies.length).toBeGreaterThanOrEqual(18);
    expect(bodies.filter((body) => body.zone === 'center').length).toBeGreaterThan(
      bodies.filter((body) => body.zone === 'edge').length,
    );
  });

  it('switches player styling when entering brace pose', () => {
    expect(resolvePlayerPoseStyle({ pose: 'brace', status: 'upright' })).toMatchObject({
      fillColor: 0xf6d59c,
      scaleY: 0.82,
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `corepack pnpm --filter pit-game exec vitest run src/game/runtime/vertical-slice-scene.spec.ts`

Expected: FAIL with missing exports from `vertical-slice-scene.ts`.

- [ ] **Step 3: Implement the scene helpers and the actual Phaser scene**

```ts
// apps/pit-game/src/game/runtime/vertical-slice-scene.ts
import Phaser from 'phaser';

import type { VerticalSliceFrame } from '../domain/vertical-slice-director';
import type { VerticalSliceController } from './vertical-slice-controller';
import type { VerticalSliceAction, VerticalSliceInput, VerticalSliceZone } from './vertical-slice-session';

export interface SliceControlState {
  move: boolean;
  shove: boolean;
  brace: boolean;
  slip: boolean;
  front: boolean;
  center: boolean;
  edge: boolean;
  side: boolean;
}

export interface CrowdBodyVisual {
  zone: VerticalSliceZone;
  x: number;
  y: number;
  tint: number;
  scale: number;
}

export function resolveSliceInput(state: SliceControlState, currentZone: VerticalSliceZone): VerticalSliceInput {
  const targetZone = state.front ? 'front' : state.center ? 'center' : state.side ? 'side' : state.edge ? 'edge' : currentZone;
  const action: VerticalSliceAction = state.brace ? 'brace' : state.slip ? 'slip' : state.shove ? 'shove' : state.move ? 'move' : 'idle';

  return { action, targetZone };
}

export function buildCrowdBodyLayout(frame: VerticalSliceFrame): CrowdBodyVisual[] {
  const centerCount = Math.max(8, Math.round(frame.zonePressure.center / 6));
  const edgeCount = Math.max(4, Math.round(frame.zonePressure.edge / 12));
  const sideCount = Math.max(3, Math.round(frame.zonePressure.side / 14));

  const centerBodies = Array.from({ length: centerCount }, (_, index) => ({
    zone: 'center' as const,
    x: 450 + (index % 6) * 58,
    y: 320 + Math.floor(index / 6) * 60,
    tint: 0x8a3d31,
    scale: 1,
  }));
  const edgeBodies = Array.from({ length: edgeCount }, (_, index) => ({
    zone: 'edge' as const,
    x: 220 + index * 88,
    y: 595,
    tint: 0x59342c,
    scale: 0.96,
  }));
  const sideBodies = Array.from({ length: sideCount * 2 }, (_, index) => ({
    zone: 'side' as const,
    x: index < sideCount ? 180 : 1_010,
    y: 310 + (index % sideCount) * 72,
    tint: 0x6b4137,
    scale: 0.94,
  }));

  return [...centerBodies, ...edgeBodies, ...sideBodies];
}

export function resolvePlayerPoseStyle(player: Pick<import('./vertical-slice-session').VerticalSlicePlayerState, 'pose' | 'status'>) {
  if (player.status === 'down') {
    return { fillColor: 0x7f5a49, scaleX: 1.18, scaleY: 0.48, angle: 88 };
  }

  if (player.pose === 'brace') {
    return { fillColor: 0xf6d59c, scaleX: 0.96, scaleY: 0.82, angle: 0 };
  }

  if (player.pose === 'slip') {
    return { fillColor: 0xf6d59c, scaleX: 1.18, scaleY: 0.86, angle: -18 };
  }

  if (player.pose === 'shove') {
    return { fillColor: 0xf1c485, scaleX: 1.08, scaleY: 0.92, angle: 12 };
  }

  if (player.pose === 'stagger') {
    return { fillColor: 0xd28f72, scaleX: 1.02, scaleY: 0.88, angle: 14 };
  }

  return { fillColor: 0xf9e4ba, scaleX: 1, scaleY: 1, angle: 0 };
}

export function buildVerticalSliceScene(controller: VerticalSliceController) {
  return class VerticalSliceScene extends Phaser.Scene {
    private selectedZone: VerticalSliceZone = 'edge';
    private controls!: Record<keyof SliceControlState, Phaser.Input.Keyboard.Key>;
    private playerBody!: Phaser.GameObjects.Rectangle;
    private crowdBodies: Phaser.GameObjects.Rectangle[] = [];
    private sectionText!: Phaser.GameObjects.Text;
    private summaryText!: Phaser.GameObjects.Text;

    create() {
      this.add.rectangle(640, 360, 1_280, 720, 0x070606);
      this.add.rectangle(640, 112, 1_040, 136, 0x0e0909);
      this.add.rectangle(640, 152, 920, 54, 0x171010);
      this.add.rectangle(640, 260, 1_020, 10, 0xdec38d, 0.22);
      this.add.rectangle(640, 442, 840, 380, 0x1a0f0d, 0.7);
      this.add.rectangle(640, 645, 1_050, 82, 0x130e0d, 0.9);

      this.sectionText = this.add.text(44, 42, '', {
        fontFamily: 'Segoe UI, sans-serif',
        fontSize: '28px',
        color: '#f5e5c2',
      });
      this.summaryText = this.add.text(44, 78, '', {
        fontFamily: 'Segoe UI, sans-serif',
        fontSize: '18px',
        color: '#f5d0b8',
      });

      this.playerBody = this.add.rectangle(360, 590, 32, 60, 0xf9e4ba);

      this.controls = {
        move: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
        shove: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
        brace: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.F),
        slip: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        front: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
        center: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN),
        edge: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
        side: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
      };
    }

    update(_time: number, delta: number) {
      const input = resolveSliceInput(
        {
          move: this.controls.move.isDown,
          shove: this.controls.shove.isDown,
          brace: this.controls.brace.isDown,
          slip: this.controls.slip.isDown,
          front: this.controls.front.isDown,
          center: this.controls.center.isDown,
          edge: this.controls.edge.isDown,
          side: this.controls.side.isDown,
        },
        this.selectedZone,
      );
      this.selectedZone = input.targetZone;
      controller.step(input, delta);

      const snapshot = controller.getSnapshot();
      const bodies = buildCrowdBodyLayout(snapshot.frame);

      if (this.crowdBodies.length !== bodies.length) {
        this.crowdBodies.forEach((body) => body.destroy());
        this.crowdBodies = bodies.map(() => this.add.rectangle(0, 0, 28, 54, 0xffffff, 0.86));
      }

      bodies.forEach((body, index) => {
        const sprite = this.crowdBodies[index];
        sprite.setPosition(body.x, body.y);
        sprite.setFillStyle(body.tint);
        sprite.setScale(body.scale, 1.02);
      });

      const pose = resolvePlayerPoseStyle(snapshot.player);
      this.playerBody.setPosition(
        snapshot.player.zone === 'front' ? 640 : snapshot.player.zone === 'center' ? 640 : snapshot.player.zone === 'side' ? 188 : 360,
        snapshot.player.zone === 'front' ? 270 : snapshot.player.zone === 'center' ? 470 : snapshot.player.zone === 'side' ? 420 : 612,
      );
      this.playerBody.setFillStyle(pose.fillColor);
      this.playerBody.setScale(pose.scaleX, pose.scaleY);
      this.playerBody.setAngle(pose.angle);

      if (snapshot.frame.cameraCue === 'punch') {
        this.cameras.main.shake(90, 0.0075, true);
        this.cameras.main.zoomTo(1.035, 90);
      }

      this.sectionText.setText(snapshot.frame.phase.kind.toUpperCase());
      this.summaryText.setText(
        snapshot.summary
          ? `${snapshot.summary.label}  Down ${snapshot.summary.downCount}  Hits ${snapshot.summary.hitWindows}`
          : `Balance ${Math.round(snapshot.player.balance)}  Stamina ${Math.round(snapshot.player.stamina)}`,
      );
    }
  };
}
```

```ts
// apps/pit-game/src/game/runtime/create-vertical-slice-game.ts
import Phaser from 'phaser';

import type { VerticalSliceController } from './vertical-slice-controller';
import { buildVerticalSliceScene } from './vertical-slice-scene';

export function createVerticalSliceGame(container: HTMLElement, controller: VerticalSliceController) {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent: container,
    width: 1_280,
    height: 720,
    backgroundColor: '#060505',
    scene: [buildVerticalSliceScene(controller)],
  });
}
```

- [ ] **Step 4: Run the scene helper tests**

Run: `corepack pnpm --filter pit-game exec vitest run src/game/runtime/vertical-slice-scene.spec.ts`

Expected: PASS with the helper assertions green.

- [ ] **Step 5: Commit**

```bash
git add apps/pit-game/src/game/runtime/vertical-slice-scene.ts apps/pit-game/src/game/runtime/vertical-slice-scene.spec.ts apps/pit-game/src/game/runtime/create-vertical-slice-game.ts
git commit -m "feat: render minority threat slice scene"
```

### Task 4: Build the React shell and local-song audio bootstrap

**Files:**
- Create: `apps/pit-game/src/game/runtime/vertical-slice-audio.ts`
- Create: `apps/pit-game/src/game/runtime/vertical-slice-audio.spec.ts`
- Create: `apps/pit-game/src/components/MinorityThreatShell.tsx`
- Create: `apps/pit-game/src/components/MinorityThreatShell.spec.ts`

- [ ] **Step 1: Write the failing tests for audio validation and the shell**

```ts
import { describe, expect, it } from 'vitest';

import { minorityThreatVerticalSlice } from '../game/fixtures/minority-threat-vertical-slice';
import { validateMinorityThreatFile } from '../game/runtime/vertical-slice-audio';

describe('validateMinorityThreatFile', () => {
  it('accepts only the target song file name', () => {
    expect(validateMinorityThreatFile(new File(['x'], 'Minority Unit - Minority Threat.mp3'))).toBeNull();
    expect(validateMinorityThreatFile(new File(['x'], 'wrong-song.mp3'))).toBe(
      'Load the exact song file: Minority Unit - Minority Threat.mp3',
    );
  });
});
```

```ts
// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MinorityThreatShell } from './MinorityThreatShell';

vi.mock('../game/runtime/create-vertical-slice-game', () => ({
  createVerticalSliceGame: () => ({
    destroy() {
      return undefined;
    },
  }),
}));

function renderShell() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(createElement(MinorityThreatShell));
  });

  return {
    container,
    unmount() {
      act(() => root.unmount());
      container.remove();
    },
  };
}

describe('MinorityThreatShell', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('shows the exact song path before the file is loaded', () => {
    const view = renderShell();

    expect(view.container.textContent).toContain('Minority Unit - Minority Threat.mp3');
    expect(view.container.textContent).toContain('C:/Users/Nick/Desktop/Minority Unit - Minority Threat.mp3');
    expect(view.container.textContent).toContain('Load the song file to start the slice.');

    view.unmount();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `corepack pnpm --filter pit-game exec vitest run src/game/runtime/vertical-slice-audio.spec.ts src/components/MinorityThreatShell.spec.ts`

Expected: FAIL with missing modules for the new audio helper or shell component.

- [ ] **Step 3: Implement audio bootstrap and the new shell**

```ts
// apps/pit-game/src/game/runtime/vertical-slice-audio.ts
import type { VerticalSliceAudioSource } from '../domain/vertical-slice';

const expectedFileName = 'Minority Unit - Minority Threat.mp3';

export function validateMinorityThreatFile(file: File): string | null {
  return file.name === expectedFileName
    ? null
    : `Load the exact song file: ${expectedFileName}`;
}

export function buildSliceAudioElement(source: VerticalSliceAudioSource, objectUrl: string): HTMLAudioElement {
  const audio = new Audio(objectUrl);
  audio.preload = 'auto';
  audio.currentTime = source.segmentStartMs / 1_000;
  return audio;
}
```

```tsx
// apps/pit-game/src/components/MinorityThreatShell.tsx
import { startTransition, useEffect, useRef, useState } from 'react';

import { minorityThreatVerticalSlice } from '../game/fixtures/minority-threat-vertical-slice';
import { buildSliceAudioElement, validateMinorityThreatFile } from '../game/runtime/vertical-slice-audio';
import { createVerticalSliceController } from '../game/runtime/vertical-slice-controller';

export function MinorityThreatShell() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const controllerRef = useRef(createVerticalSliceController(minorityThreatVerticalSlice));
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ownedUrlRef = useRef<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadedFileName, setLoadedFileName] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

  useEffect(() => {
    if (!mountRef.current) {
      return;
    }

    let alive = true;
    let cleanup: (() => void) | undefined;

    void import('../game/runtime/create-vertical-slice-game').then(({ createVerticalSliceGame }) => {
      if (!alive || !mountRef.current) {
        return;
      }

      const game = createVerticalSliceGame(mountRef.current, controllerRef.current);
      cleanup = () => game.destroy(true);
    });

    const unsubscribe = controllerRef.current.subscribe((session) => {
      startTransition(() => {
        setSummary(session.summary ? `${session.summary.label} · Down ${session.summary.downCount} · Hits ${session.summary.hitWindows}` : null);
      });
    });

    return () => {
      alive = false;
      unsubscribe();
      cleanup?.();

      if (ownedUrlRef.current) {
        URL.revokeObjectURL(ownedUrlRef.current);
      }
    };
  }, []);

  return (
    <section className='minority-shell'>
      <header className='minority-shell__copy'>
        <p className='minority-shell__eyebrow'>Minority Threat Vertical Slice</p>
        <h1>30 seconds of authored pit violence</h1>
        <p>Load the song file to start the slice.</p>
        <p>{minorityThreatVerticalSlice.audio.localPath}</p>
        {loadedFileName ? <p>Loaded: {loadedFileName}</p> : null}
        {error ? <p className='minority-shell__error'>{error}</p> : null}
        {summary ? <p className='minority-shell__summary'>{summary}</p> : null}
      </header>

      <div className='minority-shell__actions'>
        <button type='button' className='form-control' onClick={() => fileInputRef.current?.click()}>
          Load Minority Threat.mp3
        </button>
        <button
          type='button'
          className='form-control form-control--primary'
          disabled={!loadedFileName}
          onClick={() => {
            controllerRef.current.reset();
            audioRef.current?.pause();
            if (audioRef.current) {
              audioRef.current.currentTime = minorityThreatVerticalSlice.audio.segmentStartMs / 1_000;
              void audioRef.current.play();
            }
          }}
        >
          Start Slice
        </button>
        <p>Controls: A slip, S move, D shove, F brace, arrows change your lane.</p>
      </div>

      <input
        ref={fileInputRef}
        hidden
        type='file'
        accept='.mp3,.wav,.ogg'
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) {
            return;
          }

          const validationError = validateMinorityThreatFile(file);
          if (validationError) {
            setError(validationError);
            event.currentTarget.value = '';
            return;
          }

          if (ownedUrlRef.current) {
            URL.revokeObjectURL(ownedUrlRef.current);
          }

          const nextUrl = URL.createObjectURL(file);
          ownedUrlRef.current = nextUrl;
          audioRef.current = buildSliceAudioElement(minorityThreatVerticalSlice.audio, nextUrl);
          setLoadedFileName(file.name);
          setError(null);
          event.currentTarget.value = '';
        }}
      />

      <div ref={mountRef} className='minority-shell__mount' />
    </section>
  );
}
```

- [ ] **Step 4: Run the new audio and shell tests**

Run: `corepack pnpm --filter pit-game exec vitest run src/game/runtime/vertical-slice-audio.spec.ts src/components/MinorityThreatShell.spec.ts`

Expected: PASS with the filename guard and shell copy assertions green.

- [ ] **Step 5: Commit**

```bash
git add apps/pit-game/src/game/runtime/vertical-slice-audio.ts apps/pit-game/src/game/runtime/vertical-slice-audio.spec.ts apps/pit-game/src/components/MinorityThreatShell.tsx apps/pit-game/src/components/MinorityThreatShell.spec.ts
git commit -m "feat: add minority threat slice shell"
```

### Task 5: Make the new slice the default app entry and preserve the old prototype as a lab

**Files:**
- Create: `apps/pit-game/src/App.legacy.tsx`
- Create: `apps/pit-game/src/components/PrototypeWorkbench.tsx`
- Create: `apps/pit-game/src/components/PrototypeWorkbench.spec.ts`
- Modify: `apps/pit-game/src/App.tsx`
- Modify: `apps/pit-game/src/App.spec.ts`
- Modify: `apps/pit-game/src/styles.css`

- [ ] **Step 1: Write the failing top-level app tests**

```ts
// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { App } from './App';

vi.mock('./components/MinorityThreatShell', () => ({
  MinorityThreatShell: () => createElement('section', { 'data-testid': 'slice-shell' }, 'slice shell'),
}));

vi.mock('./components/PrototypeWorkbench', () => ({
  PrototypeWorkbench: ({ onBack }: { onBack: () => void }) =>
    createElement(
      'section',
      { 'data-testid': 'lab-shell' },
      createElement('button', { type: 'button', onClick: onBack }, 'Back to Slice'),
      'lab shell',
    ),
}));

function renderApp() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(createElement(App));
  });

  return {
    container,
    unmount() {
      act(() => root.unmount());
      container.remove();
    },
  };
}

describe('App', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('defaults to the new minority threat slice', () => {
    const view = renderApp();

    expect(view.container.querySelector('[data-testid="slice-shell"]')).not.toBeNull();
    expect(view.container.textContent).toContain('Open Authoring Lab');

    view.unmount();
  });
});
```

- [ ] **Step 2: Run the app tests to verify they fail**

Run: `corepack pnpm --filter pit-game exec vitest run src/App.spec.ts`

Expected: FAIL because `PrototypeWorkbench` does not exist yet and `App.tsx` still renders the old prototype directly.

- [ ] **Step 3: Extract the old prototype, wire the new slice as default, and add styles**

```tsx
// apps/pit-game/src/App.legacy.tsx
import { startTransition, useEffect, useRef, useState } from 'react';

import { ResultsPanel } from './components/ResultsPanel';
import { GameHud } from './components/GameHud';
import { ProfileLibrary } from './components/ProfileLibrary';
import { ReviewPanel } from './components/ReviewPanel';
import { UploadPanel } from './components/UploadPanel';
import { authoredSongProfile } from './game/fixtures/authored-song-profile';
import { sampleProfileLibrary } from './game/fixtures/profile-library';
import {
  hydrateSavedAuthoringProject,
  saveAuthoringProject,
  type SavedAuthoringProjectRecord,
} from './game/persistence/song-profile-storage';
import type { SongProfile } from './game/domain/song-profile';
import type { GameSession } from './game/runtime/game-session';
import { createReviewSession, type ReviewSession } from './game/review/review-session';
import { createRuntimeController } from './game/runtime/runtime-controller';

type LegacyMode = 'authored' | 'reviewing' | 'playing';

export function LegacyPrototypeApp() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<ReturnType<typeof createRuntimeController> | null>(null);
  const latestSessionRef = useRef<GameSession | null>(null);
  const flushTimeoutRef = useRef<number | null>(null);
  const relinkInputRef = useRef<HTMLInputElement | null>(null);
  const pendingRelinkRecordRef = useRef<SavedAuthoringProjectRecord | null>(null);
  const ownedAudioUrlRef = useRef<string | null>(null);

  if (!controllerRef.current) {
    controllerRef.current = createRuntimeController(authoredSongProfile);
  }

  const controller = controllerRef.current;
  const [session, setSession] = useState(() => controller.getSnapshot());
  const [mode, setMode] = useState<LegacyMode>('authored');
  const [reviewSession, setReviewSession] = useState<ReviewSession | null>(null);
  const [libraryRevision, setLibraryRevision] = useState(0);
  const [reviewSaveMessage, setReviewSaveMessage] = useState<string | null>(null);

  const applyRuntimeProfile = (profile: SongProfile, elapsedMs = 0, previewEndMs: number | null = null) => {
    controller.reset(profile, elapsedMs, previewEndMs);
    const nextSession = controller.getSnapshot();
    latestSessionRef.current = nextSession;
    startTransition(() => {
      setSession(nextSession);
    });
  };

  const replaceOwnedAudioUrl = (nextUrl: string | null) => {
    if (ownedAudioUrlRef.current && ownedAudioUrlRef.current !== nextUrl) {
      URL.revokeObjectURL(ownedAudioUrlRef.current);
    }

    ownedAudioUrlRef.current = nextUrl;
  };

  useEffect(() => {
    latestSessionRef.current = controller.getSnapshot();

    const flushSnapshot = () => {
      flushTimeoutRef.current = null;

      if (!latestSessionRef.current) {
        return;
      }

      const nextSession = latestSessionRef.current;
      startTransition(() => {
        setSession(nextSession);
      });
    };

    const unsubscribe = controller.subscribe((nextSession) => {
      latestSessionRef.current = nextSession;

      if (flushTimeoutRef.current !== null) {
        return;
      }

      flushTimeoutRef.current = window.setTimeout(flushSnapshot, 100);
    });

    return () => {
      unsubscribe();

      if (flushTimeoutRef.current !== null) {
        window.clearTimeout(flushTimeoutRef.current);
        flushTimeoutRef.current = null;
      }
    };
  }, [controller]);

  useEffect(() => {
    return () => {
      if (ownedAudioUrlRef.current) {
        URL.revokeObjectURL(ownedAudioUrlRef.current);
        ownedAudioUrlRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!mountRef.current) {
      return;
    }

    let active = true;
    let cleanup: (() => void) | undefined;

    void import('./game/runtime/create-pit-game').then(({ createPitGame }) => {
      if (!active || !mountRef.current) {
        return;
      }

      const game = createPitGame(mountRef.current, controller);
      cleanup = () => game.destroy(true);
    });

    return () => {
      active = false;
      cleanup?.();
    };
  }, [controller]);

  return (
    <main className={`runtime-shell${session.result ? ' has-result' : ''}`}>
      <div className='control-column'>
        <UploadPanel
          onDraftReady={(draft, audioSource) => {
            replaceOwnedAudioUrl(audioSource.objectUrl);
            setReviewSession(createReviewSession(draft, audioSource));
            setReviewSaveMessage(null);
            setMode('reviewing');
          }}
        />
        <input
          ref={relinkInputRef}
          type='file'
          accept='.mp3,.wav,.ogg'
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            const record = pendingRelinkRecordRef.current;
            const input = event.currentTarget;

            if (!file) {
              input.value = '';
              return;
            }

            const objectUrl = URL.createObjectURL(file);
            replaceOwnedAudioUrl(objectUrl);
            pendingRelinkRecordRef.current = null;

            if (record) {
              applyRuntimeProfile(record.profile);
              setReviewSession(
                hydrateSavedAuthoringProject(record, {
                  name: file.name,
                  objectUrl,
                }),
              );
              setReviewSaveMessage(`Relinked audio for ${record.name}.`);
            } else {
              setReviewSession((current) =>
                current
                  ? {
                      ...current,
                      audioSource: {
                        name: file.name,
                        objectUrl,
                      },
                    }
                  : current,
              );
              setReviewSaveMessage(`Linked local preview audio from ${file.name}.`);
            }

            setMode('reviewing');
            input.value = '';
          }}
        />
        <section className='panel profile-library'>
          <header className='library-header'>
            <h2>Built-in Sample Profiles</h2>
            <p>Load a curated profile without uploading audio first.</p>
          </header>
          <div className='library-list'>
            {sampleProfileLibrary.map((sample) => (
              <article key={sample.id} className='library-card'>
                <div className='library-copy'>
                  <strong>{sample.name}</strong>
                  <p>{sample.description}</p>
                  <small>
                    {sample.profile.durationMs / 1_000}s | {sample.profile.bpm} BPM
                  </small>
                </div>
                <div className='library-actions'>
                  <button
                    type='button'
                    className='form-control'
                    onClick={() => {
                      replaceOwnedAudioUrl(null);
                      applyRuntimeProfile(sample.profile);
                      setReviewSession(createReviewSession(sample.profile, sample.name));
                      setReviewSaveMessage(`Loaded built-in sample ${sample.name}.`);
                      setMode('reviewing');
                    }}
                  >
                    Load Sample
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
        <ResultsPanel
          profileTitle={session.profile.title}
          result={session.result}
          onRestart={() => {
            applyRuntimeProfile(session.profile);
          }}
        />
        <ReviewPanel
          session={mode === 'reviewing' ? reviewSession : null}
          onChange={setReviewSession}
          saveMessage={reviewSaveMessage}
          onSave={(session) => {
            const savedProject = saveAuthoringProject(session);

            if (savedProject) {
              setLibraryRevision((value) => value + 1);
              setReviewSaveMessage(`Saved ${savedProject.name} locally.`);
              return;
            }

            setReviewSaveMessage('Could not save this authoring project in local storage.');
          }}
          onPreviewPlay={(profile, previewWindow) => {
            applyRuntimeProfile(profile, previewWindow.startMs, previewWindow.endMs);
            setReviewSaveMessage(null);
            setMode('reviewing');
          }}
          onPlay={(profile) => {
            applyRuntimeProfile(profile);
            setReviewSaveMessage(null);
            setMode('reviewing');
          }}
          onRelinkAudio={() => {
            pendingRelinkRecordRef.current = null;
            relinkInputRef.current?.click();
          }}
        />
        <ProfileLibrary
          revision={libraryRevision}
          onLoad={(record) => {
            replaceOwnedAudioUrl(null);
            applyRuntimeProfile(record.profile);
            setReviewSession(hydrateSavedAuthoringProject(record));
            setReviewSaveMessage(
              record.requiresAudioRelink
                ? `Loaded ${record.name} from local storage. Relink the original song file to restore local preview audio.`
                : `Loaded ${record.name} from local storage.`,
            );
            setMode('reviewing');
          }}
          onRelink={(record) => {
            pendingRelinkRecordRef.current = record;
            relinkInputRef.current?.click();
          }}
        />
        <section className='panel stage-panel'>
          <header className='stage-copy'>
            <h1>Hardcore Pit Prototype</h1>
            <p className='stage-live-copy'>Simulation live</p>
            <p>HUD is already updating from the default authored profile.</p>
            <p>Upload a local track or load a built-in sample profile to draft a playable profile in the browser.</p>
            <p>Controls: hold A/S/D/F/E for actions, use arrow keys to target edge, center, front, or side.</p>
          </header>
          <div className='game-mount-shell'>
            <div className='game-mount-overlay'>
              <span className='game-mount-pill'>Live pit</span>
              <p>Load a sample or upload a track, then steer the room with the keyboard while the HUD reacts in real time.</p>
            </div>
            <div ref={mountRef} className='game-mount' />
          </div>
        </section>
      </div>
      <GameHud session={session} />
    </main>
  );
}
```

```tsx
// apps/pit-game/src/App.tsx
import { useState } from 'react';

import { MinorityThreatShell } from './components/MinorityThreatShell';
import { PrototypeWorkbench } from './components/PrototypeWorkbench';

type AppMode = 'slice' | 'lab';

export function App() {
  const [mode, setMode] = useState<AppMode>('slice');

  return (
    <main className='app-shell'>
      <header className='app-shell__modebar'>
        <button
          type='button'
          className='form-control'
          onClick={() => setMode(mode === 'slice' ? 'lab' : 'slice')}
        >
          {mode === 'slice' ? 'Open Authoring Lab' : 'Back to Slice'}
        </button>
      </header>
      {mode === 'slice' ? <MinorityThreatShell /> : <PrototypeWorkbench onBack={() => setMode('slice')} />}
    </main>
  );
}
```

```tsx
// apps/pit-game/src/components/PrototypeWorkbench.tsx
import { LegacyPrototypeApp } from '../App.legacy';

export function PrototypeWorkbench({ onBack }: { onBack: () => void }) {
  return (
    <section className='prototype-workbench'>
      <div className='prototype-workbench__bar'>
        <button type='button' className='form-control' onClick={onBack}>
          Back to Slice
        </button>
      </div>
      <LegacyPrototypeApp />
    </section>
  );
}
```

```ts
// apps/pit-game/src/components/PrototypeWorkbench.spec.ts
// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PrototypeWorkbench } from './PrototypeWorkbench';

vi.mock('../App.legacy', () => ({
  LegacyPrototypeApp: () => createElement('section', { 'data-testid': 'legacy-prototype' }, 'legacy prototype'),
}));

function renderWorkbench() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(createElement(PrototypeWorkbench, { onBack: () => undefined }));
  });

  return {
    container,
    unmount() {
      act(() => root.unmount());
      container.remove();
    },
  };
}

describe('PrototypeWorkbench', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders the legacy prototype inside a lab wrapper', () => {
    const view = renderWorkbench();

    expect(view.container.textContent).toContain('Back to Slice');
    expect(view.container.querySelector('[data-testid="legacy-prototype"]')).not.toBeNull();

    view.unmount();
  });
});
```

```css
/* apps/pit-game/src/styles.css */
.app-shell {
  min-height: 100vh;
  background:
    radial-gradient(circle at top, rgba(133, 39, 24, 0.3), transparent 32%),
    linear-gradient(180deg, #0b0909 0%, #140d0d 52%, #090707 100%);
}

.app-shell__modebar {
  display: flex;
  justify-content: flex-end;
  padding: 16px 24px 0;
}

.minority-shell {
  display: grid;
  grid-template-columns: 360px minmax(0, 1fr);
  gap: 24px;
  padding: 24px;
  color: #f5e5c2;
}

.minority-shell__copy {
  display: grid;
  gap: 10px;
}

.minority-shell__eyebrow {
  font-size: 12px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: #d8a17e;
}

.minority-shell__actions {
  display: grid;
  gap: 12px;
  align-content: start;
}

.minority-shell__error {
  color: #ffb8a1;
}

.minority-shell__summary {
  color: #ffd59a;
}

.minority-shell__mount {
  min-height: 720px;
  border: 1px solid rgba(245, 229, 194, 0.18);
  box-shadow: 0 30px 80px rgba(0, 0, 0, 0.38);
}

.prototype-workbench {
  padding: 24px;
}

.prototype-workbench__bar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 16px;
}
```

- [ ] **Step 4: Run the full pit-game verification**

Run:

```bash
corepack pnpm --filter pit-game exec vitest run
corepack pnpm --filter pit-game build
corepack pnpm test
```

Expected:

- `vitest run` passes for the app, slice, and legacy lab specs
- `pit-game build` succeeds
- root `pnpm test` stays green

- [ ] **Step 5: Commit**

```bash
git add apps/pit-game/src/App.legacy.tsx apps/pit-game/src/components/PrototypeWorkbench.tsx apps/pit-game/src/components/PrototypeWorkbench.spec.ts apps/pit-game/src/App.tsx apps/pit-game/src/App.spec.ts apps/pit-game/src/styles.css
git commit -m "feat: ship minority threat slice as the default pit demo"
```

---

## Spec Coverage Check

- **30-second fixed song slice:** Covered by Task 1 fixture and Task 4 audio bootstrap.
- **Tension In / Breakdown Peak / Aftershock:** Covered by Task 1 phases and Task 2 director logic.
- **Visible player body and reactions:** Covered by Task 3 scene pose helpers and player-body rendering.
- **Readable crowd pressure and zone identity:** Covered by Task 2 pressure model and Task 3 crowd layout.
- **Venue, camera, and lighting cues:** Covered by Task 3 scene implementation and Task 2 frame cues.
- **Minimal result summary:** Covered by Task 2 session summary and Task 4 shell display.
- **Keep old prototype available as a lab:** Covered by Task 5 extraction and top-level mode switch.

## Placeholder Scan

- No `TODO`, `TBD`, or deferred “handle later” language remains.
- All tasks include exact paths, concrete code snippets, run commands, and expected outcomes.
- All introduced names are defined in earlier steps before later tasks reference them.

## Type Consistency Check

- The fixture type is `VerticalSliceFixture` across Tasks 1-4.
- The runtime input type is `VerticalSliceInput` across Tasks 2-3.
- The top-level default experience is always named `MinorityThreatShell`.
- The preserved legacy entry is always named `PrototypeWorkbench`.
