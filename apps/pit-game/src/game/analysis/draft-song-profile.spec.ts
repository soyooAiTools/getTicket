import { describe, expect, it } from 'vitest';

import { buildAnalysisDraft, buildDraftSongProfile, buildValidatedDraftSongProfile } from './draft-song-profile';

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

  it('emits heavy-song impact candidates without mutating the playable profile', () => {
    const draft = buildAnalysisDraft({
      title: 'Break Test',
      durationMs: 16_000,
      bpm: 160,
      beatGridMs: [0, 375, 750, 1_125, 1_500],
      energyFrames: [
        { atMs: 0, rms: 0.18 },
        { atMs: 4_000, rms: 0.62 },
        { atMs: 8_000, rms: 0.91 },
        { atMs: 12_000, rms: 0.11 },
      ],
      impactMoments: [7_500, 8_000, 8_375],
    });

    expect(draft.sectionSuggestions.some((item) => item.reasons.includes('peak energy bucket'))).toBe(true);
    expect(draft.impactCandidates.map((item) => item.strength)).toContain('hit');
    expect(draft.profile.impacts.every((item) => item.strength === 'accent' || item.strength === 'drop')).toBe(true);
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

  it('coarsens dense energy frames into a manageable section count', () => {
    const profile = buildDraftSongProfile({
      title: 'Dense Upload',
      durationMs: 48_000,
      bpm: 180,
      beatGridMs: Array.from({ length: 128 }, (_, index) => index * 375),
      energyFrames: Array.from({ length: 96 }, (_, index) => ({
        atMs: index * 500,
        rms: 0.35 + (((index % 8) + 1) * 0.07),
      })),
      impactMoments: [12_000, 24_000, 36_000],
    });

    expect(profile.sections.length).toBeLessThanOrEqual(12);
    expect(profile.sections[0]?.startMs).toBe(0);
    expect(profile.sections[profile.sections.length - 1]?.endMs).toBe(48_000);
  });
});
