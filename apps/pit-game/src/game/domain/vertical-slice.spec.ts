import { describe, expect, it } from 'vitest';

import { minorityThreatVerticalSlice } from '../fixtures/minority-threat-vertical-slice';
import { validateVerticalSliceFixture } from './vertical-slice';

describe('minorityThreatVerticalSlice', () => {
  it('defines a four-phase authored run', () => {
    expect(minorityThreatVerticalSlice.phases.map((phase) => phase.kind)).toEqual([
      'walk-in-pressure',
      'build',
      'breakdown-peak',
      'aftershock',
    ]);
    expect(validateVerticalSliceFixture(minorityThreatVerticalSlice)).toEqual([]);
  });

  it('requires contiguous four-phase timing across the authored run', () => {
    const fixture = structuredClone(minorityThreatVerticalSlice);
    fixture.phases[1] = {
      ...fixture.phases[1],
      startMs: 4_100,
    };

    expect(validateVerticalSliceFixture(fixture)).toContain('phase 1 must start when phase 0 ends');
  });

  it('rejects invalid authored phase intensities', () => {
    const fixture = structuredClone(minorityThreatVerticalSlice);
    fixture.phases[2] = {
      ...fixture.phases[2],
      intensity: 1.2,
    };

    expect(validateVerticalSliceFixture(fixture)).toContain('phase 2 has an invalid intensity');
  });

  it('keeps authored events aligned with the derived song impacts', () => {
    const fixture = structuredClone(minorityThreatVerticalSlice);
    fixture.events[4] = {
      ...fixture.events[4],
      atMs: 24_100,
    };

    expect(validateVerticalSliceFixture(fixture)).toContain('fixture event 4 does not match profile impact 4');
  });
});
