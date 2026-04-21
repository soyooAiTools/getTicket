# Minority Threat Playable Browser Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `apps/pit-game` into a game-first, browser-hosted, fully playable `Minority Threat` hardcore slice that feels like a real game within 10 seconds and plays as a complete 30-second run.

**Architecture:** Keep the existing fixed-song slice foundation, but rebuild the player-facing experience around a game-first shell, a richer authored timeline, a stronger player pressure loop, and a Phaser scene driven by a pure presentation model instead of raw debug-state rendering. Preserve the upload/review prototype only as a secondary lab path.

**Tech Stack:** TypeScript, React 18, Phaser 3, Vite, Vitest, HTMLAudioElement

---

## File Structure

### Create

- `apps/pit-game/src/components/MinorityThreatRunOverlay.tsx`
  - Minimal game-first boot, start, fail, and replay overlay for the primary slice.
- `apps/pit-game/src/components/MinorityThreatRunOverlay.spec.ts`
  - Component tests for idle, ready, running, and result overlay states.
- `apps/pit-game/src/game/runtime/vertical-slice-venue.ts`
  - Pure venue geometry, lane anchors, stage/barrier layout, and shoulder-camera framing constants.
- `apps/pit-game/src/game/runtime/vertical-slice-venue.spec.ts`
  - Tests for zone anchors, camera framing bounds, and readable pit-space layout.
- `apps/pit-game/src/game/runtime/vertical-slice-presentation.ts`
  - Pure render-state builder that maps authored slice/session state into player rig, crowd rows, camera cues, and lighting state.
- `apps/pit-game/src/game/runtime/vertical-slice-presentation.spec.ts`
  - Tests for player pose selection, crowd row density, and authored camera/light transitions.

### Modify

- `apps/pit-game/src/App.tsx`
  - Keep the fixed-song slice as the default entry, but demote the lab switch to a subtle secondary control.
- `apps/pit-game/src/App.spec.ts`
  - Keep coverage for default slice entry and lab persistence while matching the new game-first shell.
- `apps/pit-game/src/components/MinorityThreatShell.tsx`
  - Replace shell-first copy with a game-first flow and integrate the overlay/result state.
- `apps/pit-game/src/components/MinorityThreatShell.spec.ts`
  - Cover boot/ready/start/finish flows, no-prestart simulation drift, and authored segment completion behavior.
- `apps/pit-game/src/game/domain/vertical-slice.ts`
  - Expand authored phase/event semantics to support a four-part playable arc and stronger presentation metadata.
- `apps/pit-game/src/game/domain/vertical-slice.spec.ts`
  - Validate the richer fixture, four-phase run, and event normalization.
- `apps/pit-game/src/game/domain/vertical-slice-director.ts`
  - Convert authored phase/event data into richer pressure, action-window, danger-kind, and presentation cues.
- `apps/pit-game/src/game/domain/vertical-slice-director.spec.ts`
  - Cover build, surge, crush, and aftershock frame outputs.
- `apps/pit-game/src/game/fixtures/minority-threat-vertical-slice.ts`
  - Re-author the song segment timeline into `walk-in`, `build`, `breakdown peak`, and `aftershock`.
- `apps/pit-game/src/game/runtime/vertical-slice-session.ts`
  - Upgrade the player state machine and pressure response loop to support `stable`, `stagger`, and `down` with meaningful action tradeoffs.
- `apps/pit-game/src/game/runtime/vertical-slice-session.spec.ts`
  - Cover success/failure, stagger vs. down transitions, and authored pressure windows.
- `apps/pit-game/src/game/runtime/vertical-slice-controller.ts`
  - Keep explicit `start/pause/complete/reset` lifecycle but support the richer session loop and final presentation sync.
- `apps/pit-game/src/game/runtime/vertical-slice-controller.spec.ts`
  - Cover lifecycle gating and externally-driven completion.
- `apps/pit-game/src/game/runtime/vertical-slice-scene.ts`
  - Rebuild the scene around venue layout, shoulder framing, animated player body, crowd rows, impact camera, and immediate redraw on external state changes.
- `apps/pit-game/src/game/runtime/vertical-slice-scene.spec.ts`
  - Cover scene helper behavior and controller-driven repaint outside the running update loop.
- `apps/pit-game/src/game/runtime/create-vertical-slice-game.ts`
  - Keep Phaser bootstrap, but wire the richer scene dependencies.
- `apps/pit-game/src/game/runtime/vertical-slice-audio.ts`
  - Keep exact file-name validation while preserving authored segment start/end control.
- `apps/pit-game/src/game/runtime/vertical-slice-audio.spec.ts`
  - Cover start offset and authored end enforcement helpers.
- `apps/pit-game/src/smoke.spec.ts`
  - Match the final game-first browser shell.
- `apps/pit-game/src/styles.css`
  - Remove tool-like layout dominance from the primary slice and style the playable boot/result overlay plus the more cinematic canvas presentation.

---

### Task 1: Replace the shell-first slice with a game-first boot and result overlay

**Files:**
- Create: `apps/pit-game/src/components/MinorityThreatRunOverlay.tsx`
- Create: `apps/pit-game/src/components/MinorityThreatRunOverlay.spec.ts`
- Modify: `apps/pit-game/src/components/MinorityThreatShell.tsx`
- Modify: `apps/pit-game/src/App.tsx`
- Modify: `apps/pit-game/src/App.spec.ts`
- Modify: `apps/pit-game/src/smoke.spec.ts`
- Modify: `apps/pit-game/src/styles.css`

- [ ] **Step 1: Write the failing overlay and smoke tests**

```ts
// apps/pit-game/src/components/MinorityThreatRunOverlay.spec.ts
// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MinorityThreatRunOverlay } from './MinorityThreatRunOverlay';

function renderOverlay(
  props: Partial<React.ComponentProps<typeof MinorityThreatRunOverlay>> = {},
) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  const defaultProps: React.ComponentProps<typeof MinorityThreatRunOverlay> = {
    fileName: 'Minority Unit - Minority Threat.mp3',
    loadedFileName: null,
    canStart: false,
    isRunning: false,
    result: null,
    onLoadSong: () => undefined,
    onStart: () => undefined,
    onRestart: () => undefined,
  };

  act(() => {
    root.render(createElement(MinorityThreatRunOverlay, { ...defaultProps, ...props }));
  });

  return {
    container,
    unmount() {
      act(() => root.unmount());
      container.remove();
    },
  };
}

describe('MinorityThreatRunOverlay', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('shows a game-first idle state without any local filesystem path', () => {
    const view = renderOverlay();

    expect(view.container.textContent).toContain('Minority Threat');
    expect(view.container.textContent).toContain('30-second playable slice');
    expect(view.container.textContent).toContain('Load Minority Threat.mp3');
    expect(view.container.textContent).not.toContain('C:/Users/Nick/Desktop');

    view.unmount();
  });

  it('switches to a replay-focused result state after the run ends', () => {
    const view = renderOverlay({
      result: { label: 'Survived', downCount: 1, hitWindows: 6 },
    });

    expect(view.container.textContent).toContain('Survived');
    expect(view.container.textContent).toContain('Replay Slice');

    view.unmount();
  });
});
```

```ts
// apps/pit-game/src/smoke.spec.ts
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';

import { App } from './App';

it('renders the playable browser slice shell', () => {
  const html = renderToStaticMarkup(createElement(App));

  expect(html).toContain('Minority Threat');
  expect(html).toContain('30-second playable slice');
  expect(html).toContain('Load Minority Threat.mp3');
  expect(html).not.toContain('workspace');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
corepack pnpm --filter pit-game exec vitest run src/components/MinorityThreatRunOverlay.spec.ts src/smoke.spec.ts
```

Expected:

- FAIL because `MinorityThreatRunOverlay.tsx` does not exist yet
- or FAIL because the current shell still renders tool-like copy

- [ ] **Step 3: Implement the game-first overlay and integrate it into the shell**

```tsx
// apps/pit-game/src/components/MinorityThreatRunOverlay.tsx
interface MinorityThreatRunOverlayProps {
  fileName: string;
  loadedFileName: string | null;
  canStart: boolean;
  isRunning: boolean;
  result: { label: 'Survived' | 'Dropped'; downCount: number; hitWindows: number } | null;
  onLoadSong(): void;
  onStart(): void;
  onRestart(): void;
}

export function MinorityThreatRunOverlay({
  fileName,
  loadedFileName,
  canStart,
  isRunning,
  result,
  onLoadSong,
  onStart,
  onRestart,
}: MinorityThreatRunOverlayProps) {
  if (result) {
    return (
      <section className='slice-overlay slice-overlay--result'>
        <p className='slice-overlay__eyebrow'>Run Complete</p>
        <h2>{result.label}</h2>
        <p>Downs: {result.downCount}</p>
        <p>Hit windows: {result.hitWindows}</p>
        <button type='button' className='form-control' onClick={onRestart}>
          Replay Slice
        </button>
      </section>
    );
  }

  return (
    <section className='slice-overlay'>
      <p className='slice-overlay__eyebrow'>Minority Threat</p>
      <h1>30-second playable slice</h1>
      <p>Dirty livehouse pressure. Shoulder camera. One authored breakdown run.</p>
      <p className='slice-overlay__file'>{fileName}</p>
      {loadedFileName ? <p className='slice-overlay__loaded'>Loaded: {loadedFileName}</p> : null}
      <div className='slice-overlay__actions'>
        <button type='button' className='form-control' onClick={onLoadSong}>
          Load Minority Threat.mp3
        </button>
        <button
          type='button'
          className='form-control'
          disabled={!canStart || isRunning}
          onClick={onStart}
        >
          {isRunning ? 'Running…' : 'Start Slice'}
        </button>
      </div>
    </section>
  );
}
```

```tsx
// apps/pit-game/src/components/MinorityThreatShell.tsx
import { MinorityThreatRunOverlay } from './MinorityThreatRunOverlay';

// inside MinorityThreatShell render
return (
  <section className='minority-shell'>
    <div className='minority-shell__stage'>
      <div ref={mountRef} className='minority-shell__mount' />
      <MinorityThreatRunOverlay
        fileName={minorityThreatVerticalSlice.audio.fileName}
        loadedFileName={loadedFileName}
        canStart={
          loadedFileName === minorityThreatVerticalSlice.audio.fileName &&
          isAudioReady
        }
        isRunning={controller.isRunning()}
        result={controller.getSnapshot().summary}
        onLoadSong={() => fileInputRef.current?.click()}
        onStart={startSlice}
        onRestart={restartSlice}
      />
    </div>
    <input ref={fileInputRef} type='file' accept='.mp3,.wav,.ogg' hidden onChange={handleFileChange} />
  </section>
);
```

```tsx
// apps/pit-game/src/App.tsx
export function App() {
  const [mode, setMode] = useState<AppMode>('slice');
  const [labMounted, setLabMounted] = useState(false);

  return (
    <main className='app-shell app-shell--game'>
      <button
        type='button'
        className='app-shell__lab-link'
        onClick={() => {
          setLabMounted(true);
          setMode(mode === 'lab' ? 'slice' : 'lab');
        }}
      >
        {mode === 'slice' ? 'Authoring Lab' : 'Back to Slice'}
      </button>

      {mode === 'slice' ? <MinorityThreatShell /> : null}
      {labMounted ? (
        <section hidden={mode !== 'lab'}>
          <PrototypeWorkbench active={mode === 'lab'} onBack={() => setMode('slice')} />
        </section>
      ) : null}
    </main>
  );
}
```

```css
/* apps/pit-game/src/styles.css */
.app-shell--game {
  position: relative;
  min-height: 100vh;
  background:
    radial-gradient(circle at 50% 0%, rgba(122, 32, 21, 0.35), transparent 34%),
    linear-gradient(180deg, #050505 0%, #0e0908 45%, #040404 100%);
}

.app-shell__lab-link {
  position: fixed;
  top: 18px;
  right: 18px;
  z-index: 20;
  min-height: 36px;
  padding: 0 12px;
  border: 1px solid rgba(255, 244, 224, 0.18);
  background: rgba(5, 5, 5, 0.74);
  color: #f6e8d1;
}

.minority-shell__stage {
  position: relative;
  min-height: 100vh;
}

.slice-overlay {
  position: absolute;
  left: 32px;
  bottom: 32px;
  z-index: 4;
  display: grid;
  gap: 10px;
  max-width: 420px;
  padding: 22px 24px;
  border: 1px solid rgba(255, 233, 196, 0.18);
  background: rgba(12, 9, 8, 0.84);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.38);
}
```

- [ ] **Step 4: Run the shell tests to verify they pass**

Run:

```bash
corepack pnpm --filter pit-game exec vitest run src/components/MinorityThreatRunOverlay.spec.ts src/components/MinorityThreatShell.spec.ts src/App.spec.ts src/smoke.spec.ts
```

Expected:

- PASS with the new overlay and game-first shell copy

- [ ] **Step 5: Commit**

```bash
git add apps/pit-game/src/components/MinorityThreatRunOverlay.tsx apps/pit-game/src/components/MinorityThreatRunOverlay.spec.ts apps/pit-game/src/components/MinorityThreatShell.tsx apps/pit-game/src/App.tsx apps/pit-game/src/App.spec.ts apps/pit-game/src/smoke.spec.ts apps/pit-game/src/styles.css
git commit -m "feat: add game-first minority threat shell"
```

### Task 2: Re-author the Minority Threat slice into a four-phase playable run

**Files:**
- Modify: `apps/pit-game/src/game/domain/vertical-slice.ts`
- Modify: `apps/pit-game/src/game/domain/vertical-slice.spec.ts`
- Modify: `apps/pit-game/src/game/domain/vertical-slice-director.ts`
- Modify: `apps/pit-game/src/game/domain/vertical-slice-director.spec.ts`
- Modify: `apps/pit-game/src/game/fixtures/minority-threat-vertical-slice.ts`

- [ ] **Step 1: Write the failing authored-run tests**

```ts
// apps/pit-game/src/game/domain/vertical-slice.spec.ts
import { describe, expect, it } from 'vitest';

import { minorityThreatVerticalSlice } from '../fixtures/minority-threat-vertical-slice';
import { validateVerticalSliceFixture } from './vertical-slice';

describe('minorityThreatVerticalSlice', () => {
  it('defines a four-phase authored run', () => {
    expect(minorityThreatVerticalSlice.phases.map((phase) => phase.kind)).toEqual([
      'walk-in-pressure',
      'build',
      'breakdown-peak',
      'aftershock',
    ]);
    expect(validateVerticalSliceFixture(minorityThreatVerticalSlice)).toEqual([]);
  });
});
```

```ts
// apps/pit-game/src/game/domain/vertical-slice-director.spec.ts
import { describe, expect, it } from 'vitest';

import { minorityThreatVerticalSlice } from '../fixtures/minority-threat-vertical-slice';
import { createVerticalSliceFrame } from './vertical-slice-director';

describe('createVerticalSliceFrame', () => {
  it('marks build surges as slip windows', () => {
    const frame = createVerticalSliceFrame(minorityThreatVerticalSlice, 7_000);

    expect(frame.phase.kind).toBe('build');
    expect(frame.dangerKind).toBe('surge');
    expect(frame.recommendedAction).toBe('slip');
  });

  it('marks the peak crush as a brace-first window', () => {
    const frame = createVerticalSliceFrame(minorityThreatVerticalSlice, 12_000);

    expect(frame.phase.kind).toBe('breakdown-peak');
    expect(frame.dangerKind).toBe('crush');
    expect(frame.recommendedAction).toBe('brace');
    expect(frame.cameraCue).toBe('impact');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
corepack pnpm --filter pit-game exec vitest run src/game/domain/vertical-slice.spec.ts src/game/domain/vertical-slice-director.spec.ts
```

Expected:

- FAIL because the fixture still uses the older 3-phase shape and frame outputs

- [ ] **Step 3: Implement the richer slice phases and director outputs**

```ts
// apps/pit-game/src/game/domain/vertical-slice.ts
export type VerticalSlicePhaseKind =
  | 'walk-in-pressure'
  | 'build'
  | 'breakdown-peak'
  | 'aftershock';

export type VerticalSliceDangerKind = 'push' | 'surge' | 'crush' | 'aftershock';

export interface VerticalSliceFrame {
  phase: VerticalSlicePhase;
  event: VerticalSliceEvent | null;
  dangerKind: VerticalSliceDangerKind;
  recommendedAction: 'move' | 'brace' | 'slip' | 'shove';
  cameraCue: 'follow' | 'pressure' | 'impact' | 'down';
  lightCue: 'room' | 'build' | 'hit' | 'aftershock';
  zonePressure: {
    front: number;
    center: number;
    edge: number;
    side: number;
  };
}
```

```ts
// apps/pit-game/src/game/fixtures/minority-threat-vertical-slice.ts
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
    { kind: 'walk-in-pressure', startMs: 0, endMs: 4_000, intensity: 0.28 },
    { kind: 'build', startMs: 4_000, endMs: 10_000, intensity: 0.55 },
    { kind: 'breakdown-peak', startMs: 10_000, endMs: 24_000, intensity: 1 },
    { kind: 'aftershock', startMs: 24_000, endMs: 30_000, intensity: 0.42 },
  ],
  events: [
    { atMs: 2_500, kind: 'crowd-build', strength: 0.44 },
    { atMs: 7_000, kind: 'lateral-surge', strength: 0.8 },
    { atMs: 10_250, kind: 'breakdown-hit', strength: 1 },
    { atMs: 15_250, kind: 'breakdown-hit', strength: 0.92 },
    { atMs: 24_000, kind: 'aftershock-drop', strength: 0.58 },
  ],
};
```

```ts
// apps/pit-game/src/game/domain/vertical-slice-director.ts
export function createVerticalSliceFrame(
  fixture: VerticalSliceFixture,
  atMs: number,
): VerticalSliceFrame {
  const phase = findPhase(fixture, atMs);
  const event = findEvent(fixture, atMs);

  if (phase.kind === 'walk-in-pressure') {
    return {
      phase,
      event,
      dangerKind: 'push',
      recommendedAction: 'move',
      cameraCue: 'follow',
      lightCue: 'room',
      zonePressure: { front: 42, center: 48, edge: 22, side: 28 },
    };
  }

  if (phase.kind === 'build') {
    return {
      phase,
      event,
      dangerKind: event?.kind === 'lateral-surge' ? 'surge' : 'push',
      recommendedAction: event?.kind === 'lateral-surge' ? 'slip' : 'move',
      cameraCue: event?.kind === 'lateral-surge' ? 'pressure' : 'follow',
      lightCue: 'build',
      zonePressure: { front: 62, center: 72, edge: 38, side: 58 },
    };
  }

  if (phase.kind === 'breakdown-peak') {
    return {
      phase,
      event,
      dangerKind: 'crush',
      recommendedAction: event?.kind === 'breakdown-hit' ? 'brace' : 'shove',
      cameraCue: event?.kind === 'breakdown-hit' ? 'impact' : 'pressure',
      lightCue: event?.kind === 'breakdown-hit' ? 'hit' : 'build',
      zonePressure: { front: 86, center: 100, edge: 68, side: 76 },
    };
  }

  return {
    phase,
    event,
    dangerKind: 'aftershock',
    recommendedAction: 'shove',
    cameraCue: 'follow',
    lightCue: 'aftershock',
    zonePressure: { front: 48, center: 58, edge: 30, side: 36 },
  };
}
```

- [ ] **Step 4: Run the authored-run tests to verify they pass**

Run:

```bash
corepack pnpm --filter pit-game exec vitest run src/game/domain/vertical-slice.spec.ts src/game/domain/vertical-slice-director.spec.ts
```

Expected:

- PASS with the new four-phase authored run and richer danger/action outputs

- [ ] **Step 5: Commit**

```bash
git add apps/pit-game/src/game/domain/vertical-slice.ts apps/pit-game/src/game/domain/vertical-slice.spec.ts apps/pit-game/src/game/domain/vertical-slice-director.ts apps/pit-game/src/game/domain/vertical-slice-director.spec.ts apps/pit-game/src/game/fixtures/minority-threat-vertical-slice.ts
git commit -m "feat: enrich the minority threat authored run"
```

### Task 3: Build the playable player-pressure loop and control states

**Files:**
- Modify: `apps/pit-game/src/game/runtime/vertical-slice-session.ts`
- Modify: `apps/pit-game/src/game/runtime/vertical-slice-session.spec.ts`
- Modify: `apps/pit-game/src/game/runtime/vertical-slice-controller.ts`
- Modify: `apps/pit-game/src/game/runtime/vertical-slice-controller.spec.ts`

- [ ] **Step 1: Write the failing session and controller tests**

```ts
// apps/pit-game/src/game/runtime/vertical-slice-session.spec.ts
import { describe, expect, it } from 'vitest';

import { minorityThreatVerticalSlice } from '../fixtures/minority-threat-vertical-slice';
import { createVerticalSliceSession, stepVerticalSliceSession } from './vertical-slice-session';

describe('vertical slice session pressure loop', () => {
  it('drops the player into stagger when they eat a build surge without slipping', () => {
    let session = createVerticalSliceSession(minorityThreatVerticalSlice);

    session = stepVerticalSliceSession(session, { action: 'move', targetZone: 'side' }, 7_000);

    expect(session.player.status).toBe('staggered');
  });

  it('lets the player survive the first peak window by bracing correctly', () => {
    let session = createVerticalSliceSession(minorityThreatVerticalSlice);

    session = stepVerticalSliceSession(session, { action: 'brace', targetZone: 'center' }, 10_500);

    expect(session.player.status).not.toBe('down');
    expect(session.player.balance).toBeGreaterThan(0);
  });
});
```

```ts
// apps/pit-game/src/game/runtime/vertical-slice-controller.spec.ts
import { describe, expect, it } from 'vitest';

import { minorityThreatVerticalSlice } from '../fixtures/minority-threat-vertical-slice';
import { createVerticalSliceController } from './vertical-slice-controller';

describe('vertical slice controller lifecycle', () => {
  it('does not advance until start is called', () => {
    const controller = createVerticalSliceController(minorityThreatVerticalSlice);

    controller.step({ action: 'move', targetZone: 'edge' }, 2_000);

    expect(controller.getSnapshot().elapsedMs).toBe(0);

    controller.start();
    controller.step({ action: 'move', targetZone: 'edge' }, 2_000);

    expect(controller.getSnapshot().elapsedMs).toBe(2_000);
  });

  it('publishes a completed summary when forced complete is called', () => {
    const controller = createVerticalSliceController(minorityThreatVerticalSlice);
    controller.start();
    controller.complete();

    expect(controller.getSnapshot().completed).toBe(true);
    expect(controller.getSnapshot().summary?.label).toBe('Survived');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
corepack pnpm --filter pit-game exec vitest run src/game/runtime/vertical-slice-session.spec.ts src/game/runtime/vertical-slice-controller.spec.ts
```

Expected:

- FAIL because the current session does not yet express the intended stagger/down loop strongly enough
- or FAIL because the updated lifecycle and completion expectations are not met

- [ ] **Step 3: Implement the richer player state loop**

```ts
// apps/pit-game/src/game/runtime/vertical-slice-session.ts
export interface VerticalSlicePlayerState {
  zone: VerticalSliceZone;
  stamina: number;
  balance: number;
  pose: 'move' | 'shove' | 'brace' | 'slip' | 'stagger' | 'fall' | 'recover';
  status: 'upright' | 'staggered' | 'down';
  control: 'stable' | 'stagger' | 'down';
}

function resolvePressureSeverity(frame: VerticalSliceFrame, zone: VerticalSliceZone) {
  const pressure = frame.zonePressure[zone];
  if (frame.dangerKind === 'crush') {
    return pressure * 0.42;
  }
  if (frame.dangerKind === 'surge') {
    return pressure * 0.34;
  }
  return pressure * 0.26;
}

function resolveMitigation(frame: VerticalSliceFrame, action: VerticalSliceAction) {
  if (frame.dangerKind === 'crush' && action === 'brace') {
    return 28;
  }
  if (frame.dangerKind === 'surge' && action === 'slip') {
    return 24;
  }
  if (action === 'shove') {
    return 10;
  }
  return action === 'move' ? 4 : 0;
}

export function completeVerticalSliceSession(
  session: VerticalSliceSession,
  input: VerticalSliceInput = { action: 'idle', targetZone: session.player.zone },
): VerticalSliceSession {
  if (session.completed) {
    return session;
  }

  return {
    ...session,
    completed: true,
    failed: false,
    frame: session.frame,
    player: {
      ...session.player,
      zone: input.targetZone,
      pose: session.player.status === 'down' ? 'recover' : session.player.pose,
    },
    summary: {
      label: 'Survived',
      downCount: session.downCount,
      hitWindows: session.hitWindows,
    },
  };
}
```

```ts
// apps/pit-game/src/game/runtime/vertical-slice-controller.ts
export interface VerticalSliceController {
  subscribe(listener: (session: VerticalSliceSession) => void): () => void;
  getSnapshot(): VerticalSliceSession;
  step(input: VerticalSliceInput, dtMs: number): void;
  start(): void;
  pause(): void;
  complete(): void;
  isRunning(): boolean;
  reset(): void;
}
```

- [ ] **Step 4: Run the control-loop tests to verify they pass**

Run:

```bash
corepack pnpm --filter pit-game exec vitest run src/game/runtime/vertical-slice-session.spec.ts src/game/runtime/vertical-slice-controller.spec.ts
```

Expected:

- PASS with readable `stable -> stagger -> down` behavior and explicit controller lifecycle gating

- [ ] **Step 5: Commit**

```bash
git add apps/pit-game/src/game/runtime/vertical-slice-session.ts apps/pit-game/src/game/runtime/vertical-slice-session.spec.ts apps/pit-game/src/game/runtime/vertical-slice-controller.ts apps/pit-game/src/game/runtime/vertical-slice-controller.spec.ts
git commit -m "feat: add the minority threat pressure loop"
```

### Task 4: Rebuild the slice scene around venue layout, player animation, and crowd presentation

**Files:**
- Create: `apps/pit-game/src/game/runtime/vertical-slice-venue.ts`
- Create: `apps/pit-game/src/game/runtime/vertical-slice-venue.spec.ts`
- Create: `apps/pit-game/src/game/runtime/vertical-slice-presentation.ts`
- Create: `apps/pit-game/src/game/runtime/vertical-slice-presentation.spec.ts`
- Modify: `apps/pit-game/src/game/runtime/vertical-slice-scene.ts`
- Modify: `apps/pit-game/src/game/runtime/vertical-slice-scene.spec.ts`
- Modify: `apps/pit-game/src/game/runtime/create-vertical-slice-game.ts`

- [ ] **Step 1: Write the failing venue and presentation tests**

```ts
// apps/pit-game/src/game/runtime/vertical-slice-venue.spec.ts
import { describe, expect, it } from 'vitest';

import { resolveCameraShoulderFrame, resolveVenueAnchor } from './vertical-slice-venue';

describe('vertical slice venue', () => {
  it('keeps the player anchored in a readable shoulder frame', () => {
    const camera = resolveCameraShoulderFrame('center');

    expect(camera.playerScreenX).toBeGreaterThan(420);
    expect(camera.playerScreenX).toBeLessThan(720);
    expect(camera.playerScreenY).toBeGreaterThan(430);
  });

  it('separates stage, center pit, and edge lane anchors', () => {
    expect(resolveVenueAnchor('stage').y).toBeLessThan(resolveVenueAnchor('center').y);
    expect(resolveVenueAnchor('edge').y).toBeGreaterThan(resolveVenueAnchor('center').y);
  });
});
```

```ts
// apps/pit-game/src/game/runtime/vertical-slice-presentation.spec.ts
import { describe, expect, it } from 'vitest';

import { minorityThreatVerticalSlice } from '../fixtures/minority-threat-vertical-slice';
import { createVerticalSliceSession } from './vertical-slice-session';
import { createSliceRenderState } from './vertical-slice-presentation';

describe('createSliceRenderState', () => {
  it('renders a shoulder-framed player rig and dense center crowd during the peak', () => {
    const session = createVerticalSliceSession(minorityThreatVerticalSlice);
    session.elapsedMs = 12_000;

    const renderState = createSliceRenderState(session);

    expect(renderState.player.animation).toBeDefined();
    expect(renderState.camera.mode).toBe('pressure');
    expect(renderState.crowd.center.length).toBeGreaterThan(renderState.crowd.edge.length);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
corepack pnpm --filter pit-game exec vitest run src/game/runtime/vertical-slice-venue.spec.ts src/game/runtime/vertical-slice-presentation.spec.ts src/game/runtime/vertical-slice-scene.spec.ts
```

Expected:

- FAIL because the new presentation and venue files do not exist yet

- [ ] **Step 3: Implement venue geometry, presentation derivation, and scene rendering**

```ts
// apps/pit-game/src/game/runtime/vertical-slice-venue.ts
import type { VerticalSliceZone } from './vertical-slice-session';

export function resolveVenueAnchor(key: 'stage' | 'front' | 'center' | 'edge') {
  switch (key) {
    case 'stage':
      return { x: 640, y: 146 };
    case 'front':
      return { x: 640, y: 286 };
    case 'center':
      return { x: 640, y: 452 };
    case 'edge':
      return { x: 640, y: 628 };
  }
}

export function resolveCameraShoulderFrame(zone: VerticalSliceZone) {
  return {
    playerScreenX: zone === 'side' ? 560 : 620,
    playerScreenY: zone === 'front' ? 470 : 520,
    zoom: zone === 'front' ? 1.08 : 1.02,
  };
}
```

```ts
// apps/pit-game/src/game/runtime/vertical-slice-presentation.ts
import type { VerticalSliceSession } from './vertical-slice-session';
import { resolveCameraShoulderFrame, resolveVenueAnchor } from './vertical-slice-venue';

export function createSliceRenderState(session: VerticalSliceSession) {
  const centerDensity = session.frame.zonePressure.center;
  const edgeDensity = session.frame.zonePressure.edge;
  const cameraFrame = resolveCameraShoulderFrame(session.player.zone);

  return {
    camera: {
      mode: session.frame.cameraCue === 'impact' ? 'impact' : 'pressure',
      zoom: cameraFrame.zoom,
      playerScreenX: cameraFrame.playerScreenX,
      playerScreenY: cameraFrame.playerScreenY,
    },
    venue: {
      stage: resolveVenueAnchor('stage'),
      front: resolveVenueAnchor('front'),
      center: resolveVenueAnchor('center'),
      edge: resolveVenueAnchor('edge'),
      lightCue: session.frame.lightCue,
    },
    player: {
      animation:
        session.player.status === 'down'
          ? 'fall'
          : session.player.pose === 'brace'
            ? 'brace'
            : session.player.pose === 'slip'
              ? 'slip'
              : session.player.pose === 'shove'
                ? 'shove'
                : session.player.status === 'staggered'
                  ? 'stagger'
                  : 'move',
    },
    crowd: {
      center: Array.from({ length: Math.max(8, Math.floor(centerDensity / 10)) }),
      edge: Array.from({ length: Math.max(3, Math.floor(edgeDensity / 18)) }),
      side: Array.from({ length: Math.max(4, Math.floor(session.frame.zonePressure.side / 16)) }),
      front: Array.from({ length: Math.max(4, Math.floor(session.frame.zonePressure.front / 18)) }),
    },
  };
}
```

```ts
// apps/pit-game/src/game/runtime/vertical-slice-scene.ts
import { createSliceRenderState } from './vertical-slice-presentation';

// inside renderSnapshot
const renderState = createSliceRenderState(snapshot);

this.player.setPosition(
  renderState.camera.playerScreenX,
  renderState.camera.playerScreenY,
);

this.cameras.main.setZoom(renderState.camera.zoom);

if (renderState.camera.mode === 'impact') {
  this.cameras.main.shake(110, 0.0045);
}

// draw stage / barrier / floor / rows from renderState.venue and renderState.crowd
```

- [ ] **Step 4: Run the presentation tests to verify they pass**

Run:

```bash
corepack pnpm --filter pit-game exec vitest run src/game/runtime/vertical-slice-venue.spec.ts src/game/runtime/vertical-slice-presentation.spec.ts src/game/runtime/vertical-slice-scene.spec.ts
```

Expected:

- PASS with the new venue geometry and presentation state layer

- [ ] **Step 5: Commit**

```bash
git add apps/pit-game/src/game/runtime/vertical-slice-venue.ts apps/pit-game/src/game/runtime/vertical-slice-venue.spec.ts apps/pit-game/src/game/runtime/vertical-slice-presentation.ts apps/pit-game/src/game/runtime/vertical-slice-presentation.spec.ts apps/pit-game/src/game/runtime/vertical-slice-scene.ts apps/pit-game/src/game/runtime/vertical-slice-scene.spec.ts apps/pit-game/src/game/runtime/create-vertical-slice-game.ts
git commit -m "feat: rebuild the minority threat scene presentation"
```

### Task 5: Sync audio, completion, and replay into one complete browser run

**Files:**
- Modify: `apps/pit-game/src/components/MinorityThreatShell.tsx`
- Modify: `apps/pit-game/src/components/MinorityThreatShell.spec.ts`
- Modify: `apps/pit-game/src/game/runtime/vertical-slice-audio.ts`
- Modify: `apps/pit-game/src/game/runtime/vertical-slice-audio.spec.ts`
- Modify: `apps/pit-game/src/smoke.spec.ts`
- Modify: `apps/pit-game/src/styles.css`

- [ ] **Step 1: Write the failing audio/runtime integration tests**

```ts
// apps/pit-game/src/components/MinorityThreatShell.spec.ts
it('does not advance the run until the audio play event fires', async () => {
  const view = await renderShell();
  const input = getFileInput(view.container);
  const startButton = getStartButton(view.container);

  selectFile(
    input,
    new File(['ok'], 'Minority Unit - Minority Threat.mp3', { type: 'audio/mpeg' }),
  );
  act(() => {
    shellFixtures.currentAudio?.dispatchEvent(new Event('loadedmetadata'));
  });

  act(() => {
    startButton.click();
  });

  expect(shellFixtures.startSpy).not.toHaveBeenCalled();

  act(() => {
    shellFixtures.currentAudio?.dispatchEvent(new Event('play'));
  });

  expect(shellFixtures.startSpy).toHaveBeenCalledTimes(1);
});

it('completes the run when playback crosses the authored segment end', async () => {
  const view = await renderShell();
  const input = getFileInput(view.container);

  selectFile(
    input,
    new File(['ok'], 'Minority Unit - Minority Threat.mp3', { type: 'audio/mpeg' }),
  );
  act(() => {
    shellFixtures.currentAudio!.currentTime = 76;
    shellFixtures.currentAudio?.dispatchEvent(new Event('timeupdate'));
  });

  expect(shellFixtures.completeSpy).toHaveBeenCalledTimes(1);
  expect(view.container.textContent).toContain('Replay Slice');

  await view.unmount();
});
```

```ts
// apps/pit-game/src/game/runtime/vertical-slice-audio.spec.ts
import { describe, expect, it } from 'vitest';

import { buildSliceAudioElement } from './vertical-slice-audio';

describe('buildSliceAudioElement', () => {
  it('starts at the authored slice offset and preserves the authored end for callers', () => {
    const audio = buildSliceAudioElement(
      { segmentStartMs: 46_000, segmentEndMs: 76_000 },
      'blob:minority-threat',
    );

    expect(audio.currentTime).toBe(46);
    expect(audio.dataset.sliceEndSeconds).toBe('76');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
corepack pnpm --filter pit-game exec vitest run src/game/runtime/vertical-slice-audio.spec.ts src/components/MinorityThreatShell.spec.ts
```

Expected:

- FAIL because the current shell still needs the richer complete replay contract and play-event gating assertions

- [ ] **Step 3: Implement the final run contract**

```ts
// apps/pit-game/src/game/runtime/vertical-slice-audio.ts
export function buildSliceAudioElement(
  source: Pick<VerticalSliceAudioSource, 'segmentStartMs' | 'segmentEndMs'>,
  objectUrl: string,
): HTMLAudioElement {
  const audio = document.createElement('audio');
  audio.src = objectUrl;
  audio.preload = 'auto';
  audio.currentTime = source.segmentStartMs / 1_000;
  audio.dataset.sliceEndSeconds = String(source.segmentEndMs / 1_000);
  return audio;
}
```

```ts
// apps/pit-game/src/components/MinorityThreatShell.tsx
const [runResult, setRunResult] = useState<{
  label: 'Survived' | 'Dropped';
  downCount: number;
  hitWindows: number;
} | null>(null);

const startSlice = async () => {
  if (!audioRef.current || !isAudioReady) {
    return;
  }

  controller.reset();
  setRunResult(null);
  audioRef.current.pause();
  audioRef.current.currentTime = minorityThreatVerticalSlice.audio.segmentStartMs / 1_000;

  try {
    await audioRef.current.play();
  } catch {
    controller.pause();
    setError('Could not start audio playback. Click Start Slice again.');
  }
};

useEffect(() => {
  const audio = audioRef.current;
  if (!audio) {
    return;
  }

  const sliceEndSeconds = Number(audio.dataset.sliceEndSeconds ?? '0');

  const handlePlay = () => controller.start();
  const handlePause = () => controller.pause();
  const handleTimeUpdate = () => {
    if (audio.currentTime < sliceEndSeconds) {
      return;
    }

    controller.complete();
    setRunResult(controller.getSnapshot().summary);
    audio.pause();
  };

  audio.addEventListener('play', handlePlay);
  audio.addEventListener('pause', handlePause);
  audio.addEventListener('timeupdate', handleTimeUpdate);

  return () => {
    audio.removeEventListener('play', handlePlay);
    audio.removeEventListener('pause', handlePause);
    audio.removeEventListener('timeupdate', handleTimeUpdate);
  };
}, [controller, isAudioReady, loadedFileName]);
```

```ts
// apps/pit-game/src/smoke.spec.ts
it('renders the playable browser slice shell', () => {
  const html = renderToStaticMarkup(createElement(App));

  expect(html).toContain('Minority Threat');
  expect(html).toContain('Replay Slice');
  expect(html).not.toContain('C:/Users/Nick/Desktop');
});
```

- [ ] **Step 4: Run the full verification**

Run:

```bash
corepack pnpm --filter pit-game test
corepack pnpm --filter pit-game build
corepack pnpm test
corepack pnpm --filter pit-game dev -- --host 127.0.0.1 --clearScreen false
```

Expected:

- `pit-game` tests PASS
- `pit-game` build PASS
- root `pnpm test` PASS
- Vite dev server starts and serves `http://127.0.0.1:5173`

Manual browser checklist before closing the task:

1. open `http://127.0.0.1:5173`
2. confirm the default view reads like a game and not a tool
3. confirm the slice does not advance before `Start Slice`
4. confirm the run completes at the authored segment boundary
5. confirm the result state offers immediate replay
6. confirm the lab still opens as a secondary mode

- [ ] **Step 5: Commit**

```bash
git add apps/pit-game/src/components/MinorityThreatShell.tsx apps/pit-game/src/components/MinorityThreatShell.spec.ts apps/pit-game/src/game/runtime/vertical-slice-audio.ts apps/pit-game/src/game/runtime/vertical-slice-audio.spec.ts apps/pit-game/src/smoke.spec.ts apps/pit-game/src/styles.css
git commit -m "feat: finish the playable browser slice run loop"
```

---

## Spec Coverage Check

- **Game-first browser delivery:** Covered by Task 1 shell/overlay changes.
- **Third-person shoulder presentation:** Covered by Task 4 venue and presentation layers.
- **Visible player body and readable states:** Covered by Tasks 3 and 4.
- **Physical crowd pressure and impact:** Covered by Tasks 2, 3, and 4.
- **Dirty livehouse scene, lighting, and camera:** Covered by Task 4 and Task 5 polish.
- **Single complete 30-second run:** Covered by Tasks 2, 3, and 5.
- **Audio/gameplay contract:** Covered by Tasks 3 and 5.
- **Lab remains secondary:** Covered by Task 1 and preserved in Task 5 verification.

## Placeholder Scan

- No `TBD`, `TODO`, or deferred placeholders remain.
- Each task includes exact file paths, test commands, and concrete implementation snippets.
- No task assumes a future subsystem that is not defined in earlier tasks.

## Type Consistency Check

- The authored slice remains `minorityThreatVerticalSlice` across all tasks.
- The primary runtime stays `VerticalSliceController` + `VerticalSliceSession`.
- The new top-level boot component is consistently named `MinorityThreatRunOverlay`.
- The new presentation layer is consistently named `createSliceRenderState`.
- The venue constants live in `vertical-slice-venue.ts` throughout.
