# Hardcore Music Game Vertical Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a first playable vertical slice of the hardcore music game with one venue, one playable fan, one deterministic authored song profile, and a semi-automatic local song upload flow that generates a draft `Song Profile` and lets the player correct key sections before play.

**Architecture:** Add a new standalone `apps/pit-game` Vite app inside the existing pnpm monorepo. Keep gameplay logic in pure TypeScript modules for `Song Profile`, `Show Director`, crowd simulation, player state, review-pass editing, and draft song analysis; keep Phaser thin as a canvas runtime that renders the current `GameSession` while React owns the shell, HUD, upload, and review panels.

**Tech Stack:** TypeScript, React 18, Vite 7, Phaser 3, Web Audio API, Vitest, pnpm workspace

---

## Scope Check

The approved design covers several large subsystems, but the first implementation plan should stay focused on a single self-contained milestone: a playable vertical slice that proves the core loop, the zone-based crowd simulation, and the song-upload-to-review-to-play pipeline. Production-grade DSP, multiple venues, richer progression, and advanced event libraries should each get follow-up plans after this slice is validated.

## File Structure

### Create

- `apps/pit-game/package.json`
  Workspace package for the new game app.
- `apps/pit-game/tsconfig.json`
  TypeScript project config for the app.
- `apps/pit-game/vite.config.ts`
  Vite and Vitest config for the game app.
- `apps/pit-game/index.html`
  Root HTML entry.
- `apps/pit-game/src/main.tsx`
  React bootstrap entry.
- `apps/pit-game/src/App.tsx`
  Top-level shell that coordinates upload, review, and play states.
- `apps/pit-game/src/styles.css`
  Base layout and atmosphere styling.
- `apps/pit-game/src/game/domain/song-profile.ts`
  Core `Song Profile` types, validation, and lookup helpers.
- `apps/pit-game/src/game/domain/song-profile.spec.ts`
  Unit tests for profile validation and section lookup.
- `apps/pit-game/src/game/fixtures/authored-song-profile.ts`
  Deterministic profile fixture for the initial playable loop.
- `apps/pit-game/src/game/domain/show-director.ts`
  Maps song sections to crowd presets, mission pools, and action weights.
- `apps/pit-game/src/game/domain/show-director.spec.ts`
  Unit tests for `Show Director` output.
- `apps/pit-game/src/game/domain/player-state.ts`
  Player resources, actions, and state reducer.
- `apps/pit-game/src/game/domain/player-state.spec.ts`
  Unit tests for player-state transitions.
- `apps/pit-game/src/game/domain/crowd-state.ts`
  Zone-based crowd simulation reducer.
- `apps/pit-game/src/game/domain/crowd-state.spec.ts`
  Unit tests for crowd-state transitions.
- `apps/pit-game/src/game/runtime/game-session.ts`
  Runtime composition of player, crowd, missions, and scoring.
- `apps/pit-game/src/game/runtime/game-session.spec.ts`
  Unit tests for the playable loop state machine.
- `apps/pit-game/src/game/runtime/runtime-controller.ts`
  Thin imperative controller used by Phaser and React.
- `apps/pit-game/src/game/runtime/runtime-controller.spec.ts`
  Unit tests for runtime stepping and subscription.
- `apps/pit-game/src/game/runtime/pit-scene.ts`
  Phaser scene factory that renders the venue and player with simple shapes.
- `apps/pit-game/src/game/runtime/create-pit-game.ts`
  Phaser boot wrapper tied to a DOM container.
- `apps/pit-game/src/components/GameHud.tsx`
  React HUD for section, mission, stamina, balance, respect, and rating.
- `apps/pit-game/src/components/UploadPanel.tsx`
  Local file import surface and analysis trigger.
- `apps/pit-game/src/components/ReviewPanel.tsx`
  Lightweight review-pass timeline/editor surface.
- `apps/pit-game/src/game/analysis/draft-song-profile.ts`
  Pure heuristics that turn energy analysis input into a draft `Song Profile`.
- `apps/pit-game/src/game/analysis/draft-song-profile.spec.ts`
  Unit tests for draft profile generation.
- `apps/pit-game/src/game/analysis/decode-audio-file.ts`
  Browser-only Web Audio decode and frame extraction adapter.
- `apps/pit-game/src/game/review/review-session.ts`
  Review-pass state and override helpers.
- `apps/pit-game/src/game/review/review-session.spec.ts`
  Unit tests for overrides and low-confidence surfacing.

### Modify

- `package.json`
  Add workspace scripts for `pit-game` dev and test execution.
- `pnpm-lock.yaml`
  Capture the new app dependencies.
- `tests/workspace/repo-layout.spec.ts`
  Assert the new workspace package and root script wiring.

## Preconditions

- Work in a dedicated feature branch or worktree.
- Leave the existing ticketing, admin, and load-control apps untouched except for root workspace wiring.
- Keep Phaser scene code thin; most behavior belongs in pure TypeScript modules with Vitest coverage.
- Do not attempt online song hosting, sharing, or rights workflows in this slice.
- Prefer primitive shape rendering over imported art assets for the first milestone.

### Task 1: Scaffold The `pit-game` Workspace And Root Wiring

**Files:**
- Create: `apps/pit-game/package.json`
- Create: `apps/pit-game/tsconfig.json`
- Create: `apps/pit-game/vite.config.ts`
- Create: `apps/pit-game/index.html`
- Create: `apps/pit-game/src/main.tsx`
- Create: `apps/pit-game/src/App.tsx`
- Create: `apps/pit-game/src/styles.css`
- Modify: `package.json`
- Modify: `tests/workspace/repo-layout.spec.ts`
- Modify: `pnpm-lock.yaml`

- [ ] **Step 1: Write the failing workspace-layout test**

```ts
// tests/workspace/repo-layout.spec.ts
expect(existsSync('apps/pit-game/package.json')).toBe(true);

expect(rootPackage.scripts).toEqual(
  expect.objectContaining({
    'dev:pit-game': expect.stringContaining('pnpm --filter pit-game dev'),
  }),
);

expect(rootPackage.scripts?.test).toContain('pnpm --filter pit-game test');

expect(readJson<{ scripts: Record<string, string> }>('apps/pit-game/package.json').scripts).toEqual({
  dev: 'vite',
  build: 'tsc -b && vite build',
  test: 'vitest run',
  lint: 'eslint src --ext .ts,.tsx',
});
```

- [ ] **Step 2: Run the repo-layout test to verify it fails**

Run: `corepack pnpm exec vitest run tests/workspace/repo-layout.spec.ts`

Expected: FAIL with a missing `apps/pit-game/package.json` assertion and missing `dev:pit-game` script assertion.

- [ ] **Step 3: Add root workspace scripts for the new app**

```json
// package.json
{
  "scripts": {
    "dev:api": "corepack pnpm --filter api dev",
    "dev:load-control": "corepack pnpm --filter load-control dev",
    "dev:admin": "corepack pnpm --filter admin dev",
    "dev:miniapp": "corepack pnpm --filter miniapp dev:weapp",
    "dev:pit-game": "corepack pnpm --filter pit-game dev",
    "test": "corepack pnpm --filter api test && corepack pnpm --filter @ticketing/contracts test && corepack pnpm --filter load-control test && corepack pnpm --filter load-control test:e2e && corepack pnpm --filter pit-game test && corepack pnpm exec vitest run tests/perf/load-testing-fixtures.spec.ts && corepack pnpm exec vitest run tests/workspace/repo-layout.spec.ts",
    "lint": "corepack pnpm -r --if-present lint && corepack pnpm exec eslint tests --ext .ts"
  }
}
```

- [ ] **Step 4: Create the minimal Vite app shell**

```json
// apps/pit-game/package.json
{
  "name": "pit-game",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "test": "vitest run",
    "lint": "eslint src --ext .ts,.tsx"
  },
  "dependencies": {
    "phaser": "^3.90.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "web-audio-beat-detector": "^8.2.3"
  },
  "devDependencies": {
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^5.1.0",
    "typescript": "^5.9.3",
    "vite": "^7.1.12",
    "vitest": "^2.1.5"
  }
}
```

```json
// apps/pit-game/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "lib": ["DOM", "ES2022"],
    "types": ["vite/client", "vitest/globals"]
  },
  "include": ["src", "vite.config.ts"]
}
```

```ts
// apps/pit-game/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    include: ['src/**/*.spec.ts'],
  },
});
```

```html
<!-- apps/pit-game/index.html -->
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Hardcore Pit Prototype</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

```tsx
// apps/pit-game/src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';

import { App } from './App';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

```tsx
// apps/pit-game/src/App.tsx
export function App() {
  return (
    <main className='app-shell'>
      <section className='panel'>
        <h1>Hardcore Pit Prototype</h1>
        <p>Workspace bootstrapped. Runtime modules land next.</p>
      </section>
    </main>
  );
}
```

```css
/* apps/pit-game/src/styles.css */
:root {
  color: #f5f1e8;
  background: radial-gradient(circle at top, #4a1309 0%, #1a120f 45%, #080808 100%);
  font-family: 'Segoe UI', sans-serif;
}

body {
  margin: 0;
  min-height: 100vh;
}

.app-shell {
  min-height: 100vh;
  display: grid;
  place-items: center;
}

.panel {
  padding: 24px 28px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(0, 0, 0, 0.42);
  backdrop-filter: blur(8px);
}
```

- [ ] **Step 5: Install dependencies and update the lockfile**

Run: `corepack pnpm install`

Expected: PASS with `apps/pit-game` dependencies recorded in `pnpm-lock.yaml`.

- [ ] **Step 6: Run the repo-layout test to verify the scaffold passes**

Run: `corepack pnpm exec vitest run tests/workspace/repo-layout.spec.ts`

Expected: PASS with the new workspace assertions green.

- [ ] **Step 7: Commit the workspace scaffold**

```bash
git add package.json pnpm-lock.yaml tests/workspace/repo-layout.spec.ts apps/pit-game
git commit -m "feat: scaffold pit game workspace"
```

### Task 2: Define `Song Profile` And `Show Director` Foundations

**Files:**
- Create: `apps/pit-game/src/game/domain/song-profile.ts`
- Create: `apps/pit-game/src/game/domain/song-profile.spec.ts`
- Create: `apps/pit-game/src/game/fixtures/authored-song-profile.ts`
- Create: `apps/pit-game/src/game/domain/show-director.ts`
- Create: `apps/pit-game/src/game/domain/show-director.spec.ts`

- [ ] **Step 1: Write the failing `Song Profile` tests**

```ts
// apps/pit-game/src/game/domain/song-profile.spec.ts
import { describe, expect, it } from 'vitest';

import { authoredSongProfile } from '../fixtures/authored-song-profile';
import { findSectionAtMs, validateSongProfile } from './song-profile';

describe('song profile', () => {
  it('accepts the authored fixture without ordering errors', () => {
    expect(validateSongProfile(authoredSongProfile)).toEqual([]);
  });

  it('returns the active section for a timestamp', () => {
    expect(findSectionAtMs(authoredSongProfile, 61_000)?.kind).toBe('breakdown');
  });
});
```

- [ ] **Step 2: Run the profile test to verify it fails**

Run: `corepack pnpm --filter pit-game test -- src/game/domain/song-profile.spec.ts`

Expected: FAIL with `Cannot find module './song-profile'`.

- [ ] **Step 3: Implement the `Song Profile` helpers and authored fixture**

```ts
// apps/pit-game/src/game/domain/song-profile.ts
export type SectionKind =
  | 'gather'
  | 'push'
  | 'two-step'
  | 'side-to-side prep'
  | 'breakdown'
  | 'recovery';

export interface SongSection {
  kind: SectionKind;
  startMs: number;
  endMs: number;
  confidence: number;
  chaos: number;
}

export interface ImpactMarker {
  atMs: number;
  strength: 'accent' | 'drop';
}

export interface SongProfile {
  id: string;
  title: string;
  durationMs: number;
  bpm: number;
  beatGridMs: number[];
  sections: SongSection[];
  impacts: ImpactMarker[];
}

export function validateSongProfile(profile: SongProfile): string[] {
  const errors: string[] = [];

  for (let index = 0; index < profile.sections.length; index += 1) {
    const current = profile.sections[index];
    const previous = profile.sections[index - 1];

    if (current.startMs >= current.endMs) {
      errors.push(`section ${index} has a non-positive range`);
    }

    if (previous && previous.endMs > current.startMs) {
      errors.push(`section ${index} overlaps section ${index - 1}`);
    }
  }

  return errors;
}

export function findSectionAtMs(profile: SongProfile, atMs: number): SongSection | undefined {
  return profile.sections.find((section) => atMs >= section.startMs && atMs < section.endMs);
}
```

```ts
// apps/pit-game/src/game/fixtures/authored-song-profile.ts
import type { SongProfile } from '../domain/song-profile';

const beatMs = 60_000 / 180;

export const authoredSongProfile: SongProfile = {
  id: 'venue-basement-fixture',
  title: 'Basement Eruption',
  durationMs: 96_000,
  bpm: 180,
  beatGridMs: Array.from({ length: 288 }, (_, index) => Math.round(index * beatMs)),
  sections: [
    { kind: 'gather', startMs: 0, endMs: 12_000, confidence: 1, chaos: 0.2 },
    { kind: 'push', startMs: 12_000, endMs: 34_000, confidence: 1, chaos: 0.42 },
    { kind: 'two-step', startMs: 34_000, endMs: 49_000, confidence: 1, chaos: 0.58 },
    { kind: 'side-to-side prep', startMs: 49_000, endMs: 59_000, confidence: 1, chaos: 0.66 },
    { kind: 'breakdown', startMs: 59_000, endMs: 74_000, confidence: 1, chaos: 0.94 },
    { kind: 'recovery', startMs: 74_000, endMs: 96_000, confidence: 1, chaos: 0.38 },
  ],
  impacts: [
    { atMs: 34_000, strength: 'accent' },
    { atMs: 49_000, strength: 'accent' },
    { atMs: 59_000, strength: 'drop' },
    { atMs: 67_000, strength: 'accent' },
  ],
};
```

- [ ] **Step 4: Run the profile test to verify it passes**

Run: `corepack pnpm --filter pit-game test -- src/game/domain/song-profile.spec.ts`

Expected: PASS.

- [ ] **Step 5: Write the failing `Show Director` tests**

```ts
// apps/pit-game/src/game/domain/show-director.spec.ts
import { describe, expect, it } from 'vitest';

import { authoredSongProfile } from '../fixtures/authored-song-profile';
import { createShowFrame } from './show-director';

describe('show director', () => {
  it('raises brace priority during breakdown sections', () => {
    const calmFrame = createShowFrame(authoredSongProfile, 8_000);
    const breakdownFrame = createShowFrame(authoredSongProfile, 61_000);

    expect(breakdownFrame.actionWeights.brace).toBeGreaterThan(calmFrame.actionWeights.brace);
  });

  it('splits the center during side-to-side preparation', () => {
    expect(createShowFrame(authoredSongProfile, 52_000).crowdPreset.centerFlow).toBe('split');
  });
});
```

- [ ] **Step 6: Run the `Show Director` test to verify it fails**

Run: `corepack pnpm --filter pit-game test -- src/game/domain/show-director.spec.ts`

Expected: FAIL with `Cannot find module './show-director'`.

- [ ] **Step 7: Implement the `Show Director`**

```ts
// apps/pit-game/src/game/domain/show-director.ts
import { findSectionAtMs, type SectionKind, type SongProfile } from './song-profile';

export interface ShowFrame {
  section: SectionKind;
  chaos: number;
  crowdPreset: {
    centerDensity: number;
    edgeDensity: number;
    centerFlow: 'hold' | 'split' | 'collapse' | 'surge';
  };
  actionWeights: {
    twoStep: number;
    shove: number;
    slip: number;
    brace: number;
    lift: number;
  };
  missionPool: Array<'survive-window' | 'center-hold' | 'help-fallen' | 'cross-line'>;
  cameraPreset: 'steady' | 'tense' | 'impact';
}

const presetMap: Record<SectionKind, Omit<ShowFrame, 'section'>> = {
  gather: {
    chaos: 0.2,
    crowdPreset: { centerDensity: 0.35, edgeDensity: 0.18, centerFlow: 'hold' },
    actionWeights: { twoStep: 0.2, shove: 0.25, slip: 0.2, brace: 0.2, lift: 0.1 },
    missionPool: ['survive-window'],
    cameraPreset: 'steady',
  },
  push: {
    chaos: 0.45,
    crowdPreset: { centerDensity: 0.52, edgeDensity: 0.24, centerFlow: 'surge' },
    actionWeights: { twoStep: 0.35, shove: 0.42, slip: 0.32, brace: 0.28, lift: 0.12 },
    missionPool: ['survive-window', 'center-hold'],
    cameraPreset: 'tense',
  },
  'two-step': {
    chaos: 0.58,
    crowdPreset: { centerDensity: 0.5, edgeDensity: 0.24, centerFlow: 'hold' },
    actionWeights: { twoStep: 0.92, shove: 0.38, slip: 0.35, brace: 0.24, lift: 0.14 },
    missionPool: ['survive-window', 'center-hold'],
    cameraPreset: 'tense',
  },
  'side-to-side prep': {
    chaos: 0.66,
    crowdPreset: { centerDensity: 0.22, edgeDensity: 0.38, centerFlow: 'split' },
    actionWeights: { twoStep: 0.35, shove: 0.3, slip: 0.84, brace: 0.4, lift: 0.16 },
    missionPool: ['cross-line', 'survive-window'],
    cameraPreset: 'tense',
  },
  breakdown: {
    chaos: 0.94,
    crowdPreset: { centerDensity: 0.88, edgeDensity: 0.48, centerFlow: 'collapse' },
    actionWeights: { twoStep: 0.4, shove: 0.5, slip: 0.78, brace: 0.96, lift: 0.42 },
    missionPool: ['center-hold', 'help-fallen', 'survive-window'],
    cameraPreset: 'impact',
  },
  recovery: {
    chaos: 0.38,
    crowdPreset: { centerDensity: 0.32, edgeDensity: 0.2, centerFlow: 'hold' },
    actionWeights: { twoStep: 0.3, shove: 0.18, slip: 0.28, brace: 0.22, lift: 0.88 },
    missionPool: ['help-fallen', 'survive-window'],
    cameraPreset: 'steady',
  },
};

export function createShowFrame(profile: SongProfile, atMs: number): ShowFrame {
  const section = findSectionAtMs(profile, atMs) ?? profile.sections[profile.sections.length - 1];
  return {
    section: section.kind,
    ...presetMap[section.kind],
  };
}
```

- [ ] **Step 8: Run both domain tests**

Run: `corepack pnpm --filter pit-game test -- src/game/domain/song-profile.spec.ts src/game/domain/show-director.spec.ts`

Expected: PASS.

- [ ] **Step 9: Commit the profile and director foundation**

```bash
git add apps/pit-game/src/game/domain apps/pit-game/src/game/fixtures
git commit -m "feat: add pit game song profile foundations"
```

### Task 3: Build Pure Player, Crowd, And Session Simulation

**Files:**
- Create: `apps/pit-game/src/game/domain/player-state.ts`
- Create: `apps/pit-game/src/game/domain/player-state.spec.ts`
- Create: `apps/pit-game/src/game/domain/crowd-state.ts`
- Create: `apps/pit-game/src/game/domain/crowd-state.spec.ts`
- Create: `apps/pit-game/src/game/runtime/game-session.ts`
- Create: `apps/pit-game/src/game/runtime/game-session.spec.ts`

- [ ] **Step 1: Write the failing player and crowd tests**

```ts
// apps/pit-game/src/game/domain/player-state.spec.ts
import { describe, expect, it } from 'vitest';

import { authoredSongProfile } from '../fixtures/authored-song-profile';
import { createShowFrame } from './show-director';
import { createPlayerState, reducePlayerState } from './player-state';

describe('player state', () => {
  it('preserves more balance when bracing during a breakdown', () => {
    const frame = createShowFrame(authoredSongProfile, 61_000);
    const braced = reducePlayerState(createPlayerState(), { action: 'brace', targetZone: 'center' }, frame, 250);
    const reckless = reducePlayerState(createPlayerState(), { action: 'two-step', targetZone: 'center' }, frame, 250);

    expect(braced.balance).toBeGreaterThan(reckless.balance);
  });
});
```

```ts
// apps/pit-game/src/game/domain/crowd-state.spec.ts
import { describe, expect, it } from 'vitest';

import { authoredSongProfile } from '../fixtures/authored-song-profile';
import { createShowFrame } from './show-director';
import { advanceCrowdState, createCrowdState } from './crowd-state';

describe('crowd state', () => {
  it('opens the center before a lateral crash during side-to-side prep', () => {
    const frame = createShowFrame(authoredSongProfile, 52_000);
    const next = advanceCrowdState(createCrowdState(), frame, 250);

    expect(next.center.flow).toBe('split');
    expect(next.center.density).toBeLessThan(next.edge.density);
  });
});
```

- [ ] **Step 2: Run the player and crowd tests to verify they fail**

Run: `corepack pnpm --filter pit-game test -- src/game/domain/player-state.spec.ts src/game/domain/crowd-state.spec.ts`

Expected: FAIL with missing reducer modules.

- [ ] **Step 3: Implement the player reducer**

```ts
// apps/pit-game/src/game/domain/player-state.ts
import type { ShowFrame } from './show-director';

export type PlayerZone = 'center' | 'edge' | 'front' | 'side';
export type PlayerAction = 'idle' | 'two-step' | 'shove' | 'slip' | 'brace' | 'lift';

export interface PlayerInput {
  action: PlayerAction;
  targetZone: PlayerZone;
}

export interface PlayerState {
  zone: PlayerZone;
  stamina: number;
  balance: number;
  respect: number;
  status: 'upright' | 'down';
}

export function createPlayerState(): PlayerState {
  return {
    zone: 'edge',
    stamina: 100,
    balance: 100,
    respect: 0,
    status: 'upright',
  };
}

export function reducePlayerState(
  state: PlayerState,
  input: PlayerInput,
  frame: ShowFrame,
  dtMs: number,
): PlayerState {
  const seconds = dtMs / 1_000;
  const baseImpact = frame.chaos * 22 * seconds;
  const braceMitigation = input.action === 'brace' ? 0.65 : 0;
  const slipBonus = input.action === 'slip' && frame.section === 'side-to-side prep' ? 5 : 0;
  const respectDelta = input.action === 'two-step' && frame.actionWeights.twoStep > 0.8 ? 6 : input.action === 'lift' ? 8 : 1;

  const balanceLoss = Math.max(0, baseImpact - braceMitigation * 16 - slipBonus);
  const staminaLoss =
    input.action === 'two-step' ? 8 :
    input.action === 'shove' ? 6 :
    input.action === 'slip' ? 5 :
    input.action === 'brace' ? 4 :
    input.action === 'lift' ? 7 :
    2;

  const balance = Math.max(0, state.balance - balanceLoss);

  return {
    zone: input.targetZone,
    stamina: Math.max(0, state.stamina - staminaLoss),
    balance,
    respect: state.respect + respectDelta,
    status: balance === 0 ? 'down' : 'upright',
  };
}
```

- [ ] **Step 4: Implement the crowd reducer**

```ts
// apps/pit-game/src/game/domain/crowd-state.ts
import type { ShowFrame } from './show-director';

export interface CrowdZoneState {
  density: number;
  aggression: number;
  fallRisk: number;
  flow: 'hold' | 'split' | 'collapse' | 'surge';
}

export interface CrowdState {
  center: CrowdZoneState;
  edge: CrowdZoneState;
  front: CrowdZoneState;
  side: CrowdZoneState;
  fallenFans: number;
}

export function createCrowdState(): CrowdState {
  return {
    center: { density: 0.45, aggression: 0.4, fallRisk: 0.18, flow: 'hold' },
    edge: { density: 0.18, aggression: 0.16, fallRisk: 0.05, flow: 'hold' },
    front: { density: 0.36, aggression: 0.24, fallRisk: 0.12, flow: 'surge' },
    side: { density: 0.2, aggression: 0.12, fallRisk: 0.05, flow: 'hold' },
    fallenFans: 0,
  };
}

export function advanceCrowdState(previous: CrowdState, frame: ShowFrame, dtMs: number): CrowdState {
  const seconds = dtMs / 1_000;
  const centerDensity = frame.crowdPreset.centerDensity;
  const edgeDensity = frame.crowdPreset.edgeDensity;
  const aggression = frame.chaos;
  const fallRisk = Math.min(1, frame.chaos * 0.45 + (frame.section === 'breakdown' ? 0.2 : 0));

  return {
    center: {
      density: centerDensity,
      aggression,
      fallRisk,
      flow: frame.crowdPreset.centerFlow,
    },
    edge: {
      density: edgeDensity,
      aggression: Math.max(0.1, aggression - 0.2),
      fallRisk: Math.max(0.03, fallRisk - 0.18),
      flow: frame.crowdPreset.centerFlow === 'split' ? 'surge' : 'hold',
    },
    front: {
      density: Math.min(0.95, centerDensity + 0.08),
      aggression: Math.min(1, aggression + 0.08),
      fallRisk: Math.min(1, fallRisk + 0.05),
      flow: 'surge',
    },
    side: {
      density: Math.max(0.12, edgeDensity - 0.04),
      aggression: Math.max(0.08, aggression - 0.24),
      fallRisk: Math.max(0.02, fallRisk - 0.24),
      flow: frame.crowdPreset.centerFlow === 'split' ? 'surge' : 'hold',
    },
    fallenFans: previous.fallenFans + (frame.section === 'breakdown' ? Math.round(seconds * 2) : 0),
  };
}
```

- [ ] **Step 5: Run the player and crowd tests to verify they pass**

Run: `corepack pnpm --filter pit-game test -- src/game/domain/player-state.spec.ts src/game/domain/crowd-state.spec.ts`

Expected: PASS.

- [ ] **Step 6: Write the failing session test**

```ts
// apps/pit-game/src/game/runtime/game-session.spec.ts
import { describe, expect, it } from 'vitest';

import { authoredSongProfile } from '../fixtures/authored-song-profile';
import { createGameSession, stepGameSession } from './game-session';

describe('game session', () => {
  it('advances time, updates the mission, and records failure when balance collapses', () => {
    let session = createGameSession(authoredSongProfile, 61_000);

    for (let index = 0; index < 8; index += 1) {
      session = stepGameSession(session, { action: 'two-step', targetZone: 'center' }, 250);
    }

    expect(session.elapsedMs).toBe(63_000);
    expect(session.currentMission).toBe('center-hold');
    expect(session.failed).toBe(true);
  });
});
```

- [ ] **Step 7: Run the session test to verify it fails**

Run: `corepack pnpm --filter pit-game test -- src/game/runtime/game-session.spec.ts`

Expected: FAIL with `Cannot find module './game-session'`.

- [ ] **Step 8: Implement the composed game session**

```ts
// apps/pit-game/src/game/runtime/game-session.ts
import { createCrowdState, advanceCrowdState, type CrowdState } from '../domain/crowd-state';
import { createPlayerState, reducePlayerState, type PlayerInput, type PlayerState } from '../domain/player-state';
import { createShowFrame, type ShowFrame } from '../domain/show-director';
import type { SongProfile } from '../domain/song-profile';

export interface GameSession {
  profile: SongProfile;
  elapsedMs: number;
  frame: ShowFrame;
  crowd: CrowdState;
  player: PlayerState;
  currentMission: 'survive-window' | 'center-hold' | 'help-fallen' | 'cross-line';
  failed: boolean;
}

export function createGameSession(profile: SongProfile, elapsedMs = 0): GameSession {
  const frame = createShowFrame(profile, elapsedMs);
  return {
    profile,
    elapsedMs,
    frame,
    crowd: createCrowdState(),
    player: createPlayerState(),
    currentMission: frame.missionPool[0],
    failed: false,
  };
}

export function stepGameSession(session: GameSession, input: PlayerInput, dtMs: number): GameSession {
  const elapsedMs = session.elapsedMs + dtMs;
  const frame = createShowFrame(session.profile, elapsedMs);
  const crowd = advanceCrowdState(session.crowd, frame, dtMs);
  const player = reducePlayerState(session.player, input, frame, dtMs);

  return {
    ...session,
    elapsedMs,
    frame,
    crowd,
    player,
    currentMission: frame.missionPool[0],
    failed: player.status === 'down',
  };
}
```

- [ ] **Step 9: Run the pure simulation test suite**

Run: `corepack pnpm --filter pit-game test -- src/game/domain/player-state.spec.ts src/game/domain/crowd-state.spec.ts src/game/runtime/game-session.spec.ts`

Expected: PASS.

- [ ] **Step 10: Commit the pure simulation layer**

```bash
git add apps/pit-game/src/game/domain/player-state.ts apps/pit-game/src/game/domain/player-state.spec.ts apps/pit-game/src/game/domain/crowd-state.ts apps/pit-game/src/game/domain/crowd-state.spec.ts apps/pit-game/src/game/runtime/game-session.ts apps/pit-game/src/game/runtime/game-session.spec.ts
git commit -m "feat: add pit game simulation reducers"
```

### Task 4: Add Runtime Control, Phaser Rendering, And The HUD Shell

**Files:**
- Create: `apps/pit-game/src/game/runtime/runtime-controller.ts`
- Create: `apps/pit-game/src/game/runtime/runtime-controller.spec.ts`
- Create: `apps/pit-game/src/game/runtime/pit-scene.ts`
- Create: `apps/pit-game/src/game/runtime/create-pit-game.ts`
- Create: `apps/pit-game/src/components/GameHud.tsx`
- Modify: `apps/pit-game/src/App.tsx`
- Modify: `apps/pit-game/src/styles.css`

- [ ] **Step 1: Write the failing runtime-controller test**

```ts
// apps/pit-game/src/game/runtime/runtime-controller.spec.ts
import { describe, expect, it } from 'vitest';

import { authoredSongProfile } from '../fixtures/authored-song-profile';
import { createRuntimeController } from './runtime-controller';

describe('runtime controller', () => {
  it('steps the session and publishes snapshots to subscribers', () => {
    const controller = createRuntimeController(authoredSongProfile, 59_000);
    const snapshots: number[] = [];

    controller.subscribe((session) => {
      snapshots.push(session.elapsedMs);
    });

    controller.step({ action: 'brace', targetZone: 'center' }, 250);

    expect(snapshots).toEqual([59_250]);
    expect(controller.getSnapshot().currentMission).toBe('center-hold');
  });
});
```

- [ ] **Step 2: Run the runtime-controller test to verify it fails**

Run: `corepack pnpm --filter pit-game test -- src/game/runtime/runtime-controller.spec.ts`

Expected: FAIL with `Cannot find module './runtime-controller'`.

- [ ] **Step 3: Implement the runtime controller**

```ts
// apps/pit-game/src/game/runtime/runtime-controller.ts
import type { PlayerInput } from '../domain/player-state';
import type { SongProfile } from '../domain/song-profile';
import { createGameSession, stepGameSession, type GameSession } from './game-session';

export interface RuntimeController {
  subscribe(listener: (session: GameSession) => void): () => void;
  getSnapshot(): GameSession;
  step(input: PlayerInput, dtMs: number): void;
  reset(profile: SongProfile): void;
}

export function createRuntimeController(profile: SongProfile, elapsedMs = 0): RuntimeController {
  let snapshot = createGameSession(profile, elapsedMs);
  const listeners = new Set<(session: GameSession) => void>();

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
      snapshot = stepGameSession(snapshot, input, dtMs);
      publish();
    },
    reset(nextProfile) {
      snapshot = createGameSession(nextProfile);
      publish();
    },
  };
}
```

- [ ] **Step 4: Run the runtime-controller test to verify it passes**

Run: `corepack pnpm --filter pit-game test -- src/game/runtime/runtime-controller.spec.ts`

Expected: PASS.

- [ ] **Step 5: Render the scene and HUD with a thin UI shell**

```ts
// apps/pit-game/src/game/runtime/pit-scene.ts
import Phaser from 'phaser';

import type { RuntimeController } from './runtime-controller';

export function buildPitScene(controller: RuntimeController) {
  return class PitScene extends Phaser.Scene {
    private player!: Phaser.GameObjects.Arc;
    private lastInput: 'two-step' | 'brace' | 'slip' | 'shove' | 'lift' | 'idle' = 'idle';

    create() {
      this.add.rectangle(640, 360, 1_020, 560, 0x1b1411, 0.9);
      this.add.rectangle(640, 360, 580, 320, 0x3d1411, 0.45);
      this.add.rectangle(640, 180, 1_020, 90, 0x080808, 1);
      this.player = this.add.circle(420, 460, 18, 0xf2d39a);

      this.input.keyboard?.on('keydown-A', () => { this.lastInput = 'slip'; });
      this.input.keyboard?.on('keydown-S', () => { this.lastInput = 'two-step'; });
      this.input.keyboard?.on('keydown-D', () => { this.lastInput = 'shove'; });
      this.input.keyboard?.on('keydown-F', () => { this.lastInput = 'brace'; });
      this.input.keyboard?.on('keydown-E', () => { this.lastInput = 'lift'; });
    }

    update(_time: number, delta: number) {
      controller.step({ action: this.lastInput, targetZone: 'center' }, delta);
      this.lastInput = 'idle';
      const snapshot = controller.getSnapshot();
      this.player.x = snapshot.player.zone === 'edge' ? 320 : snapshot.player.zone === 'side' ? 900 : 640;
      this.player.y = snapshot.player.status === 'down' ? 510 : 460;
    }
  };
}
```

```ts
// apps/pit-game/src/game/runtime/create-pit-game.ts
import Phaser from 'phaser';

import { buildPitScene } from './pit-scene';
import type { RuntimeController } from './runtime-controller';

export function createPitGame(container: HTMLElement, controller: RuntimeController) {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent: container,
    width: 1280,
    height: 720,
    backgroundColor: '#080808',
    scene: [buildPitScene(controller)],
  });
}
```

```tsx
// apps/pit-game/src/components/GameHud.tsx
import type { GameSession } from '../game/runtime/game-session';

interface GameHudProps {
  session: GameSession;
}

export function GameHud({ session }: GameHudProps) {
  return (
    <aside className='hud panel'>
      <h2>{session.profile.title}</h2>
      <p>Section: {session.frame.section}</p>
      <p>Mission: {session.currentMission}</p>
      <p>Stamina: {session.player.stamina.toFixed(0)}</p>
      <p>Balance: {session.player.balance.toFixed(0)}</p>
      <p>Respect: {session.player.respect.toFixed(0)}</p>
      <p>Status: {session.failed ? 'Removed from pit' : 'Still standing'}</p>
    </aside>
  );
}
```

```tsx
// apps/pit-game/src/App.tsx
import { useEffect, useMemo, useRef, useState } from 'react';

import { GameHud } from './components/GameHud';
import { authoredSongProfile } from './game/fixtures/authored-song-profile';
import { createPitGame } from './game/runtime/create-pit-game';
import { createRuntimeController } from './game/runtime/runtime-controller';

export function App() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const controller = useMemo(() => createRuntimeController(authoredSongProfile), []);
  const [session, setSession] = useState(() => controller.getSnapshot());

  useEffect(() => controller.subscribe(setSession), [controller]);

  useEffect(() => {
    if (!mountRef.current) {
      return;
    }

    const game = createPitGame(mountRef.current, controller);
    return () => game.destroy(true);
  }, [controller]);

  return (
    <main className='runtime-shell'>
      <section className='panel stage-panel'>
        <div ref={mountRef} className='game-mount' />
      </section>
      <GameHud session={session} />
    </main>
  );
}
```

```css
/* apps/pit-game/src/styles.css */
.runtime-shell {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 20px;
  padding: 24px;
  box-sizing: border-box;
}

.stage-panel {
  display: grid;
}

.game-mount {
  min-height: 720px;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.hud {
  align-self: start;
}
```

- [ ] **Step 6: Run the focused pit-game test suite and build**

Run: `corepack pnpm --filter pit-game test && corepack pnpm --filter pit-game build`

Expected: PASS with Vitest green and a successful Vite production build.

- [ ] **Step 7: Commit the runtime shell**

```bash
git add apps/pit-game/src/App.tsx apps/pit-game/src/styles.css apps/pit-game/src/components/GameHud.tsx apps/pit-game/src/game/runtime
git commit -m "feat: render pit game vertical slice shell"
```

### Task 5: Add Draft Song Analysis And Local Upload Support

**Files:**
- Create: `apps/pit-game/src/game/analysis/draft-song-profile.ts`
- Create: `apps/pit-game/src/game/analysis/draft-song-profile.spec.ts`
- Create: `apps/pit-game/src/game/analysis/decode-audio-file.ts`
- Create: `apps/pit-game/src/components/UploadPanel.tsx`
- Modify: `apps/pit-game/src/App.tsx`

- [ ] **Step 1: Write the failing draft-analysis test**

```ts
// apps/pit-game/src/game/analysis/draft-song-profile.spec.ts
import { describe, expect, it } from 'vitest';

import { buildDraftSongProfile } from './draft-song-profile';

describe('draft song profile', () => {
  it('turns a high-energy drop into a breakdown section with a drop marker', () => {
    const profile = buildDraftSongProfile({
      title: 'Uploaded Demo',
      durationMs: 48_000,
      bpm: 176,
      beatGridMs: Array.from({ length: 128 }, (_, index) => index * 341),
      energyFrames: [
        { atMs: 0, rms: 0.14 },
        { atMs: 8_000, rms: 0.22 },
        { atMs: 16_000, rms: 0.56 },
        { atMs: 24_000, rms: 0.72 },
        { atMs: 32_000, rms: 0.92 },
        { atMs: 40_000, rms: 0.28 },
      ],
      impactMoments: [16_000, 32_000],
    });

    expect(profile.sections.some((section) => section.kind === 'breakdown')).toBe(true);
    expect(profile.impacts.some((impact) => impact.strength === 'drop')).toBe(true);
  });
});
```

- [ ] **Step 2: Run the draft-analysis test to verify it fails**

Run: `corepack pnpm --filter pit-game test -- src/game/analysis/draft-song-profile.spec.ts`

Expected: FAIL with `Cannot find module './draft-song-profile'`.

- [ ] **Step 3: Implement pure draft-profile generation**

```ts
// apps/pit-game/src/game/analysis/draft-song-profile.ts
import type { SongProfile, SongSection } from '../domain/song-profile';

export interface AnalysisInput {
  title: string;
  durationMs: number;
  bpm: number;
  beatGridMs: number[];
  energyFrames: Array<{ atMs: number; rms: number }>;
  impactMoments: number[];
}

export function buildDraftSongProfile(input: AnalysisInput): SongProfile {
  const sortedFrames = [...input.energyFrames].sort((left, right) => left.atMs - right.atMs);
  const maxEnergy = Math.max(...sortedFrames.map((frame) => frame.rms), 0.01);

  const sections: SongSection[] = sortedFrames.map((frame, index) => {
    const next = sortedFrames[index + 1];
    const normalized = frame.rms / maxEnergy;
    const kind =
      normalized > 0.82 ? 'breakdown' :
      normalized > 0.64 ? 'side-to-side prep' :
      normalized > 0.48 ? 'two-step' :
      normalized > 0.24 ? 'push' :
      'gather';

    return {
      kind,
      startMs: frame.atMs,
      endMs: next?.atMs ?? input.durationMs,
      confidence: normalized > 0.8 || normalized < 0.25 ? 0.88 : 0.58,
      chaos: Number(normalized.toFixed(2)),
    };
  });

  if (sections.length > 0) {
    sections[sections.length - 1] = {
      ...sections[sections.length - 1],
      kind: 'recovery',
      endMs: input.durationMs,
      confidence: 0.72,
    };
  }

  return {
    id: input.title.toLowerCase().replace(/\s+/g, '-'),
    title: input.title,
    durationMs: input.durationMs,
    bpm: input.bpm,
    beatGridMs: input.beatGridMs,
    sections,
    impacts: input.impactMoments.map((atMs, index) => ({
      atMs,
      strength: index === input.impactMoments.length - 1 ? 'drop' : 'accent',
    })),
  };
}
```

- [ ] **Step 4: Run the draft-analysis test to verify it passes**

Run: `corepack pnpm --filter pit-game test -- src/game/analysis/draft-song-profile.spec.ts`

Expected: PASS.

- [ ] **Step 5: Add the browser-side upload decoder and upload surface**

```ts
// apps/pit-game/src/game/analysis/decode-audio-file.ts
import { analyze } from 'web-audio-beat-detector';

import type { AnalysisInput } from './draft-song-profile';

export async function decodeAudioFile(file: File): Promise<AnalysisInput> {
  const context = new AudioContext();
  const arrayBuffer = await file.arrayBuffer();
  const buffer = await context.decodeAudioData(arrayBuffer.slice(0));
  const [channel] = buffer.getChannelData(0) ? [buffer.getChannelData(0)] : [new Float32Array()];
  const windowSize = 2_048;
  const energyFrames: Array<{ atMs: number; rms: number }> = [];

  for (let index = 0; index < channel.length; index += windowSize) {
    const slice = channel.subarray(index, index + windowSize);
    const rms = Math.sqrt(slice.reduce((sum, sample) => sum + sample * sample, 0) / Math.max(1, slice.length));
    energyFrames.push({
      atMs: Math.round((index / buffer.sampleRate) * 1_000),
      rms,
    });
  }

  const bpm = Math.round((await analyze(buffer)).tempo);
  const beatMs = 60_000 / bpm;

  return {
    title: file.name.replace(/\.[^.]+$/, ''),
    durationMs: Math.round(buffer.duration * 1_000),
    bpm,
    beatGridMs: Array.from({ length: Math.floor((buffer.duration * 1_000) / beatMs) }, (_, beat) => Math.round(beat * beatMs)),
    energyFrames,
    impactMoments: energyFrames.filter((frame) => frame.rms > 0.6).map((frame) => frame.atMs).slice(-4),
  };
}
```

```tsx
// apps/pit-game/src/components/UploadPanel.tsx
import { useState } from 'react';

import { buildDraftSongProfile } from '../game/analysis/draft-song-profile';
import { decodeAudioFile } from '../game/analysis/decode-audio-file';
import type { SongProfile } from '../game/domain/song-profile';

interface UploadPanelProps {
  onDraftReady(profile: SongProfile): void;
}

export function UploadPanel({ onDraftReady }: UploadPanelProps) {
  const [status, setStatus] = useState('No upload yet');

  return (
    <section className='panel'>
      <h2>Upload Song</h2>
      <input
        type='file'
        accept='.mp3,.wav,.ogg'
        onChange={async (event) => {
          const file = event.target.files?.[0];
          if (!file) {
            return;
          }

          setStatus(`Analyzing ${file.name}...`);
          const analysis = await decodeAudioFile(file);
          onDraftReady(buildDraftSongProfile(analysis));
          setStatus(`Draft ready for ${analysis.title}`);
        }}
      />
      <p>{status}</p>
    </section>
  );
}
```

```tsx
// apps/pit-game/src/App.tsx
import { useEffect, useMemo, useRef, useState } from 'react';

import { GameHud } from './components/GameHud';
import { UploadPanel } from './components/UploadPanel';
import { authoredSongProfile } from './game/fixtures/authored-song-profile';
import { createPitGame } from './game/runtime/create-pit-game';
import { createRuntimeController } from './game/runtime/runtime-controller';

export function App() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const controller = useMemo(() => createRuntimeController(authoredSongProfile), []);
  const [session, setSession] = useState(() => controller.getSnapshot());

  useEffect(() => controller.subscribe(setSession), [controller]);

  useEffect(() => {
    if (!mountRef.current) {
      return;
    }

    const game = createPitGame(mountRef.current, controller);
    return () => game.destroy(true);
  }, [controller]);

  return (
    <main className='runtime-shell'>
      <div>
        <UploadPanel
          onDraftReady={(draftProfile) => {
            controller.reset(draftProfile);
            setSession(controller.getSnapshot());
          }}
        />
        <section className='panel stage-panel'>
          <div ref={mountRef} className='game-mount' />
        </section>
      </div>
      <GameHud session={session} />
    </main>
  );
}
```

- [ ] **Step 6: Run the analysis test and build again**

Run: `corepack pnpm --filter pit-game test -- src/game/analysis/draft-song-profile.spec.ts && corepack pnpm --filter pit-game build`

Expected: PASS.

- [ ] **Step 7: Commit the upload-analysis slice**

```bash
git add apps/pit-game/src/game/analysis apps/pit-game/src/components/UploadPanel.tsx apps/pit-game/src/App.tsx
git commit -m "feat: add pit game draft song analysis"
```

### Task 6: Add The Review Pass And Connect Upload -> Review -> Play

**Files:**
- Create: `apps/pit-game/src/game/review/review-session.ts`
- Create: `apps/pit-game/src/game/review/review-session.spec.ts`
- Create: `apps/pit-game/src/components/ReviewPanel.tsx`
- Modify: `apps/pit-game/src/App.tsx`
- Modify: `apps/pit-game/src/styles.css`

- [ ] **Step 1: Write the failing review-session test**

```ts
// apps/pit-game/src/game/review/review-session.spec.ts
import { describe, expect, it } from 'vitest';

import { authoredSongProfile } from '../fixtures/authored-song-profile';
import {
  applySectionOverride,
  buildPlayableProfile,
  createReviewSession,
  getLowConfidenceSections,
} from './review-session';

describe('review session', () => {
  it('surfaces uncertain sections and applies section relabels', () => {
    const session = createReviewSession({
      ...authoredSongProfile,
      sections: authoredSongProfile.sections.map((section, index) => ({
        ...section,
        confidence: index === 2 ? 0.52 : section.confidence,
      })),
    });

    expect(getLowConfidenceSections(session)).toHaveLength(1);

    const updated = applySectionOverride(session, 2, 'two-step');
    expect(buildPlayableProfile(updated).sections[2].kind).toBe('two-step');
  });
});
```

- [ ] **Step 2: Run the review-session test to verify it fails**

Run: `corepack pnpm --filter pit-game test -- src/game/review/review-session.spec.ts`

Expected: FAIL with `Cannot find module './review-session'`.

- [ ] **Step 3: Implement the pure review-session model**

```ts
// apps/pit-game/src/game/review/review-session.ts
import type { SectionKind, SongProfile } from '../domain/song-profile';

export interface ReviewSession {
  draft: SongProfile;
  overrides: {
    sectionKinds: Record<number, SectionKind>;
  };
}

export function createReviewSession(draft: SongProfile): ReviewSession {
  return {
    draft,
    overrides: {
      sectionKinds: {},
    },
  };
}

export function getLowConfidenceSections(session: ReviewSession) {
  return session.draft.sections
    .map((section, index) => ({ section, index }))
    .filter(({ section }) => section.confidence < 0.7);
}

export function applySectionOverride(
  session: ReviewSession,
  index: number,
  kind: SectionKind,
): ReviewSession {
  return {
    ...session,
    overrides: {
      ...session.overrides,
      sectionKinds: {
        ...session.overrides.sectionKinds,
        [index]: kind,
      },
    },
  };
}

export function buildPlayableProfile(session: ReviewSession): SongProfile {
  return {
    ...session.draft,
    sections: session.draft.sections.map((section, index) => ({
      ...section,
      kind: session.overrides.sectionKinds[index] ?? section.kind,
      confidence: session.overrides.sectionKinds[index] ? 1 : section.confidence,
    })),
  };
}
```

- [ ] **Step 4: Run the review-session test to verify it passes**

Run: `corepack pnpm --filter pit-game test -- src/game/review/review-session.spec.ts`

Expected: PASS.

- [ ] **Step 5: Build the review UI and staged app flow**

```tsx
// apps/pit-game/src/components/ReviewPanel.tsx
import type { SectionKind, SongProfile } from '../game/domain/song-profile';
import { applySectionOverride, buildPlayableProfile, getLowConfidenceSections, type ReviewSession } from '../game/review/review-session';

interface ReviewPanelProps {
  session: ReviewSession | null;
  onChange(next: ReviewSession): void;
  onPlay(profile: SongProfile): void;
}

const sectionKinds: SectionKind[] = ['gather', 'push', 'two-step', 'side-to-side prep', 'breakdown', 'recovery'];

export function ReviewPanel({ session, onChange, onPlay }: ReviewPanelProps) {
  if (!session) {
    return null;
  }

  const lowConfidence = getLowConfidenceSections(session);

  return (
    <section className='panel'>
      <h2>Review Pass</h2>
      {lowConfidence.map(({ section, index }) => (
        <label key={`${section.startMs}-${section.endMs}`} className='review-row'>
          <span>
            {section.startMs}ms - {section.endMs}ms
          </span>
          <select
            value={session.overrides.sectionKinds[index] ?? section.kind}
            onChange={(event) => onChange(applySectionOverride(session, index, event.target.value as SectionKind))}
          >
            {sectionKinds.map((kind) => (
              <option key={kind} value={kind}>
                {kind}
              </option>
            ))}
          </select>
        </label>
      ))}
      <button type='button' onClick={() => onPlay(buildPlayableProfile(session))}>
        Play Reviewed Profile
      </button>
    </section>
  );
}
```

```tsx
// apps/pit-game/src/App.tsx
import { useEffect, useMemo, useRef, useState } from 'react';

import { GameHud } from './components/GameHud';
import { ReviewPanel } from './components/ReviewPanel';
import { UploadPanel } from './components/UploadPanel';
import { authoredSongProfile } from './game/fixtures/authored-song-profile';
import { createReviewSession, type ReviewSession } from './game/review/review-session';
import { createPitGame } from './game/runtime/create-pit-game';
import { createRuntimeController } from './game/runtime/runtime-controller';

type AppMode = 'authored' | 'reviewing' | 'uploaded';

export function App() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const controller = useMemo(() => createRuntimeController(authoredSongProfile), []);
  const [session, setSession] = useState(() => controller.getSnapshot());
  const [mode, setMode] = useState<AppMode>('authored');
  const [reviewSession, setReviewSession] = useState<ReviewSession | null>(null);

  useEffect(() => controller.subscribe(setSession), [controller]);

  useEffect(() => {
    if (!mountRef.current) {
      return;
    }

    const game = createPitGame(mountRef.current, controller);
    return () => game.destroy(true);
  }, [controller]);

  return (
    <main className='runtime-shell'>
      <div className='control-column'>
        <UploadPanel
          onDraftReady={(draftProfile) => {
            setReviewSession(createReviewSession(draftProfile));
            setMode('reviewing');
          }}
        />
        <ReviewPanel
          session={mode === 'reviewing' ? reviewSession : null}
          onChange={setReviewSession}
          onPlay={(profile) => {
            controller.reset(profile);
            setSession(controller.getSnapshot());
            setMode('uploaded');
          }}
        />
        <section className='panel stage-panel'>
          <div ref={mountRef} className='game-mount' />
        </section>
      </div>
      <GameHud session={session} />
    </main>
  );
}
```

```css
/* apps/pit-game/src/styles.css */
.review-row {
  display: grid;
  gap: 8px;
  margin-bottom: 12px;
}

.control-column {
  display: grid;
  gap: 20px;
}

button,
select,
input {
  font: inherit;
}
```

- [ ] **Step 6: Run the full pit-game test suite and manual smoke commands**

Run: `corepack pnpm --filter pit-game test && corepack pnpm --filter pit-game build`

Expected: PASS.

Run: `corepack pnpm --filter pit-game dev`

Expected: Vite dev server starts, the authored profile is playable immediately, and uploading a local track produces a review panel before the reviewed profile starts.

- [ ] **Step 7: Commit the review-pass flow**

```bash
git add apps/pit-game/src/game/review apps/pit-game/src/components/ReviewPanel.tsx apps/pit-game/src/App.tsx apps/pit-game/src/styles.css
git commit -m "feat: add pit game review pass flow"
```

## Coverage Notes

This plan deliberately covers the approved first milestone:

1. one venue rendered with primitive shapes
2. one playable role with six actions represented in the simulation layer
3. one authored `Song Profile` that proves the deterministic loop
4. a draft upload analysis path for local audio files
5. a review pass that fixes low-confidence sections before play
6. runtime `Show Director` behavior that drives crowd and mission state

The following remain out of scope for this plan and should each get a follow-up plan after validation:

1. production-grade beat detection accuracy tuning
2. richer timeline editing beyond section relabels
3. multiple venues, richer missions, and progression systems
4. save/load of reviewed song profiles
5. scene-flavored post-run rank screens and long-form session flow
