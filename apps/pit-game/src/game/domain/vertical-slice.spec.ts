import { describe, expect, it } from 'vitest';

import { minorityThreatVerticalSlice } from '../fixtures/minority-threat-vertical-slice';
import { validateVerticalSliceFixture } from './vertical-slice';

describe('minorityThreatVerticalSlice', () => {
  it('defines a single valid 30-second authored slice for Minority Threat', () => {
    expect(minorityThreatVerticalSlice.audio.fileName).toBe('Minority Unit - Minority Threat.mp3');
    expect(minorityThreatVerticalSlice.audio.localPath).toBe(
      'C:/Users/Nick/Desktop/Minority Unit - Minority Threat.mp3',
    );
    expect(
      minorityThreatVerticalSlice.audio.segmentEndMs - minorityThreatVerticalSlice.audio.segmentStartMs,
    ).toBe(30_000);
    expect(minorityThreatVerticalSlice.phases.map((phase) => phase.kind)).toEqual([
      'tension-in',
      'breakdown-peak',
      'aftershock',
    ]);
    expect(validateVerticalSliceFixture(minorityThreatVerticalSlice)).toEqual([]);
  });
});
