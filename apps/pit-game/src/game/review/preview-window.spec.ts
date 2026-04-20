import { describe, expect, it } from 'vitest';

import { buildPreviewWindow } from './preview-window';

describe('buildPreviewWindow', () => {
  it('adds a deterministic pre-roll before the selected section', () => {
    const preview = buildPreviewWindow(
      {
        beatGridMs: [0, 375, 750, 1_125, 1_500, 1_875, 2_250, 2_625, 7_250, 7_875],
        durationMs: 16_000,
      },
      { startMs: 8_000, endMs: 12_000 },
    );

    expect(preview.startMs).toBe(7_250);
    expect(preview.endMs).toBe(12_000);
    expect(preview.seed).toBe('7250:12000');
  });
});
