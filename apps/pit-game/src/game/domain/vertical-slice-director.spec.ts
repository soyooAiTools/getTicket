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

  it('marks breakdown hits as brace-first windows', () => {
    const frame = createVerticalSliceFrame(minorityThreatVerticalSlice, 10_250);

    expect(frame.phase.kind).toBe('breakdown-peak');
    expect(frame.event?.kind).toBe('breakdown-hit');
    expect(frame.dangerKind).toBe('crush');
    expect(frame.recommendedAction).toBe('brace');
    expect(frame.cameraCue).toBe('impact');
  });

  it('keeps non-hit peak frames out of the brace window', () => {
    const frame = createVerticalSliceFrame(minorityThreatVerticalSlice, 12_000);

    expect(frame.phase.kind).toBe('breakdown-peak');
    expect(frame.event).toBeNull();
    expect(frame.dangerKind).toBe('crush');
    expect(frame.recommendedAction).toBe('shove');
    expect(frame.cameraCue).toBe('pressure');
  });
});
