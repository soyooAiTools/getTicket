import { describe, expect, it } from 'vitest';

import type { ImpactCandidate } from './analysis-draft';
import { createAnalysisDraft } from './analysis-draft';

describe('analysis draft', () => {
  it('keeps analyzer candidates separate from the runtime profile', () => {
    const sectionSuggestions = [{ index: 0, confidence: 0.58, reasons: ['dense energy plateau'] }];
    const impactCandidates: ImpactCandidate[] = [
      { atMs: 4_800, strength: 'hit', confidence: 0.77, reasons: ['sharp transient'] },
    ];
    const warnings = ['possible split at 4000ms'];

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
      sectionSuggestions,
      impactCandidates,
      warnings,
    });

    sectionSuggestions.push({ index: 1, confidence: 0.91, reasons: ['late surge'] });
    sectionSuggestions[0].reasons.push('mutated source');
    impactCandidates.splice(0, 1, { atMs: 9_600, strength: 'drop', confidence: 0.4, reasons: ['mutated source'] });
    warnings[0] = 'mutated warning';

    expect(draft.sectionSuggestions).not.toBe(sectionSuggestions);
    expect(draft.impactCandidates).not.toBe(impactCandidates);
    expect(draft.warnings).not.toBe(warnings);
    expect(draft.sectionSuggestions).toHaveLength(1);
    expect(draft.sectionSuggestions[0]?.reasons).toEqual(['dense energy plateau']);
    expect(draft.impactCandidates[0]?.strength).toBe('hit');
    expect(draft.profile.impacts[0]?.strength).toBe('drop');
    expect(draft.warnings).toContain('possible split at 4000ms');
  });
});
