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

  it('rejects events that occur outside the slice duration', () => {
    const fixture = structuredClone(minorityThreatVerticalSlice);
    fixture.events[0] = {
      ...fixture.events[0],
      atMs: 30_000,
    };

    expect(validateVerticalSliceFixture(fixture)).toContain('event 0 occurs outside the slice duration');
  });

  it('rejects invalid event strengths', () => {
    const fixture = structuredClone(minorityThreatVerticalSlice);
    fixture.events[1] = {
      ...fixture.events[1],
      strength: 1.1,
    };

    expect(validateVerticalSliceFixture(fixture)).toContain('event 1 has an invalid strength');
  });

  it('rejects invalid audio boundaries and segment duration mismatches', () => {
    const fixture = structuredClone(minorityThreatVerticalSlice);
    fixture.audio = {
      ...fixture.audio,
      segmentStartMs: 76_000,
      segmentEndMs: 46_000,
    };

    const errors = validateVerticalSliceFixture(fixture);

    expect(errors).toContain('audio segment boundaries are invalid');
    expect(errors).toContain('audio segment duration must match the slice duration');
  });

  it('delegates song-profile validation errors', () => {
    const fixture = structuredClone(minorityThreatVerticalSlice);
    fixture.profile = {
      ...fixture.profile,
      sections: [
        { ...fixture.profile.sections[0], startMs: 1 },
        ...fixture.profile.sections.slice(1),
      ],
    };

    expect(validateVerticalSliceFixture(fixture)).toContain('profile: first section must start at 0');
  });
});
