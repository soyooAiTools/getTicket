import { describe, expect, it } from 'vitest';

import { minorityThreatVerticalSlice } from '../fixtures/minority-threat-vertical-slice';
import { createVerticalSliceFrame } from './vertical-slice-director';

describe('createVerticalSliceFrame', () => {
  it('promotes authored breakdown hits into the strongest pressure frame', () => {
    const frame = createVerticalSliceFrame(minorityThreatVerticalSlice, 9_000);

    expect(frame.phase.kind).toBe('breakdown-peak');
    expect(frame.event?.kind).toBe('breakdown-hit');
    expect(frame.zonePressure.center).toBeGreaterThan(frame.zonePressure.edge);
    expect(frame.recommendedAction).toBe('brace');
    expect(frame.cameraCue).toBe('punch');
  });

  it('surfaces lateral surges as slip windows with a build camera cue', () => {
    const frame = createVerticalSliceFrame(minorityThreatVerticalSlice, 7_500);

    expect(frame.phase.kind).toBe('breakdown-peak');
    expect(frame.event?.kind).toBe('lateral-surge');
    expect(frame.recommendedAction).toBe('slip');
    expect(frame.cameraCue).toBe('build');
  });
});
