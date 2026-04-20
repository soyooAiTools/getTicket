import { describe, expect, it } from 'vitest';

import { minorityThreatVerticalSlice } from '../fixtures/minority-threat-vertical-slice';
import { validateVerticalSliceFixture } from './vertical-slice';

function cloneVerticalSliceFixture() {
  return {
    ...minorityThreatVerticalSlice,
    audio: { ...minorityThreatVerticalSlice.audio },
    profile: {
      ...minorityThreatVerticalSlice.profile,
      beatGridMs: [...minorityThreatVerticalSlice.profile.beatGridMs],
      sections: minorityThreatVerticalSlice.profile.sections.map((section) => ({ ...section })),
      impacts: minorityThreatVerticalSlice.profile.impacts.map((impact) => ({ ...impact })),
    },
    phases: minorityThreatVerticalSlice.phases.map((phase) => ({ ...phase })),
    events: minorityThreatVerticalSlice.events.map((event) => ({ ...event })),
  };
}

describe('minorityThreatVerticalSlice', () => {
  it('defines a single valid 30-second authored slice for Minority Threat', () => {
    expect(minorityThreatVerticalSlice.audio.fileName).toBe('Minority Unit - Minority Threat.mp3');
    expect(minorityThreatVerticalSlice.audio.localPath).toBe(
      'C:/Users/Nick/Desktop/Minority Unit - Minority Threat.mp3',
    );
    expect(
      minorityThreatVerticalSlice.audio.segmentEndMs - minorityThreatVerticalSlice.audio.segmentStartMs,
    ).toBe(30_000);
    expect(minorityThreatVerticalSlice.phases).toEqual([
      { kind: 'tension-in', startMs: 0, endMs: 6_000, intensity: 0.44 },
      { kind: 'breakdown-peak', startMs: 6_000, endMs: 24_000, intensity: 1 },
      { kind: 'aftershock', startMs: 24_000, endMs: 30_000, intensity: 0.5 },
    ]);
    expect(minorityThreatVerticalSlice.events).toEqual([
      { atMs: 3_000, kind: 'crowd-build', strength: 0.58 },
      { atMs: 7_500, kind: 'lateral-surge', strength: 0.82 },
      { atMs: 9_000, kind: 'breakdown-hit', strength: 1 },
      { atMs: 15_000, kind: 'breakdown-hit', strength: 0.92 },
      { atMs: 24_000, kind: 'aftershock-drop', strength: 0.64 },
    ]);
    expect(validateVerticalSliceFixture(minorityThreatVerticalSlice)).toEqual([]);
  });

  it('rejects a phase gap', () => {
    const fixture = cloneVerticalSliceFixture();
    fixture.phases[1] = { ...fixture.phases[1]!, startMs: 6_500 };

    expect(validateVerticalSliceFixture(fixture)).toContain('phase 1 must start when phase 0 ends');
  });

  it('rejects a phase range that starts before zero', () => {
    const fixture = cloneVerticalSliceFixture();
    fixture.phases[0] = { ...fixture.phases[0]!, startMs: -100 };

    expect(validateVerticalSliceFixture(fixture)).toContain('phase 0 starts outside the slice duration');
  });

  it('rejects a segment/profile duration mismatch', () => {
    const fixture = cloneVerticalSliceFixture();
    fixture.profile.durationMs = 29_000;

    expect(validateVerticalSliceFixture(fixture)).toContain('audio segment duration must match the slice duration');
  });

  it('rejects an event timestamp outside the slice duration', () => {
    const fixture = cloneVerticalSliceFixture();
    fixture.events[4] = { ...fixture.events[4]!, atMs: 30_000 };

    expect(validateVerticalSliceFixture(fixture)).toContain('event 4 occurs outside the slice duration');
  });

  it('rejects an invalid embedded song profile', () => {
    const fixture = cloneVerticalSliceFixture();
    fixture.profile.sections[0] = { ...fixture.profile.sections[0]!, startMs: 500 };

    expect(validateVerticalSliceFixture(fixture)).toContain('profile: first section must start at 0');
  });

  it('rejects an out-of-range phase intensity', () => {
    const fixture = cloneVerticalSliceFixture();
    fixture.phases[1] = { ...fixture.phases[1]!, intensity: 1.25 };

    expect(validateVerticalSliceFixture(fixture)).toContain('phase 1 has an invalid intensity');
  });

  it('rejects an out-of-range event strength', () => {
    const fixture = cloneVerticalSliceFixture();
    fixture.events[0] = { ...fixture.events[0]!, strength: -0.1 };

    expect(validateVerticalSliceFixture(fixture)).toContain('event 0 has an invalid strength');
  });

  it('rejects invalid audio boundaries', () => {
    const fixture = cloneVerticalSliceFixture();
    fixture.audio.segmentStartMs = 5_000;
    fixture.audio.segmentEndMs = 5_000;

    expect(validateVerticalSliceFixture(fixture)).toContain('audio segment boundaries are invalid');
  });

  it('rejects drift between authored events and profile impacts', () => {
    const fixture = cloneVerticalSliceFixture();
    fixture.profile.impacts[2] = { ...fixture.profile.impacts[2]!, strength: 'hit' };

    expect(validateVerticalSliceFixture(fixture)).toContain('fixture event 2 does not match profile impact 2');
  });
});
