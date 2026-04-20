import { describe, expect, it } from 'vitest';

import { createAnalysisDraft } from '../domain/analysis-draft';
import {
  addImpactMarker,
  buildPlayableProfile,
  buildReviewedProfileDraft,
  createReviewSession,
  getAuthoringWarnings,
  mergeSectionForward,
  moveSectionBoundary,
  selectImpact,
  selectSection,
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
    beatGridMs: [0, 375, 750, 1_125, 1_500, 1_875, 2_250, 2_625, 3_000, 3_375, 3_750, 4_125, 7_875, 8_000, 11_250, 12_000, 13_125, 16_000],
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

  it('excludes suggested impact candidates from the playable profile until accepted or authored', () => {
    const playable = buildPlayableProfile(createReviewSession(draft));

    expect(playable.impacts).toEqual([{ atMs: 8_000, strength: 'drop' }]);
  });

  it('keeps the legacy reviewed-profile draft storage-compatible when authored impacts include hit or stop', () => {
    const sessionWithUserImpacts = addImpactMarker(
      addImpactMarker(createReviewSession(draft), { atMs: 11_250, strength: 'stop' }),
      { atMs: 7_875, strength: 'hit' },
    );

    expect(buildPlayableProfile(sessionWithUserImpacts).impacts).toEqual([
      { atMs: 7_875, strength: 'hit' },
      { atMs: 8_000, strength: 'drop' },
      { atMs: 11_250, strength: 'stop' },
    ]);
    expect(buildReviewedProfileDraft(sessionWithUserImpacts).profile.impacts).toEqual([
      { atMs: 8_000, strength: 'drop' },
    ]);
  });

  it('warns when authored sections leave a gap', () => {
    const baseSession = createReviewSession(draft);
    const session = {
      ...baseSession,
      overlay: {
        ...baseSession.overlay,
        sections: [
          { ...baseSession.overlay.sections[0]!, endMs: 7_500 },
          ...baseSession.overlay.sections.slice(1),
        ],
      },
    };

    expect(getAuthoringWarnings(session)).toContain('section-gap-0');
  });

  it('warns when recovery contains drop markers', () => {
    const session = addImpactMarker(createReviewSession(draft), { atMs: 13_100, strength: 'drop' });

    expect(getAuthoringWarnings(session)).toContain('recovery-drop-2');
  });

  it('does not create zero-length sections when a boundary drag hits a neighboring limit', () => {
    const session = createReviewSession(draft);
    const endClamped = moveSectionBoundary(session, 0, 'end', 0);
    const startClamped = moveSectionBoundary(session, 1, 'start', 12_000);

    expect(endClamped.overlay.sections[0]).toMatchObject({ startMs: 0, endMs: 8_000 });
    expect(endClamped.overlay.sections[1]).toMatchObject({ startMs: 8_000, endMs: 12_000 });
    expect(startClamped.overlay.sections[1]).toMatchObject({ startMs: 8_000, endMs: 12_000 });
    expect(startClamped.overlay.sections[0]).toMatchObject({ startMs: 0, endMs: 8_000 });
  });

  it('selects a section and builds a deterministic preview loop range', () => {
    const session = selectSection(createReviewSession(draft), 1);

    expect(session.selection).toEqual({ kind: 'section', index: 1 });
    expect(session.loopRange).toEqual({
      startMs: 4_125,
      endMs: 12_000,
      seed: '4125:12000',
    });
  });

  it('selects an impact and builds a deterministic preview loop range', () => {
    const session = selectImpact(createReviewSession(draft), 0);

    expect(session.selection).toEqual({ kind: 'impact', index: 0 });
    expect(session.loopRange).toEqual({
      startMs: 3_750,
      endMs: 9_375,
      seed: '3750:9375',
    });
  });

  it('clears preview state after editing a selected section', () => {
    const selected = selectSection(createReviewSession(draft), 1);
    const edited = moveSectionBoundary(selected, 1, 'start', 8_200);

    expect(edited.selection).toBeNull();
    expect(edited.loopRange).toBeNull();
  });

  it('clears preview state when overlay structure changes after selection', () => {
    const selected = selectSection(createReviewSession(draft), 0);
    const split = splitSectionAtBeat(selected, 0, 4_100);
    const reselected = selectSection(split, 0);
    const merged = mergeSectionForward(reselected, 0);

    expect(split.selection).toBeNull();
    expect(split.loopRange).toBeNull();
    expect(merged.selection).toBeNull();
    expect(merged.loopRange).toBeNull();
  });
});
