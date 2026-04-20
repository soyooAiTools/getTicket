import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { createAnalysisDraft } from '../game/domain/analysis-draft';
import { createReviewSession } from '../game/review/review-session';
import { TimelineEditor } from './TimelineEditor';

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

describe('TimelineEditor', () => {
  it('renders section and impact lanes for the current review session', () => {
    const html = renderToStaticMarkup(
      createElement(TimelineEditor, {
        session: createReviewSession(draft),
        onSelectSection: () => undefined,
        onSelectImpact: () => undefined,
      }),
    );

    expect(html).toContain('Timeline');
    expect(html).toContain('Sections');
    expect(html).toContain('Impacts');
    expect(html).toContain('breakdown');
    expect(html).toContain('drop');
  });
});
