# Hardcore Music Game Phase 2 Alpha Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the current `apps/pit-game` vertical slice into a repeatable alpha milestone with clearer zone readability, stronger section feedback, post-run evaluation, reviewed-profile persistence, and a stable sample-song regression loop.

**Architecture:** Keep the current split between pure TypeScript domain/runtime modules and the thin React + Phaser shell. Add new pure modules for session feedback, run evaluation, and reviewed-profile storage first, then wire them into `App`, `GameHud`, `ReviewPanel`, and `pit-scene` so the UX changes stay testable and deterministic.

**Tech Stack:** TypeScript, React 18, Vite 7, Phaser 3, Web Audio API, localStorage, Vitest, pnpm workspace

---

## Scope Check

This plan is intentionally narrower than a content expansion pass. It does not add multiplayer, networking, new venues, or professional-grade DSP. It focuses on making the current single-venue, upload-driven prototype easier to read, easier to iterate on, and more trustworthy as an internal playtest build.

## File Structure

### Create

- `apps/pit-game/src/game/domain/session-feedback.ts`
  Pure helpers that translate section, zone, and action state into readable UI messaging and danger labels.
- `apps/pit-game/src/game/domain/session-feedback.spec.ts`
  Tests for section banners, action prompts, and danger escalation.
- `apps/pit-game/src/game/domain/run-rating.ts`
  Pure run-evaluation logic for `Survival`, `Rhythm`, `Presence`, `Respect`, and final scene-flavored labels.
- `apps/pit-game/src/game/domain/run-rating.spec.ts`
  Tests for run scoring and final label assignment.
- `apps/pit-game/src/game/persistence/song-profile-storage.ts`
  Local reviewed-profile persistence and retrieval helpers.
- `apps/pit-game/src/game/persistence/song-profile-storage.spec.ts`
  Tests for save/load/delete round-tripping.
- `apps/pit-game/src/game/fixtures/profile-library.ts`
  A small curated set of sample `SongProfile` fixtures used for manual play and regression coverage.
- `apps/pit-game/src/game/analysis/song-profile-regression.spec.ts`
  Regression tests that lock in draft-profile generation behavior against representative fixture inputs.
- `apps/pit-game/src/components/ResultsPanel.tsx`
  End-of-run panel for the four-axis rating and final label.
- `apps/pit-game/src/components/ProfileLibrary.tsx`
  React picker for loading saved and built-in sample profiles without re-uploading.

### Modify

- `apps/pit-game/src/game/runtime/game-session.ts`
  Track session stats, completion state, last action, and derived feedback.
- `apps/pit-game/src/game/runtime/game-session.spec.ts`
  Extend coverage for session completion, score accumulation, and result generation.
- `apps/pit-game/src/game/runtime/runtime-controller.ts`
  Expose run reset, completion, and result snapshots cleanly to React and Phaser.
- `apps/pit-game/src/game/runtime/runtime-controller.spec.ts`
  Cover result snapshots after song completion.
- `apps/pit-game/src/game/runtime/pit-scene.ts`
  Make the four venue zones visually distinct and render current-zone emphasis.
- `apps/pit-game/src/game/runtime/pit-scene.spec.ts`
  Lock down readable zone palette/layout helpers.
- `apps/pit-game/src/components/GameHud.tsx`
  Show section banner, zone prompt, danger state, and current action feedback.
- `apps/pit-game/src/components/ReviewPanel.tsx`
  Support chaos overrides and reviewed-profile save actions.
- `apps/pit-game/src/components/UploadPanel.tsx`
  Surface clearer import status and hand off into the persistence-aware shell.
- `apps/pit-game/src/App.tsx`
  Coordinate profile library, upload, review, play, and result states.
- `apps/pit-game/src/styles.css`
  Add stronger alpha layout, zone legend, banner, result, and library styles.
- `apps/pit-game/src/game/review/review-session.ts`
  Add chaos overrides and reviewed-profile naming.
- `apps/pit-game/src/game/review/review-session.spec.ts`
  Cover chaos overrides and save-ready reviewed profiles.
- `apps/pit-game/src/game/analysis/draft-song-profile.ts`
  Tighten coarse bucketing heuristics and fixture-driven fallback behavior.

## Preconditions

- Work on a dedicated feature branch or worktree from the current `main`.
- Reuse the existing `SongProfile`, `ReviewSession`, and `GameSession` module boundaries instead of collapsing more logic into `App.tsx`.
- Keep Phaser rendering logic thin; if a new visual rule needs a test, extract a pure helper and test that helper instead of testing Phaser internals directly.
- Do not add network persistence or server APIs. Phase 2 persistence is browser-local only.
- Treat sample fixtures as internal regression aids, not player-facing licensed content.

### Task 1: Add Readable Session Feedback And Stronger Zone Presentation

**Files:**
- Create: `apps/pit-game/src/game/domain/session-feedback.ts`
- Create: `apps/pit-game/src/game/domain/session-feedback.spec.ts`
- Modify: `apps/pit-game/src/game/runtime/game-session.ts`
- Modify: `apps/pit-game/src/game/runtime/game-session.spec.ts`
- Modify: `apps/pit-game/src/game/runtime/pit-scene.ts`
- Modify: `apps/pit-game/src/game/runtime/pit-scene.spec.ts`
- Modify: `apps/pit-game/src/components/GameHud.tsx`
- Modify: `apps/pit-game/src/styles.css`

- [ ] **Step 1: Write the failing feedback and zone tests**

```ts
// apps/pit-game/src/game/domain/session-feedback.spec.ts
import { describe, expect, it } from 'vitest';

import { buildSessionFeedback } from './session-feedback';

describe('session feedback', () => {
  it('marks breakdown windows as critical and recommends brace', () => {
    expect(
      buildSessionFeedback({
        section: 'breakdown',
        zone: 'center',
        currentMission: 'center-hold',
        lastAction: 'idle',
        chaos: 0.94,
      }),
    ).toMatchObject({
      dangerLabel: 'critical',
      actionPrompt: 'Brace or slip before the room collapses.',
      zonePrompt: 'Hold center only if you can keep your balance.',
    });
  });
});
```

```ts
// apps/pit-game/src/game/runtime/pit-scene.spec.ts
import { describe, expect, it } from 'vitest';

import { getZoneVisualState } from './pit-scene';

describe('pit scene zone visuals', () => {
  it('keeps front and center visually distinct', () => {
    const center = getZoneVisualState('center', 'center', 'critical');
    const front = getZoneVisualState('front', 'center', 'critical');

    expect(center.fillColor).not.toBe(front.fillColor);
    expect(front.label).toBe('Front Pressure');
  });
});
```

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `corepack pnpm --filter pit-game test -- src/game/domain/session-feedback.spec.ts src/game/runtime/pit-scene.spec.ts`

Expected: FAIL with missing `session-feedback` exports and missing `getZoneVisualState`.

- [ ] **Step 3: Implement pure feedback helpers and zone-visual mapping**

```ts
// apps/pit-game/src/game/domain/session-feedback.ts
import type { PlayerAction, PlayerZone } from './player-state';
import type { SectionKind } from './song-profile';

type MissionId = 'survive-window' | 'center-hold' | 'help-fallen' | 'cross-line';

export interface SessionFeedbackInput {
  section: SectionKind;
  zone: PlayerZone;
  currentMission: MissionId;
  lastAction: PlayerAction;
  chaos: number;
}

export interface SessionFeedback {
  banner: string;
  dangerLabel: 'cooling' | 'building' | 'critical';
  actionPrompt: string;
  zonePrompt: string;
}

const sectionBannerMap: Record<SectionKind, string> = {
  gather: 'Room Forming',
  push: 'Pit Opening',
  'two-step': 'Two-Step Window',
  'side-to-side prep': 'Side To Side Loading',
  breakdown: 'Breakdown Hit',
  recovery: 'Aftermath',
};

export function buildSessionFeedback(input: SessionFeedbackInput): SessionFeedback {
  const dangerLabel =
    input.chaos >= 0.82 ? 'critical' : input.chaos >= 0.5 ? 'building' : 'cooling';

  return {
    banner: sectionBannerMap[input.section],
    dangerLabel,
    actionPrompt:
      input.section === 'breakdown'
        ? 'Brace or slip before the room collapses.'
        : input.section === 'recovery'
          ? 'Lift now if you want the respect bonus.'
          : 'Stay loose and keep reading the crowd.',
    zonePrompt:
      input.zone === 'center'
        ? 'Hold center only if you can keep your balance.'
        : input.zone === 'front'
          ? 'Front pressure is steady damage. Commit only if you need presence.'
          : input.zone === 'side'
            ? 'Side lane gives you a safer crossing angle.'
            : 'Edge buys breathing room and rescue windows.',
  };
}
```

```ts
// apps/pit-game/src/game/runtime/pit-scene.ts
export function getZoneVisualState(
  zone: PlayerZone,
  selectedZone: PlayerZone,
  danger: 'cooling' | 'building' | 'critical',
) {
  const palette = {
    edge: { fillColor: 0x2e4736, label: 'Edge Lane' },
    center: { fillColor: 0x5b1f19, label: 'Center Pit' },
    front: { fillColor: 0x1f2436, label: 'Front Pressure' },
    side: { fillColor: 0x49321f, label: 'Side Lane' },
  } satisfies Record<PlayerZone, { fillColor: number; label: string }>;

  const selected = zone === selectedZone;
  const dangerBoost = danger === 'critical' && zone === 'center' ? 0.92 : 0.56;

  return {
    ...palette[zone],
    alpha: selected ? Math.max(0.88, dangerBoost) : dangerBoost,
    strokeColor: selected ? 0xf2d39a : 0x000000,
  };
}
```

- [ ] **Step 4: Thread feedback through `GameSession` and `GameHud`**

```ts
// apps/pit-game/src/game/runtime/game-session.ts
import { buildSessionFeedback, type SessionFeedback } from '../domain/session-feedback';

export interface SessionStats {
  downCount: number;
  rescueCount: number;
  centerHoldMs: number;
  totalActionMs: number;
  onBeatActions: number;
  mistimedActions: number;
}

export interface GameSession {
  profile: SongProfile;
  elapsedMs: number;
  frame: ShowFrame;
  crowd: CrowdState;
  player: PlayerState;
  currentMission: 'survive-window' | 'center-hold' | 'help-fallen' | 'cross-line';
  failed: boolean;
  completed: boolean;
  lastAction: PlayerInput['action'];
  feedback: SessionFeedback;
  stats: SessionStats;
  result: null;
}
```

```tsx
// apps/pit-game/src/components/GameHud.tsx
export function GameHud({ session }: GameHudProps) {
  return (
    <aside className='hud panel'>
      <span className={`section-banner danger-${session.feedback.dangerLabel}`}>
        {session.feedback.banner}
      </span>
      <h2>{session.profile.title}</h2>
      <p>Mission: {session.currentMission}</p>
      <p>Zone: {session.player.zone}</p>
      <p>Prompt: {session.feedback.actionPrompt}</p>
      <p>Positioning: {session.feedback.zonePrompt}</p>
      <p>Stamina: {session.player.stamina.toFixed(0)}</p>
      <p>Balance: {session.player.balance.toFixed(0)}</p>
      <p>Respect: {session.player.respect.toFixed(0)}</p>
    </aside>
  );
}
```

- [ ] **Step 5: Run the expanded feedback/session suite**

Run: `corepack pnpm --filter pit-game test -- src/game/domain/session-feedback.spec.ts src/game/runtime/game-session.spec.ts src/game/runtime/pit-scene.spec.ts`

Expected: PASS with session feedback and zone readability covered.

- [ ] **Step 6: Commit the readability polish foundation**

```bash
git add apps/pit-game/src/game/domain/session-feedback.ts apps/pit-game/src/game/domain/session-feedback.spec.ts apps/pit-game/src/game/runtime/game-session.ts apps/pit-game/src/game/runtime/game-session.spec.ts apps/pit-game/src/game/runtime/pit-scene.ts apps/pit-game/src/game/runtime/pit-scene.spec.ts apps/pit-game/src/components/GameHud.tsx apps/pit-game/src/styles.css
git commit -m "feat: improve pit game readability feedback"
```

### Task 2: Add Post-Run Evaluation And Results Presentation

**Files:**
- Create: `apps/pit-game/src/game/domain/run-rating.ts`
- Create: `apps/pit-game/src/game/domain/run-rating.spec.ts`
- Create: `apps/pit-game/src/components/ResultsPanel.tsx`
- Modify: `apps/pit-game/src/game/runtime/game-session.ts`
- Modify: `apps/pit-game/src/game/runtime/game-session.spec.ts`
- Modify: `apps/pit-game/src/game/runtime/runtime-controller.ts`
- Modify: `apps/pit-game/src/game/runtime/runtime-controller.spec.ts`
- Modify: `apps/pit-game/src/App.tsx`
- Modify: `apps/pit-game/src/styles.css`

- [ ] **Step 1: Write the failing run-rating tests**

```ts
// apps/pit-game/src/game/domain/run-rating.spec.ts
import { describe, expect, it } from 'vitest';

import { rateRun } from './run-rating';

describe('run rating', () => {
  it('awards a strong scene label for a clean complete run', () => {
    expect(
      rateRun({
        completed: true,
        failed: false,
        profileDurationMs: 96_000,
        elapsedMs: 96_000,
        stats: {
          downCount: 0,
          rescueCount: 2,
          centerHoldMs: 18_000,
          totalActionMs: 42_000,
          onBeatActions: 10,
          mistimedActions: 2,
        },
        respect: 86,
      }),
    ).toMatchObject({
      finalLabel: 'Real One',
      categories: {
        Survival: expect.any(Number),
        Rhythm: expect.any(Number),
        Presence: expect.any(Number),
        Respect: expect.any(Number),
      },
    });
  });
});
```

- [ ] **Step 2: Run the run-rating tests to verify they fail**

Run: `corepack pnpm --filter pit-game test -- src/game/domain/run-rating.spec.ts`

Expected: FAIL with `Cannot find module './run-rating'`.

- [ ] **Step 3: Implement pure run-evaluation logic**

```ts
// apps/pit-game/src/game/domain/run-rating.ts
import type { SessionStats } from '../runtime/game-session';

export interface RunRatingInput {
  completed: boolean;
  failed: boolean;
  profileDurationMs: number;
  elapsedMs: number;
  stats: SessionStats;
  respect: number;
}

export interface RunRating {
  categories: {
    Survival: number;
    Rhythm: number;
    Presence: number;
    Respect: number;
  };
  finalLabel: 'Crowd Meat' | 'Held Ground' | 'Pit Regular' | 'Real One';
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function rateRun(input: RunRatingInput): RunRating {
  const survivalBase = input.completed ? 88 : (input.elapsedMs / input.profileDurationMs) * 70;
  const rhythmAttempts = input.stats.onBeatActions + input.stats.mistimedActions;
  const rhythmRatio = rhythmAttempts === 0 ? 0 : input.stats.onBeatActions / rhythmAttempts;

  const categories = {
    Survival: clampScore(survivalBase - input.stats.downCount * 18 - (input.failed ? 12 : 0)),
    Rhythm: clampScore(rhythmRatio * 100),
    Presence: clampScore(
      (input.stats.centerHoldMs / Math.max(1, input.profileDurationMs)) * 220 +
        (input.stats.totalActionMs / Math.max(1, input.profileDurationMs)) * 80,
    ),
    Respect: clampScore(input.respect + input.stats.rescueCount * 8),
  };

  const average =
    (categories.Survival + categories.Rhythm + categories.Presence + categories.Respect) / 4;

  return {
    categories,
    finalLabel:
      average >= 80
        ? 'Real One'
        : average >= 60
          ? 'Pit Regular'
          : average >= 40
            ? 'Held Ground'
            : 'Crowd Meat',
  };
}
```

- [ ] **Step 4: Extend the session model and results UI**

```tsx
// apps/pit-game/src/components/ResultsPanel.tsx
import type { RunRating } from '../game/domain/run-rating';

interface ResultsPanelProps {
  result: RunRating | null;
  onRestart(): void;
}

export function ResultsPanel({ result, onRestart }: ResultsPanelProps) {
  if (!result) {
    return null;
  }

  return (
    <section className='panel results-panel'>
      <h2>{result.finalLabel}</h2>
      <p>Survival: {result.categories.Survival}</p>
      <p>Rhythm: {result.categories.Rhythm}</p>
      <p>Presence: {result.categories.Presence}</p>
      <p>Respect: {result.categories.Respect}</p>
      <button type='button' className='form-control' onClick={onRestart}>
        Run It Back
      </button>
    </section>
  );
}
```

```ts
// apps/pit-game/src/game/runtime/game-session.ts
import { rateRun, type RunRating } from '../domain/run-rating';

export interface GameSession {
  // existing fields...
  result: RunRating | null;
}
```

- [ ] **Step 5: Wire result rendering into `App.tsx`**

```tsx
// apps/pit-game/src/App.tsx
import { ResultsPanel } from './components/ResultsPanel';

<ResultsPanel
  result={session.result}
  onRestart={() => {
    controller.reset(session.profile);
    setSession(controller.getSnapshot());
  }}
/>
```

- [ ] **Step 6: Run the evaluation-focused suite**

Run: `corepack pnpm --filter pit-game test -- src/game/domain/run-rating.spec.ts src/game/runtime/game-session.spec.ts src/game/runtime/runtime-controller.spec.ts`

Expected: PASS with result generation covered.

- [ ] **Step 7: Commit the result-system work**

```bash
git add apps/pit-game/src/game/domain/run-rating.ts apps/pit-game/src/game/domain/run-rating.spec.ts apps/pit-game/src/components/ResultsPanel.tsx apps/pit-game/src/game/runtime/game-session.ts apps/pit-game/src/game/runtime/game-session.spec.ts apps/pit-game/src/game/runtime/runtime-controller.ts apps/pit-game/src/game/runtime/runtime-controller.spec.ts apps/pit-game/src/App.tsx apps/pit-game/src/styles.css
git commit -m "feat: add pit game run evaluation"
```

### Task 3: Upgrade Review Pass And Save Reviewed Profiles Locally

**Files:**
- Create: `apps/pit-game/src/game/persistence/song-profile-storage.ts`
- Create: `apps/pit-game/src/game/persistence/song-profile-storage.spec.ts`
- Create: `apps/pit-game/src/components/ProfileLibrary.tsx`
- Modify: `apps/pit-game/src/game/review/review-session.ts`
- Modify: `apps/pit-game/src/game/review/review-session.spec.ts`
- Modify: `apps/pit-game/src/components/ReviewPanel.tsx`
- Modify: `apps/pit-game/src/components/UploadPanel.tsx`
- Modify: `apps/pit-game/src/App.tsx`
- Modify: `apps/pit-game/src/styles.css`

- [ ] **Step 1: Write the failing review and storage tests**

```ts
// apps/pit-game/src/game/review/review-session.spec.ts
import { describe, expect, it } from 'vitest';

import { authoredSongProfile } from '../fixtures/authored-song-profile';
import {
  applyChaosOverride,
  applySectionOverride,
  buildPlayableProfile,
  createReviewSession,
} from './review-session';

describe('review session', () => {
  it('applies both section-kind and chaos overrides to the playable profile', () => {
    const session = createReviewSession(authoredSongProfile);
    const relabeled = applySectionOverride(session, 1, 'two-step');
    const retuned = applyChaosOverride(relabeled, 1, 0.73);
    const playable = buildPlayableProfile(retuned);

    expect(playable.sections[1]).toMatchObject({
      kind: 'two-step',
      chaos: 0.73,
    });
  });
});
```

```ts
// apps/pit-game/src/game/persistence/song-profile-storage.spec.ts
import { beforeEach, describe, expect, it } from 'vitest';

import { authoredSongProfile } from '../fixtures/authored-song-profile';
import {
  deleteStoredProfile,
  listStoredProfiles,
  saveStoredProfile,
} from './song-profile-storage';

describe('song profile storage', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('round-trips reviewed profiles through localStorage', () => {
    saveStoredProfile({
      id: 'stored-basement',
      name: 'Stored Basement',
      profile: authoredSongProfile,
    });

    expect(listStoredProfiles()).toHaveLength(1);

    deleteStoredProfile('stored-basement');
    expect(listStoredProfiles()).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the review/storage suite to verify it fails**

Run: `corepack pnpm --filter pit-game test -- src/game/review/review-session.spec.ts src/game/persistence/song-profile-storage.spec.ts`

Expected: FAIL with missing `applyChaosOverride` and missing `song-profile-storage`.

- [ ] **Step 3: Implement review chaos overrides and local profile storage**

```ts
// apps/pit-game/src/game/review/review-session.ts
export interface ReviewSession {
  draft: SongProfile;
  draftName: string;
  overrides: {
    sectionKinds: Record<number, SectionKind>;
    sectionChaos: Record<number, number>;
    reviewedSections: Record<number, true>;
  };
}

export function createReviewSession(draft: SongProfile): ReviewSession {
  return {
    draft,
    draftName: draft.title,
    overrides: {
      sectionKinds: {},
      sectionChaos: {},
      reviewedSections: {},
    },
  };
}

export function applyChaosOverride(session: ReviewSession, index: number, chaos: number): ReviewSession {
  return {
    ...session,
    overrides: {
      ...session.overrides,
      sectionChaos: {
        ...session.overrides.sectionChaos,
        [index]: Number(chaos.toFixed(2)),
      },
      reviewedSections: {
        ...session.overrides.reviewedSections,
        [index]: true,
      },
    },
  };
}
```

```ts
// apps/pit-game/src/game/persistence/song-profile-storage.ts
import type { SongProfile } from '../domain/song-profile';

const storageKey = 'pit-game.song-profiles';

export interface StoredSongProfile {
  id: string;
  name: string;
  profile: SongProfile;
}

export function listStoredProfiles(): StoredSongProfile[] {
  const raw = window.localStorage.getItem(storageKey);
  return raw ? (JSON.parse(raw) as StoredSongProfile[]) : [];
}

export function saveStoredProfile(profile: StoredSongProfile) {
  const nextProfiles = [
    ...listStoredProfiles().filter((item) => item.id !== profile.id),
    profile,
  ];
  window.localStorage.setItem(storageKey, JSON.stringify(nextProfiles));
}

export function deleteStoredProfile(id: string) {
  const nextProfiles = listStoredProfiles().filter((item) => item.id !== id);
  window.localStorage.setItem(storageKey, JSON.stringify(nextProfiles));
}
```

- [ ] **Step 4: Build the review save flow and profile library UI**

```tsx
// apps/pit-game/src/components/ProfileLibrary.tsx
import type { SongProfile } from '../game/domain/song-profile';
import type { StoredSongProfile } from '../game/persistence/song-profile-storage';

interface ProfileLibraryProps {
  builtInProfiles: Array<{ id: string; label: string; profile: SongProfile }>;
  savedProfiles: StoredSongProfile[];
  onLoad(profile: SongProfile): void;
  onDeleteSaved(id: string): void;
}

export function ProfileLibrary({
  builtInProfiles,
  savedProfiles,
  onLoad,
  onDeleteSaved,
}: ProfileLibraryProps) {
  return (
    <section className='panel'>
      <h2>Profile Library</h2>
      {builtInProfiles.map((item) => (
        <button
          key={item.id}
          type='button'
          className='form-control'
          onClick={() => onLoad(item.profile)}
        >
          Load Sample: {item.label}
        </button>
      ))}
      {savedProfiles.map((item) => (
        <div key={item.id} className='library-row'>
          <button
            type='button'
            className='form-control'
            onClick={() => onLoad(item.profile)}
          >
            Load Saved: {item.name}
          </button>
          <button
            type='button'
            className='form-control'
            onClick={() => onDeleteSaved(item.id)}
          >
            Delete
          </button>
        </div>
      ))}
    </section>
  );
}
```

```tsx
// apps/pit-game/src/components/ReviewPanel.tsx
<label className='review-row'>
  <span>Chaos</span>
  <input
    type='range'
    min='0'
    max='1'
    step='0.01'
    value={session.overrides.sectionChaos[index] ?? section.chaos}
    onChange={(event) =>
      onChange(applyChaosOverride(session, index, Number(event.target.value)))
    }
  />
</label>
```

- [ ] **Step 5: Run the review/library suite and build**

Run: `corepack pnpm --filter pit-game test -- src/game/review/review-session.spec.ts src/game/persistence/song-profile-storage.spec.ts && corepack pnpm --filter pit-game build`

Expected: PASS.

- [ ] **Step 6: Commit the persistence and review upgrade**

```bash
git add apps/pit-game/src/game/review/review-session.ts apps/pit-game/src/game/review/review-session.spec.ts apps/pit-game/src/game/persistence/song-profile-storage.ts apps/pit-game/src/game/persistence/song-profile-storage.spec.ts apps/pit-game/src/components/ProfileLibrary.tsx apps/pit-game/src/components/ReviewPanel.tsx apps/pit-game/src/components/UploadPanel.tsx apps/pit-game/src/App.tsx apps/pit-game/src/styles.css
git commit -m "feat: save reviewed pit game profiles locally"
```

### Task 4: Add Sample Profile Library And Regression Coverage For Upload Heuristics

**Files:**
- Create: `apps/pit-game/src/game/fixtures/profile-library.ts`
- Create: `apps/pit-game/src/game/analysis/song-profile-regression.spec.ts`
- Modify: `apps/pit-game/src/game/analysis/draft-song-profile.ts`
- Modify: `apps/pit-game/src/App.tsx`

- [ ] **Step 1: Write the failing regression and library tests**

```ts
// apps/pit-game/src/game/analysis/song-profile-regression.spec.ts
import { describe, expect, it } from 'vitest';

import { buildDraftSongProfile } from './draft-song-profile';

describe('song profile regression', () => {
  it('coalesces dense energy frames into a manageable section count', () => {
    const profile = buildDraftSongProfile({
      title: 'Dense Demo',
      durationMs: 60_000,
      bpm: 180,
      beatGridMs: Array.from({ length: 180 }, (_, index) => index * 333),
      energyFrames: Array.from({ length: 120 }, (_, index) => ({
        atMs: index * 500,
        rms: index < 40 ? 0.18 : index < 80 ? 0.66 : 0.92,
      })),
      impactMoments: [18_000, 36_000, 48_000],
    });

    expect(profile.sections.length).toBeLessThanOrEqual(12);
    expect(profile.sections.some((section) => section.kind === 'breakdown')).toBe(true);
  });
});
```

```ts
// apps/pit-game/src/game/fixtures/profile-library.ts
import type { SongProfile } from '../domain/song-profile';
import { authoredSongProfile } from './authored-song-profile';

export const profileLibrary: Array<{ id: string; label: string; profile: SongProfile }> = [
  { id: 'authored-basement', label: 'Basement Eruption', profile: authoredSongProfile },
];
```

- [ ] **Step 2: Run the regression tests to verify they fail**

Run: `corepack pnpm --filter pit-game test -- src/game/analysis/song-profile-regression.spec.ts`

Expected: FAIL if the regression file does not exist yet.

- [ ] **Step 3: Implement the sample library and tighten regression expectations**

```ts
// apps/pit-game/src/game/fixtures/profile-library.ts
import type { SongProfile } from '../domain/song-profile';
import { authoredSongProfile } from './authored-song-profile';

function cloneProfile(
  profile: SongProfile,
  overrides: Partial<Pick<SongProfile, 'id' | 'title' | 'sections' | 'impacts'>>,
): SongProfile {
  return {
    ...profile,
    ...overrides,
  };
}

export const profileLibrary: Array<{ id: string; label: string; profile: SongProfile }> = [
  { id: 'authored-basement', label: 'Basement Eruption', profile: authoredSongProfile },
  {
    id: 'side-lane-crush',
    label: 'Side Lane Crush',
    profile: cloneProfile(authoredSongProfile, {
      id: 'side-lane-crush',
      title: 'Side Lane Crush',
      sections: authoredSongProfile.sections.map((section, index) =>
        index === 3 ? { ...section, kind: 'side-to-side prep', chaos: 0.79 } : section,
      ),
    }),
  },
  {
    id: 'recovery-heavy',
    label: 'Recovery Heavy',
    profile: cloneProfile(authoredSongProfile, {
      id: 'recovery-heavy',
      title: 'Recovery Heavy',
      sections: authoredSongProfile.sections.map((section, index) =>
        index === authoredSongProfile.sections.length - 1
          ? { ...section, startMs: 68_000, chaos: 0.26 }
          : section,
      ),
    }),
  },
];
```

```ts
// apps/pit-game/src/game/analysis/draft-song-profile.ts
const targetSectionCount = 12;
const minimumSectionMs = 4_000;
```

- [ ] **Step 4: Run the full alpha verification pass**

Run: `corepack pnpm --filter pit-game test`

Expected: PASS with all `pit-game` specs green.

Run: `corepack pnpm --filter pit-game build`

Expected: PASS with the known large-chunk warning still acceptable for alpha.

Run: `corepack pnpm test`

Expected: PASS across the full workspace with `.worktrees/**` excluded from root Vitest calls.

Run: `corepack pnpm --filter pit-game dev -- --host 127.0.0.1 --clearScreen false`

Expected: local dev server boots, authored profile still plays, the zone colors are visually distinct, and saved/sample profiles can be loaded back into play.

- [ ] **Step 5: Commit the regression and sample-library slice**

```bash
git add apps/pit-game/src/game/fixtures/profile-library.ts apps/pit-game/src/game/analysis/song-profile-regression.spec.ts apps/pit-game/src/game/analysis/draft-song-profile.ts apps/pit-game/src/App.tsx
git commit -m "test: add pit game alpha regression coverage"
```

## Two-Week Delivery Shape

### Week 1

1. Finish Task 1 and Task 2.
2. Run repeated playtests on the authored profile until the room reads clearly at a glance.
3. Use the result panel to compare whether small tuning changes improve `Survival` and `Rhythm` rather than just making the game easier.

### Week 2

1. Finish Task 3 and Task 4.
2. Build a repeatable local loop: upload -> review -> save -> replay.
3. Validate at least three distinct profiles from the sample library plus two uploaded tracks.

## Acceptance Criteria

Phase 2 is complete only when all of the following are true:

1. `front`, `center`, `edge`, and `side` are immediately distinguishable without reading code or console logs.
2. The player can tell, from the HUD alone, what section they are in, how dangerous the room is, and what kind of action is currently encouraged.
3. A finished run ends in a visible results state with all four axes and a final label.
4. A reviewed upload can be saved locally and loaded again without re-running audio analysis.
5. The `pit-game` regression suite covers both dense-energy upload input and sample-profile loading.
6. `corepack pnpm --filter pit-game test`, `corepack pnpm --filter pit-game build`, and `corepack pnpm test` all pass on `main`.

## Self-Review

### Spec Coverage

The approved next-step targets from the design are covered as follows:

1. `readability and handfeel` are covered by Task 1.
2. `clear post-run evaluation` is covered by Task 2.
3. `review-pass usability and save/load` are covered by Task 3.
4. `fixture-based regression and multiple sample profiles` are covered by Task 4.

No Phase 2 requirement is left without a corresponding task.

### Placeholder Scan

The plan contains exact file paths, concrete test code, concrete implementation snippets, and exact commands. There are no `TODO`, `TBD`, or “similar to earlier task” placeholders.

### Type Consistency

The plan consistently uses the existing `SongProfile`, `ReviewSession`, `GameSession`, `PlayerZone`, and `PlayerAction` vocabulary already present in `apps/pit-game`. New pure types are introduced as `SessionFeedback`, `RunRating`, and `StoredSongProfile`, and those names stay consistent throughout later tasks.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-20-hardcore-music-game-phase-2-alpha-polish.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
