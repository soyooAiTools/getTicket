import { describe, expect, it } from 'vitest';

import { buildDraftSongProfile, buildValidatedDraftSongProfile } from './draft-song-profile';

describe('draft song profile', () => {
  it('turns a high-energy drop into a breakdown section with a drop marker', () => {
    const profile = buildDraftSongProfile({
      title: 'Uploaded Demo',
      durationMs: 48_000,
      bpm: 176,
      beatGridMs: Array.from({ length: 128 }, (_, index) => index * 341),
      energyFrames: [
        { atMs: 0, rms: 0.14 },
        { atMs: 8_000, rms: 0.22 },
        { atMs: 16_000, rms: 0.56 },
        { atMs: 24_000, rms: 0.72 },
        { atMs: 32_000, rms: 0.92 },
        { atMs: 40_000, rms: 0.28 },
      ],
      impactMoments: [16_000, 32_000],
    });

    expect(profile.sections.some((section) => section.kind === 'breakdown')).toBe(true);
    expect(profile.impacts.some((impact) => impact.strength === 'drop')).toBe(true);
  });

  it('rejects analysis input that produces an invalid song profile', () => {
    expect(() =>
      buildValidatedDraftSongProfile({
        title: 'Empty Analysis',
        durationMs: 48_000,
        bpm: 176,
        beatGridMs: [],
        energyFrames: [],
        impactMoments: [],
      }),
    ).toThrowError('profile has no sections');
  });
});
