# Hardcore Music Game Phase 3 Fan Authoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the current upload-and-review prototype into a fan-assisted half-editor with section and impact authoring, local preview loops, and durable saved authoring projects.

**Architecture:** Keep the current pure TypeScript domain modules as the source of truth for analysis, authoring, validation, and preview slicing. Extend the React shell with a timeline editor and preview panel that consume a richer `ReviewSession`, while the gameplay runtime continues to read only validated `SongProfile` data.

**Tech Stack:** TypeScript, React 18, Phaser 3, Vite 7, Vitest, Web Audio API, localStorage, jsdom

---

## Scope Check

This plan is intentionally scoped to `hardcore / beatdown / metalcore` authoring. It does not try to become a general-purpose rhythm editor or a broad music-analysis product. It also keeps persistence browser-local and does **not** store raw audio bytes; saved authoring projects reopen with draft and overlay data intact, and ask the user to relink the local audio file when they want waveform or audio-loop preview after a reload.

## File Structure

### Create

- `apps/pit-game/src/game/domain/analysis-draft.ts`
  Draft-only analysis types for section suggestions, impact candidates, and analyzer warnings.
- `apps/pit-game/src/game/domain/analysis-draft.spec.ts`
  Tests for draft metadata normalization and suggestion defaults.
- `apps/pit-game/src/game/review/preview-window.ts`
  Pure helpers that turn a selected section or impact into a deterministic preview window with pre-roll.
- `apps/pit-game/src/game/review/preview-window.spec.ts`
  Tests for preview slicing and seed stability.
- `apps/pit-game/src/components/TimelineEditor.tsx`
  Timeline UI for section blocks, impact markers, loop range, and beat-grid snapping interactions.
- `apps/pit-game/src/components/TimelineEditor.spec.ts`
  Thin jsdom render test for section selection and loop-range callbacks.
- `apps/pit-game/src/components/PreviewPanel.tsx`
  Audio-loop and playable-preview controls for the current authoring selection.
- `apps/pit-game/src/components/PreviewPanel.spec.ts`
  Thin jsdom render test for preview-state and relink-audio messaging.

### Modify

- `apps/pit-game/package.json`
  Add `jsdom` so component-shell tests can run in Vitest without introducing a larger test stack.
- `apps/pit-game/src/game/domain/song-profile.ts`
  Expand impact vocabulary and tighten validation for authored section and impact shapes.
- `apps/pit-game/src/game/domain/song-profile.spec.ts`
  Cover new impact kinds and authored-profile validation.
- `apps/pit-game/src/game/analysis/draft-song-profile.ts`
  Export `AnalysisDraft` generation while preserving a runtime-only adapter for existing callers.
- `apps/pit-game/src/game/analysis/draft-song-profile.spec.ts`
  Cover draft section suggestions, impact candidates, and heavy-song heuristics.
- `apps/pit-game/src/game/analysis/song-profile-regression.spec.ts`
  Lock in heavy-music draft behavior with `drop`, `hit`, and `stop` candidates.
- `apps/pit-game/src/game/review/review-session.ts`
  Replace the current low-confidence review pass with a full authoring session model.
- `apps/pit-game/src/game/review/review-session.spec.ts`
  Cover section edits, impact edits, warnings, and reviewed-profile generation.
- `apps/pit-game/src/game/persistence/song-profile-storage.ts`
  Migrate from saved reviewed profiles to saved authoring projects with relink-audio support.
- `apps/pit-game/src/game/persistence/song-profile-storage.spec.ts`
  Cover v2 storage, corruption handling, and v1 migration behavior.
- `apps/pit-game/src/game/runtime/runtime-controller.ts`
  Support resetting into preview windows and exposing preview snapshots without forking runtime rules.
- `apps/pit-game/src/game/runtime/runtime-controller.spec.ts`
  Cover reset-with-offset and preview-start behavior.
- `apps/pit-game/src/components/ReviewPanel.tsx`
  Turn the current list-based review pass into the authoring shell with inspector state.
- `apps/pit-game/src/components/ProfileLibrary.tsx`
  Load saved authoring projects back into edit mode and surface relink-audio status.
- `apps/pit-game/src/components/UploadPanel.tsx`
  Return both `AnalysisDraft` data and a local audio source handle for preview.
- `apps/pit-game/src/App.tsx`
  Coordinate upload, authoring, playable preview, save/reopen, and runtime play modes.
- `apps/pit-game/src/styles.css`
  Add timeline, inspector, preview, warning, and relink-audio styles.

## Preconditions

- Work on a dedicated feature branch or worktree from the current `main`.
- Keep the existing runtime contract: Phaser and gameplay systems continue to consume validated `SongProfile` only.
- Do not store raw song files in localStorage. Persist draft plus overlay data only, and require manual audio relink on reload when preview audio is needed.
- Prefer pure helpers for snap, merge, warning, and preview logic so Vitest can lock behavior before React wiring.
- Keep the editor to one timeline, one inspector, and one preview panel. Do not add arbitrary event-track authoring in this pass.

### Task 1: Promote Analyzer Output To `AnalysisDraft`

**Files:**
- Create: `apps/pit-game/src/game/domain/analysis-draft.ts`
- Create: `apps/pit-game/src/game/domain/analysis-draft.spec.ts`
- Modify: `apps/pit-game/src/game/domain/song-profile.ts`
- Modify: `apps/pit-game/src/game/domain/song-profile.spec.ts`
- Modify: `apps/pit-game/src/game/analysis/draft-song-profile.ts`
- Modify: `apps/pit-game/src/game/analysis/draft-song-profile.spec.ts`
- Modify: `apps/pit-game/src/game/analysis/song-profile-regression.spec.ts`

- [ ] **Step 1: Write the failing draft-analysis tests**

```ts
// apps/pit-game/src/game/domain/analysis-draft.spec.ts
import { describe, expect, it } from 'vitest';

import { createAnalysisDraft } from './analysis-draft';

describe('analysis draft', () => {
  it('keeps analyzer candidates separate from the runtime profile', () => {
    const draft = createAnalysisDraft({
      id: 'demo-track',
      sourceTitle: 'Demo Track',
      profile: {
        id: 'demo-track',
        title: 'Demo Track',
        durationMs: 12_000,
        bpm: 150,
        beatGridMs: [0, 400, 800, 1_200],
        sections: [
          { kind: 'push', startMs: 0, endMs: 8_000, confidence: 0.58, chaos: 0.52 },
          { kind: 'recovery', startMs: 8_000, endMs: 12_000, confidence: 0.72, chaos: 0.22 },
        ],
        impacts: [{ atMs: 4_800, strength: 'drop' }],
      },
      sectionSuggestions: [{ index: 0, confidence: 0.58, reasons: ['dense energy plateau'] }],
      impactCandidates: [{ atMs: 4_800, strength: 'hit', confidence: 0.77, reasons: ['sharp transient'] }],
      warnings: ['possible split at 4000ms'],
    });

    expect(draft.impactCandidates[0]?.strength).toBe('hit');
    expect(draft.profile.impacts[0]?.strength).toBe('drop');
    expect(draft.warnings).toContain('possible split at 4000ms');
  });
});
```

```ts
// apps/pit-game/src/game/analysis/draft-song-profile.spec.ts
import { describe, expect, it } from 'vitest';

import { buildAnalysisDraft } from './draft-song-profile';

describe('buildAnalysisDraft', () => {
  it('emits heavy-song impact candidates without mutating the playable profile', () => {
    const draft = buildAnalysisDraft({
      title: 'Break Test',
      durationMs: 16_000,
      bpm: 160,
      beatGridMs: [0, 375, 750, 1_125, 1_500],
      energyFrames: [
        { atMs: 0, rms: 0.18 },
        { atMs: 4_000, rms: 0.62 },
        { atMs: 8_000, rms: 0.91 },
        { atMs: 12_000, rms: 0.11 },
      ],
      impactMoments: [7_500, 8_000, 8_375],
    });

    expect(draft.sectionSuggestions.some((item) => item.reasons.includes('peak energy bucket'))).toBe(true);
    expect(draft.impactCandidates.map((item) => item.strength)).toContain('hit');
    expect(draft.profile.impacts.every((item) => item.strength === 'accent' || item.strength === 'drop')).toBe(true);
  });
});
```

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `corepack pnpm --filter pit-game test -- src/game/domain/analysis-draft.spec.ts src/game/analysis/draft-song-profile.spec.ts`

Expected: FAIL with missing `analysis-draft` exports and missing `buildAnalysisDraft`.

- [ ] **Step 3: Implement `AnalysisDraft`, new impact kinds, and draft generation**

```ts
// apps/pit-game/src/game/domain/song-profile.ts
export type ImpactStrength = 'accent' | 'drop' | 'hit' | 'stop';

export interface ImpactMarker {
  atMs: number;
  strength: ImpactStrength;
}
```

```ts
// apps/pit-game/src/game/domain/analysis-draft.ts
import type { ImpactStrength, SongProfile } from './song-profile';

export interface SectionSuggestion {
  index: number;
  confidence: number;
  reasons: string[];
}

export interface ImpactCandidate {
  atMs: number;
  strength: ImpactStrength;
  confidence: number;
  reasons: string[];
}

export interface AnalysisDraft {
  id: string;
  sourceTitle: string;
  profile: SongProfile;
  sectionSuggestions: SectionSuggestion[];
  impactCandidates: ImpactCandidate[];
  warnings: string[];
}

export function createAnalysisDraft(input: AnalysisDraft): AnalysisDraft {
  return {
    ...input,
    sectionSuggestions: [...input.sectionSuggestions],
    impactCandidates: [...input.impactCandidates].sort((left, right) => left.atMs - right.atMs),
    warnings: [...input.warnings],
  };
}
```

```ts
// apps/pit-game/src/game/analysis/draft-song-profile.ts
import { createAnalysisDraft, type AnalysisDraft } from '../domain/analysis-draft';

export function buildAnalysisDraft(input: AnalysisInput): AnalysisDraft {
  const profile = buildDraftSongProfile(input);

  return createAnalysisDraft({
    id: profile.id,
    sourceTitle: input.title,
    profile,
    sectionSuggestions: profile.sections.map((section, index) => ({
      index,
      confidence: section.confidence,
      reasons: section.chaos > 0.8 ? ['peak energy bucket'] : ['coarse energy bucket'],
    })),
    impactCandidates: input.impactMoments.map((atMs, index, all) => ({
      atMs,
      strength: index === all.length - 1 ? 'hit' : 'accent',
      confidence: index === all.length - 1 ? 0.81 : 0.62,
      reasons: index === all.length - 1 ? ['terminal transient cluster'] : ['energy spike'],
    })),
    warnings: profile.sections
      .map((section, index) => ({ section, index }))
      .filter(({ section }) => section.confidence < 0.7)
      .map(({ index }) => `low-confidence section ${index}`),
  });
}
```

- [ ] **Step 4: Extend validation and regression coverage**

```ts
// apps/pit-game/src/game/domain/song-profile.spec.ts
import { describe, expect, it } from 'vitest';

import { validateSongProfile } from './song-profile';

describe('validateSongProfile', () => {
  it('accepts authored hit and stop markers', () => {
    const errors = validateSongProfile({
      id: 'fixture',
      title: 'Fixture',
      durationMs: 8_000,
      bpm: 150,
      beatGridMs: [0, 400, 800, 1_200],
      sections: [
        { kind: 'push', startMs: 0, endMs: 4_000, confidence: 1, chaos: 0.5 },
        { kind: 'recovery', startMs: 4_000, endMs: 8_000, confidence: 1, chaos: 0.2 },
      ],
      impacts: [
        { atMs: 2_000, strength: 'hit' },
        { atMs: 3_200, strength: 'stop' },
      ],
    });

    expect(errors).toEqual([]);
  });
});
```

```ts
// apps/pit-game/src/game/analysis/song-profile-regression.spec.ts
expect(draft.impactCandidates.map((item) => item.strength)).toEqual(['accent', 'drop', 'hit']);
expect(draft.warnings).toContain('low-confidence section 1');
```

- [ ] **Step 5: Run the updated tests and commit**

Run: `corepack pnpm --filter pit-game test -- src/game/domain/analysis-draft.spec.ts src/game/domain/song-profile.spec.ts src/game/analysis/draft-song-profile.spec.ts src/game/analysis/song-profile-regression.spec.ts`

Expected: PASS

```bash
git add apps/pit-game/src/game/domain/analysis-draft.ts apps/pit-game/src/game/domain/analysis-draft.spec.ts apps/pit-game/src/game/domain/song-profile.ts apps/pit-game/src/game/domain/song-profile.spec.ts apps/pit-game/src/game/analysis/draft-song-profile.ts apps/pit-game/src/game/analysis/draft-song-profile.spec.ts apps/pit-game/src/game/analysis/song-profile-regression.spec.ts
git commit -m "feat: add pit game analysis draft model"
```

### Task 2: Replace The Simple Review Pass With An Authoring Session

**Files:**
- Modify: `apps/pit-game/src/game/review/review-session.ts`
- Modify: `apps/pit-game/src/game/review/review-session.spec.ts`
- Modify: `apps/pit-game/src/game/domain/analysis-draft.ts`

- [ ] **Step 1: Write the failing authoring-session tests**

```ts
// apps/pit-game/src/game/review/review-session.spec.ts
import { describe, expect, it } from 'vitest';

import { createAnalysisDraft } from '../domain/analysis-draft';
import {
  addImpactMarker,
  buildPlayableProfile,
  createReviewSession,
  mergeSectionForward,
  moveSectionBoundary,
  splitSectionAtBeat,
} from './review-session';

const draft = createAnalysisDraft({
  id: 'fan-edit',
  sourceTitle: 'Fan Edit',
  profile: {
    id: 'fan-edit',
    title: 'Fan Edit',
    durationMs: 16_000,
    bpm: 160,
    beatGridMs: [0, 375, 750, 1_125, 1_500, 1_875, 2_250, 2_625, 3_000, 3_375, 3_750, 4_125],
    sections: [
      { kind: 'push', startMs: 0, endMs: 8_000, confidence: 0.58, chaos: 0.52 },
      { kind: 'breakdown', startMs: 8_000, endMs: 12_000, confidence: 0.62, chaos: 0.88 },
      { kind: 'recovery', startMs: 12_000, endMs: 16_000, confidence: 0.72, chaos: 0.2 },
    ],
    impacts: [{ atMs: 8_000, strength: 'drop' }],
  },
  sectionSuggestions: [],
  impactCandidates: [{ atMs: 7_875, strength: 'hit', confidence: 0.77, reasons: ['transient cluster'] }],
  warnings: [],
});

describe('review session authoring', () => {
  it('snaps section edits to the nearest beat and preserves full coverage', () => {
    const moved = moveSectionBoundary(createReviewSession(draft), 0, 'end', 7_880);
    expect(moved.overlay.sections[0]?.endMs).toBe(7_875);
    expect(moved.overlay.sections[1]?.startMs).toBe(7_875);
  });

  it('supports split, merge, and user-authored impact markers', () => {
    const split = splitSectionAtBeat(createReviewSession(draft), 0, 4_100);
    const merged = mergeSectionForward(split, 0);
    const withImpact = addImpactMarker(merged, { atMs: 11_250, strength: 'stop' });

    expect(withImpact.overlay.impacts.some((item) => item.strength === 'stop')).toBe(true);
    expect(buildPlayableProfile(withImpact).impacts.some((item) => item.strength === 'stop')).toBe(true);
  });
});
```

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `corepack pnpm --filter pit-game test -- src/game/review/review-session.spec.ts`

Expected: FAIL with missing section boundary, split, merge, and impact authoring helpers.

- [ ] **Step 3: Implement the authored overlay model and editing operations**

```ts
// apps/pit-game/src/game/review/review-session.ts
import type { AnalysisDraft } from '../domain/analysis-draft';
import type { ImpactMarker, ImpactStrength, SongProfile, SongSection } from '../domain/song-profile';

export type ReviewState = 'suggested' | 'accepted' | 'modified' | 'user-added';

export interface AuthoredSection extends SongSection {
  reviewState: ReviewState;
  sourceIndex: number | null;
}

export interface AuthoredImpact extends ImpactMarker {
  reviewState: ReviewState;
  source: 'profile' | 'candidate' | 'user';
}

export interface ReviewSession {
  draft: AnalysisDraft;
  name: string;
  overlay: {
    sections: AuthoredSection[];
    impacts: AuthoredImpact[];
  };
  selection:
    | { kind: 'section'; index: number }
    | { kind: 'impact'; index: number }
    | null;
  loopRange: { startMs: number; endMs: number } | null;
  audioSource: { name: string; objectUrl: string } | null;
}

function snapMsToBeat(beatGridMs: number[], atMs: number): number {
  return beatGridMs.reduce((closest, beat) =>
    Math.abs(beat - atMs) < Math.abs(closest - atMs) ? beat : closest,
  , beatGridMs[0] ?? 0);
}

export function createReviewSession(draft: AnalysisDraft, audioSource?: ReviewSession['audioSource']): ReviewSession {
  return {
    draft,
    name: draft.profile.title,
    overlay: {
      sections: draft.profile.sections.map((section, index) => ({ ...section, reviewState: 'suggested', sourceIndex: index })),
      impacts: [
        ...draft.profile.impacts.map((impact) => ({ ...impact, reviewState: 'accepted' as const, source: 'profile' as const })),
        ...draft.impactCandidates.map((impact) => ({ atMs: impact.atMs, strength: impact.strength, reviewState: 'suggested' as const, source: 'candidate' as const })),
      ],
    },
    selection: null,
    loopRange: null,
    audioSource: audioSource ?? null,
  };
}
```

```ts
// apps/pit-game/src/game/review/review-session.ts
export function moveSectionBoundary(session: ReviewSession, index: number, edge: 'start' | 'end', nextMs: number): ReviewSession {
  const snapped = snapMsToBeat(session.draft.profile.beatGridMs, nextMs);
  const sections = session.overlay.sections.map((section) => ({ ...section }));
  const current = sections[index];
  const previous = sections[index - 1];
  const following = sections[index + 1];

  if (!current) {
    return session;
  }

  if (edge === 'end' && following) {
    current.endMs = snapped;
    following.startMs = snapped;
  }

  if (edge === 'start' && previous) {
    current.startMs = snapped;
    previous.endMs = snapped;
  }

  current.reviewState = 'modified';
  return { ...session, overlay: { ...session.overlay, sections } };
}

export function splitSectionAtBeat(session: ReviewSession, index: number, atMs: number): ReviewSession {
  const sections = session.overlay.sections.map((section) => ({ ...section }));
  const current = sections[index];

  if (!current) {
    return session;
  }

  const splitAt = snapMsToBeat(session.draft.profile.beatGridMs, atMs);
  const head: AuthoredSection = { ...current, endMs: splitAt, reviewState: 'modified' };
  const tail: AuthoredSection = { ...current, startMs: splitAt, reviewState: 'modified', sourceIndex: null };
  sections.splice(index, 1, head, tail);

  return { ...session, overlay: { ...session.overlay, sections } };
}

export function mergeSectionForward(session: ReviewSession, index: number): ReviewSession {
  const sections = session.overlay.sections.map((section) => ({ ...section }));
  const current = sections[index];
  const following = sections[index + 1];

  if (!current || !following || current.kind !== following.kind) {
    return session;
  }

  sections.splice(index, 2, {
    ...current,
    endMs: following.endMs,
    chaos: Number(((current.chaos + following.chaos) / 2).toFixed(2)),
    reviewState: 'modified',
    sourceIndex: null,
  });

  return { ...session, overlay: { ...session.overlay, sections } };
}

export function addImpactMarker(session: ReviewSession, impact: { atMs: number; strength: ImpactStrength }): ReviewSession {
  const atMs = snapMsToBeat(session.draft.profile.beatGridMs, impact.atMs);

  return {
    ...session,
    overlay: {
      ...session.overlay,
      impacts: [...session.overlay.impacts, { atMs, strength: impact.strength, reviewState: 'user-added', source: 'user' }].sort(
        (left, right) => left.atMs - right.atMs,
      ),
    },
  };
}

export function buildPlayableProfile(session: ReviewSession): SongProfile {
  return {
    ...session.draft.profile,
    title: session.name.trim() || session.draft.profile.title,
    sections: session.overlay.sections.map(({ reviewState, sourceIndex, ...section }) => section),
    impacts: session.overlay.impacts.map(({ reviewState, source, ...impact }) => impact),
  };
}
```

- [ ] **Step 4: Add warnings and reviewed-state coverage**

```ts
// apps/pit-game/src/game/review/review-session.ts
export function getAuthoringWarnings(session: ReviewSession): string[] {
  const warnings: string[] = [];

  session.overlay.sections.forEach((section, index) => {
    const next = session.overlay.sections[index + 1];
    if (next && section.endMs !== next.startMs) {
      warnings.push(`section-gap-${index}`);
    }
    if (section.kind === 'recovery') {
      const dropsInside = session.overlay.impacts.filter(
        (impact) => impact.strength === 'drop' && impact.atMs >= section.startMs && impact.atMs < section.endMs,
      );
      if (dropsInside.length > 0) {
        warnings.push(`recovery-drop-${index}`);
      }
    }
  });

  return warnings;
}
```

```ts
// apps/pit-game/src/game/review/review-session.spec.ts
import { getAuthoringWarnings } from './review-session';

it('warns when recovery contains drop markers', () => {
  const session = addImpactMarker(createReviewSession(draft), { atMs: 13_100, strength: 'drop' });
  expect(getAuthoringWarnings(session)).toContain('recovery-drop-2');
});
```

- [ ] **Step 5: Run the authoring-session tests and commit**

Run: `corepack pnpm --filter pit-game test -- src/game/review/review-session.spec.ts`

Expected: PASS

```bash
git add apps/pit-game/src/game/review/review-session.ts apps/pit-game/src/game/review/review-session.spec.ts apps/pit-game/src/game/domain/analysis-draft.ts
git commit -m "feat: add pit game authoring session"
```

### Task 3: Add Deterministic Preview Windows And Runtime Offset Reset

**Files:**
- Create: `apps/pit-game/src/game/review/preview-window.ts`
- Create: `apps/pit-game/src/game/review/preview-window.spec.ts`
- Modify: `apps/pit-game/src/game/runtime/runtime-controller.ts`
- Modify: `apps/pit-game/src/game/runtime/runtime-controller.spec.ts`
- Modify: `apps/pit-game/src/game/review/review-session.ts`

- [ ] **Step 1: Write the failing preview-window and runtime tests**

```ts
// apps/pit-game/src/game/review/preview-window.spec.ts
import { describe, expect, it } from 'vitest';

import { buildPreviewWindow } from './preview-window';

describe('buildPreviewWindow', () => {
  it('adds a deterministic pre-roll before the selected section', () => {
    const preview = buildPreviewWindow(
      { beatGridMs: [0, 375, 750, 1_125, 1_500, 1_875, 2_250, 2_625], durationMs: 16_000 },
      { startMs: 8_000, endMs: 12_000 },
    );

    expect(preview.startMs).toBe(7_250);
    expect(preview.endMs).toBe(12_000);
    expect(preview.seed).toBe('7250:12000');
  });
});
```

```ts
// apps/pit-game/src/game/runtime/runtime-controller.spec.ts
import { describe, expect, it } from 'vitest';

import { createRuntimeController } from './runtime-controller';

describe('runtime controller preview reset', () => {
  it('resets the runtime at a preview offset', () => {
    const controller = createRuntimeController(profileFixture);

    controller.reset(profileFixture, 7_250);

    expect(controller.getSnapshot().elapsedMs).toBe(7_250);
  });
});
```

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `corepack pnpm --filter pit-game test -- src/game/review/preview-window.spec.ts src/game/runtime/runtime-controller.spec.ts`

Expected: FAIL with missing `buildPreviewWindow` and `reset(profile, elapsedMs)` support.

- [ ] **Step 3: Implement preview-window helpers and runtime offset reset**

```ts
// apps/pit-game/src/game/review/preview-window.ts
export interface PreviewWindowInput {
  beatGridMs: number[];
  durationMs: number;
}

export interface PreviewRange {
  startMs: number;
  endMs: number;
}

export interface PreviewWindow extends PreviewRange {
  seed: string;
}

export function buildPreviewWindow(input: PreviewWindowInput, selection: PreviewRange): PreviewWindow {
  const beatsBefore = input.beatGridMs.filter((beat) => beat < selection.startMs);
  const prerollBeat = beatsBefore.at(-2) ?? beatsBefore.at(-1) ?? 0;
  const startMs = Math.max(0, prerollBeat);
  const endMs = Math.min(input.durationMs, selection.endMs);

  return {
    startMs,
    endMs,
    seed: `${startMs}:${endMs}`,
  };
}
```

```ts
// apps/pit-game/src/game/runtime/runtime-controller.ts
export interface RuntimeController {
  subscribe(listener: (session: GameSession) => void): () => void;
  getSnapshot(): GameSession;
  step(input: PlayerInput, dtMs: number): void;
  reset(profile: SongProfile, elapsedMs?: number): void;
}

export function createRuntimeController(profile: SongProfile, elapsedMs = 0): RuntimeController {
  let snapshot = createGameSession(profile, elapsedMs);

  return {
    // subscribe and step unchanged
    reset(nextProfile, nextElapsedMs = 0) {
      snapshot = createGameSession(nextProfile, nextElapsedMs);
      publish();
    },
  };
}
```

- [ ] **Step 4: Thread preview-range state into the authoring session**

```ts
// apps/pit-game/src/game/review/review-session.ts
import { buildPreviewWindow } from './preview-window';

export function selectSection(session: ReviewSession, index: number): ReviewSession {
  const section = session.overlay.sections[index];

  if (!section) {
    return session;
  }

  return {
    ...session,
    selection: { kind: 'section', index },
    loopRange: buildPreviewWindow(session.draft.profile, {
      startMs: section.startMs,
      endMs: section.endMs,
    }),
  };
}

export function selectImpact(session: ReviewSession, index: number): ReviewSession {
  const impact = session.overlay.impacts[index];

  if (!impact) {
    return session;
  }

  return {
    ...session,
    selection: { kind: 'impact', index },
    loopRange: buildPreviewWindow(session.draft.profile, {
      startMs: Math.max(0, impact.atMs - 1_500),
      endMs: Math.min(session.draft.profile.durationMs, impact.atMs + 1_500),
    }),
  };
}
```

- [ ] **Step 5: Run the tests and commit**

Run: `corepack pnpm --filter pit-game test -- src/game/review/preview-window.spec.ts src/game/runtime/runtime-controller.spec.ts src/game/review/review-session.spec.ts`

Expected: PASS

```bash
git add apps/pit-game/src/game/review/preview-window.ts apps/pit-game/src/game/review/preview-window.spec.ts apps/pit-game/src/game/runtime/runtime-controller.ts apps/pit-game/src/game/runtime/runtime-controller.spec.ts apps/pit-game/src/game/review/review-session.ts apps/pit-game/src/game/review/review-session.spec.ts
git commit -m "feat: add pit game preview windows"
```

### Task 4: Persist Saved Authoring Projects And Handle Audio Relink

**Files:**
- Modify: `apps/pit-game/src/game/persistence/song-profile-storage.ts`
- Modify: `apps/pit-game/src/game/persistence/song-profile-storage.spec.ts`
- Modify: `apps/pit-game/src/game/review/review-session.ts`
- Modify: `apps/pit-game/src/components/ProfileLibrary.tsx`

- [ ] **Step 1: Write the failing persistence and migration tests**

```ts
// apps/pit-game/src/game/persistence/song-profile-storage.spec.ts
import { describe, expect, it } from 'vitest';

import {
  hydrateSavedAuthoringProject,
  loadSavedAuthoringProjects,
  saveAuthoringProject,
} from './song-profile-storage';

describe('saved authoring projects', () => {
  it('persists draft plus overlay and requires audio relink on reload', () => {
    const storage = createMemoryStorage();
    const session = createReviewSession(draftFixture, { name: 'demo.mp3', objectUrl: 'blob:demo' });
    const record = saveAuthoringProject(session, storage);

    expect(record?.draft.sourceTitle).toBe('Fan Edit');
    expect(loadSavedAuthoringProjects(storage)[0]?.requiresAudioRelink).toBe(true);
  });

  it('hydrates v1 reviewed profiles into editable v2 projects', () => {
    storage.setItem(
      'pit-game.reviewed-profiles.v1',
      JSON.stringify([
        {
          id: 'legacy',
          name: 'Legacy',
          sourceTitle: 'Legacy',
          savedAt: '2026-04-20T00:00:00.000Z',
          profile: draftFixture.profile,
          review: { sectionKinds: {}, sectionChaos: {}, reviewedSections: {} },
        },
      ]),
    );

    expect(loadSavedAuthoringProjects(storage)[0]?.profile.title).toBe('Fan Edit');
  });
});
```

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `corepack pnpm --filter pit-game test -- src/game/persistence/song-profile-storage.spec.ts`

Expected: FAIL with missing `saveAuthoringProject`, `loadSavedAuthoringProjects`, and migration helpers.

- [ ] **Step 3: Extend storage to save draft, overlay, and relink state**

```ts
// apps/pit-game/src/game/persistence/song-profile-storage.ts
import type { AnalysisDraft } from '../domain/analysis-draft';
import type { ReviewSession } from '../review/review-session';

export interface SavedAuthoringProjectRecord {
  id: string;
  name: string;
  sourceTitle: string;
  savedAt: string;
  draft: AnalysisDraft;
  overlay: ReviewSession['overlay'];
  profile: ReviewSession['draft']['profile'];
  requiresAudioRelink: boolean;
}

const storageKey = 'pit-game.authoring-projects.v2';

export function saveAuthoringProject(
  session: ReviewSession,
  storage?: StorageLike | null,
): SavedAuthoringProjectRecord | null {
  const resolvedStorage = resolveStorage(storage);
  const existing = readSavedAuthoringProjects(resolvedStorage);

  if (existing === null) {
    return null;
  }

  const record: SavedAuthoringProjectRecord = {
    id: createId(),
    name: session.name.trim() || session.draft.profile.title,
    sourceTitle: session.draft.sourceTitle,
    savedAt: new Date().toISOString(),
    draft: session.draft,
    overlay: session.overlay,
    profile: buildPlayableProfile(session),
    requiresAudioRelink: true,
  };

  if (!writeSavedAuthoringProjects(resolvedStorage, [record, ...existing])) {
    return null;
  }

  return record;
}

export function hydrateSavedAuthoringProject(
  record: SavedAuthoringProjectRecord,
  audioSource: ReviewSession['audioSource'] = null,
): ReviewSession {
  return {
    ...createReviewSession(record.draft, audioSource ?? undefined),
    name: record.name,
    overlay: record.overlay,
    audioSource,
  };
}
```

- [ ] **Step 4: Surface relink status in the saved-project list**

```tsx
// apps/pit-game/src/components/ProfileLibrary.tsx
export function ProfileLibrary({ revision, onLoad, onRelink }: ProfileLibraryProps) {
  const records = loadSavedAuthoringProjects();

  return (
    <section className='panel profile-library'>
      <header className='library-header'>
        <h2>Saved Authoring Projects</h2>
        <p>Reload your draft and overlay edits. Relink audio when you need local preview again.</p>
      </header>
      <div className='library-list'>
        {records.map((record) => (
          <article key={record.id} className='library-card'>
            <div className='library-copy'>
              <strong>{record.name}</strong>
              <p>{record.requiresAudioRelink ? 'Audio relink required for waveform and loop preview.' : 'Audio linked in this session.'}</p>
            </div>
            <div className='library-actions'>
              <button type='button' className='form-control' onClick={() => onLoad(record)}>
                Resume Edit
              </button>
              {record.requiresAudioRelink ? (
                <button type='button' className='form-control' onClick={() => onRelink(record)}>
                  Relink Audio
                </button>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 5: Run the tests and commit**

Run: `corepack pnpm --filter pit-game test -- src/game/persistence/song-profile-storage.spec.ts src/game/review/review-session.spec.ts`

Expected: PASS

```bash
git add apps/pit-game/src/game/persistence/song-profile-storage.ts apps/pit-game/src/game/persistence/song-profile-storage.spec.ts apps/pit-game/src/components/ProfileLibrary.tsx apps/pit-game/src/game/review/review-session.ts
git commit -m "feat: save pit game authoring projects"
```

### Task 5: Build The Timeline Editor, Preview Panel, And App Shell

**Files:**
- Modify: `apps/pit-game/package.json`
- Create: `apps/pit-game/src/components/TimelineEditor.tsx`
- Create: `apps/pit-game/src/components/TimelineEditor.spec.ts`
- Create: `apps/pit-game/src/components/PreviewPanel.tsx`
- Create: `apps/pit-game/src/components/PreviewPanel.spec.ts`
- Modify: `apps/pit-game/src/components/ReviewPanel.tsx`
- Modify: `apps/pit-game/src/components/UploadPanel.tsx`
- Modify: `apps/pit-game/src/App.tsx`
- Modify: `apps/pit-game/src/styles.css`

- [ ] **Step 1: Add the failing component-shell tests**

```ts
// apps/pit-game/src/components/TimelineEditor.spec.ts
import { JSDOM } from 'jsdom';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { TimelineEditor } from './TimelineEditor';

describe('TimelineEditor', () => {
  it('calls back with the selected section index', async () => {
    const dom = new JSDOM('<div id="root"></div>');
    const container = dom.window.document.getElementById('root');
    const onSelectSection = vi.fn();
    const root = createRoot(container!);

    await act(async () => {
      root.render(
        React.createElement(TimelineEditor, {
          beatGridMs: [0, 400, 800],
          durationMs: 2_400,
          sections: [{ kind: 'push', startMs: 0, endMs: 1_200, chaos: 0.5, confidence: 1, reviewState: 'modified', sourceIndex: 0 }],
          impacts: [],
          selection: null,
          loopRange: null,
          onSelectSection,
          onSelectImpact: vi.fn(),
          onLoopRangeChange: vi.fn(),
        }),
      );
    });

    container!.querySelector<HTMLButtonElement>('[data-section-index="0"]')!.click();
    expect(onSelectSection).toHaveBeenCalledWith(0);
  });
});
```

```ts
// apps/pit-game/src/components/PreviewPanel.spec.ts
import { JSDOM } from 'jsdom';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { PreviewPanel } from './PreviewPanel';

describe('PreviewPanel', () => {
  it('shows the relink message when no audio source is available', async () => {
    const dom = new JSDOM('<div id="root"></div>');
    const container = dom.window.document.getElementById('root');
    const root = createRoot(container!);

    await act(async () => {
      root.render(
        React.createElement(PreviewPanel, {
          loopRange: { startMs: 7_250, endMs: 12_000, seed: '7250:12000' },
          audioSource: null,
          onStartPlayablePreview: vi.fn(),
          onRelinkAudio: vi.fn(),
        }),
      );
    });

    expect(container!.textContent).toContain('Relink the local song file');
  });
});
```

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `corepack pnpm --filter pit-game test -- src/components/TimelineEditor.spec.ts src/components/PreviewPanel.spec.ts`

Expected: FAIL with missing `jsdom`, `TimelineEditor`, and `PreviewPanel`.

- [ ] **Step 3: Implement the editor and preview components**

```json
// apps/pit-game/package.json
{
  "devDependencies": {
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^5.1.0",
    "jsdom": "^25.0.1",
    "typescript": "^5.9.3",
    "vite": "^7.1.12",
    "vitest": "^2.1.5"
  }
}
```

```tsx
// apps/pit-game/src/components/TimelineEditor.tsx
import type { ReviewSession } from '../game/review/review-session';

interface TimelineEditorProps {
  beatGridMs: number[];
  durationMs: number;
  sections: ReviewSession['overlay']['sections'];
  impacts: ReviewSession['overlay']['impacts'];
  selection: ReviewSession['selection'];
  loopRange: ReviewSession['loopRange'];
  onSelectSection(index: number): void;
  onSelectImpact(index: number): void;
  onLoopRangeChange(range: { startMs: number; endMs: number }): void;
}

export function TimelineEditor({
  durationMs,
  sections,
  impacts,
  selection,
  loopRange,
  onSelectSection,
  onSelectImpact,
}: TimelineEditorProps) {
  return (
    <section className='panel authoring-timeline'>
      <header className='authoring-header'>
        <h2>Fan Authoring Timeline</h2>
        <p>Fix section semantics first, then tune impacts and preview the result.</p>
      </header>
      <div className='timeline-track section-track'>
        {sections.map((section, index) => (
          <button
            key={`${section.startMs}-${section.endMs}-${index}`}
            type='button'
            data-section-index={index}
            className={`timeline-block${selection?.kind === 'section' && selection.index === index ? ' is-selected' : ''}`}
            style={{
              left: `${(section.startMs / durationMs) * 100}%`,
              width: `${((section.endMs - section.startMs) / durationMs) * 100}%`,
            }}
            onClick={() => onSelectSection(index)}
          >
            <strong>{section.kind}</strong>
            <small>{Math.round(section.chaos * 100)}% chaos</small>
          </button>
        ))}
      </div>
      <div className='timeline-track impact-track'>
        {impacts.map((impact, index) => (
          <button
            key={`${impact.atMs}-${impact.strength}-${index}`}
            type='button'
            className='impact-marker'
            style={{ left: `${(impact.atMs / durationMs) * 100}%` }}
            onClick={() => onSelectImpact(index)}
          >
            {impact.strength}
          </button>
        ))}
      </div>
      {loopRange ? (
        <div
          className='loop-range'
          style={{
            left: `${(loopRange.startMs / durationMs) * 100}%`,
            width: `${((loopRange.endMs - loopRange.startMs) / durationMs) * 100}%`,
          }}
        />
      ) : null}
    </section>
  );
}
```

```tsx
// apps/pit-game/src/components/PreviewPanel.tsx
import { useEffect, useRef } from 'react';

interface PreviewPanelProps {
  loopRange: { startMs: number; endMs: number; seed: string } | null;
  audioSource: { name: string; objectUrl: string } | null;
  onStartPlayablePreview(): void;
  onRelinkAudio(): void;
}

export function PreviewPanel({ loopRange, audioSource, onStartPlayablePreview, onRelinkAudio }: PreviewPanelProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!loopRange || !audioSource) {
      return;
    }

    const audio = new Audio(audioSource.objectUrl);
    audio.currentTime = loopRange.startMs / 1_000;
    audioRef.current = audio;

    return () => {
      audio.pause();
      audioRef.current = null;
    };
  }, [audioSource, loopRange]);

  if (!loopRange) {
    return <section className='panel preview-panel'><p>Select a section or impact to preview it.</p></section>;
  }

  return (
    <section className='panel preview-panel'>
      <h2>Preview</h2>
      <p>{loopRange.startMs}ms - {loopRange.endMs}ms</p>
      {audioSource ? (
        <button type='button' className='form-control' onClick={() => void audioRef.current?.play()}>
          Loop Audio Window
        </button>
      ) : (
        <button type='button' className='form-control' onClick={onRelinkAudio}>
          Relink the local song file
        </button>
      )}
      <button type='button' className='form-control' onClick={onStartPlayablePreview}>
        Launch Playable Preview
      </button>
    </section>
  );
}
```

- [ ] **Step 4: Wire the authoring shell through `ReviewPanel`, `UploadPanel`, `App`, and styles**

```tsx
// apps/pit-game/src/components/UploadPanel.tsx
import { buildAnalysisDraft } from '../game/analysis/draft-song-profile';
import { decodeAudioFile } from '../game/analysis/decode-audio-file';

interface UploadPanelProps {
  onDraftReady(draft: AnalysisDraft, audioSource: { name: string; objectUrl: string }): void;
}

// after file decode
const analysis = await decodeAudioFile(file);
const draft = buildAnalysisDraft(analysis);
const objectUrl = URL.createObjectURL(file);
onDraftReady(draft, { name: file.name, objectUrl });
```

```tsx
// apps/pit-game/src/components/ReviewPanel.tsx
import { buildPlayableProfile, selectImpact, selectSection } from '../game/review/review-session';
import { TimelineEditor } from './TimelineEditor';
import { PreviewPanel } from './PreviewPanel';

export function ReviewPanel({ session, onChange, onSave, onPlayPreview, onPlayFull, onRelinkAudio }: ReviewPanelProps) {
  if (!session) {
    return null;
  }

  return (
    <section className='panel authoring-shell'>
      <TimelineEditor
        beatGridMs={session.draft.profile.beatGridMs}
        durationMs={session.draft.profile.durationMs}
        sections={session.overlay.sections}
        impacts={session.overlay.impacts}
        selection={session.selection}
        loopRange={session.loopRange}
        onSelectSection={(index) => onChange(selectSection(session, index))}
        onSelectImpact={(index) => onChange(selectImpact(session, index))}
        onLoopRangeChange={() => {}}
      />
      <aside className='authoring-inspector'>
        <h2>Inspector</h2>
        <p>{session.selection?.kind === 'section' ? 'Section selected' : session.selection?.kind === 'impact' ? 'Impact selected' : 'Choose a timeline item.'}</p>
      </aside>
      <PreviewPanel
        loopRange={session.loopRange}
        audioSource={session.audioSource}
        onStartPlayablePreview={() => onPlayPreview(buildPlayableProfile(session), session.loopRange)}
        onRelinkAudio={onRelinkAudio}
      />
      <div className='review-footer'>
        <button type='button' className='form-control' onClick={() => onSave(session)}>
          Save authoring project
        </button>
        <button type='button' className='form-control' onClick={() => onPlayFull(buildPlayableProfile(session))}>
          Play full reviewed profile
        </button>
      </div>
    </section>
  );
}
```

```tsx
// apps/pit-game/src/App.tsx
const [reviewSession, setReviewSession] = useState<ReviewSession | null>(null);

<UploadPanel
  onDraftReady={(draft, audioSource) => {
    setReviewSession(createReviewSession(draft, audioSource));
    setMode('reviewing');
  }}
/>

<ReviewPanel
  session={mode === 'reviewing' ? reviewSession : null}
  onChange={setReviewSession}
  onSave={(session) => {
    const saved = saveAuthoringProject(session);
    setReviewSaveMessage(saved ? `Saved ${saved.name} locally.` : 'Could not save this authoring project.');
  }}
  onPlayPreview={(profile, loopRange) => {
    controller.reset(profile, loopRange?.startMs ?? 0);
    setMode('playing');
  }}
  onPlayFull={(profile) => {
    controller.reset(profile);
    setMode('playing');
  }}
  onRelinkAudio={() => setReviewSaveMessage('Choose the original song file again to restore waveform and loop preview.')}
/>
```

```css
/* apps/pit-game/src/styles.css */
.authoring-shell {
  display: grid;
  gap: 16px;
}

.authoring-timeline {
  position: relative;
}

.timeline-track {
  position: relative;
  min-height: 64px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(8, 8, 8, 0.55);
}

.timeline-block,
.impact-marker {
  position: absolute;
  top: 8px;
}

.loop-range {
  position: absolute;
  height: 8px;
  bottom: 0;
  background: rgba(242, 211, 154, 0.45);
}
```

- [ ] **Step 5: Run the full pit-game suite and commit**

Run: `corepack pnpm install --filter pit-game --reporter append-only`

Expected: PASS with `jsdom` added to the workspace lockfile

Run: `corepack pnpm --filter pit-game test`

Expected: PASS

Run: `corepack pnpm --filter pit-game build`

Expected: PASS

```bash
git add apps/pit-game/package.json pnpm-lock.yaml apps/pit-game/src/components/TimelineEditor.tsx apps/pit-game/src/components/TimelineEditor.spec.ts apps/pit-game/src/components/PreviewPanel.tsx apps/pit-game/src/components/PreviewPanel.spec.ts apps/pit-game/src/components/ReviewPanel.tsx apps/pit-game/src/components/UploadPanel.tsx apps/pit-game/src/App.tsx apps/pit-game/src/styles.css
git commit -m "feat: add pit game fan authoring editor"
```

## Self-Review

Spec coverage check:

1. `AnalysisDraft / ReviewOverlay / ReviewedSongProfile` layering is covered by Tasks 1, 2, and 4.
2. `single timeline + inspector + preview` editor structure is covered by Task 5.
3. `section editing rules` are covered by Task 2.
4. `impact editing rules` are covered by Task 2.
5. `local audio preview` and `local playable preview` are covered by Tasks 3 and 5.
6. `browser-local persistence and re-entry` are covered by Task 4.
7. `heavy-music regression coverage` is covered by Task 1.

Placeholder scan:

1. No `TODO`, `TBD`, or “implement later” steps remain.
2. Each task includes concrete files, code, commands, and expected results.

Type consistency check:

1. `AnalysisDraft`, `ReviewSession`, `PreviewWindow`, and `SavedAuthoringProjectRecord` are defined before later tasks use them.
2. Runtime preview always resets through `runtime-controller.reset(profile, elapsedMs?)`, so the UI does not invent a second preview API.
3. Persistence always saves `draft + overlay + flattened profile`, so reopen and play use the same data model.
