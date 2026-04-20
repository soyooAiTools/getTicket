import { describe, expect, it } from 'vitest';

import { createAnalysisDraft } from '../domain/analysis-draft';
import {
  addImpactMarker,
  buildPlayableProfile,
  createReviewSession,
  getAuthoringWarnings,
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

  it('warns when recovery contains drop markers', () => {
    const session = addImpactMarker(createReviewSession(draft), { atMs: 13_100, strength: 'drop' });

    expect(getAuthoringWarnings(session)).toContain('recovery-drop-2');
  });
});
