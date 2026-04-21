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
