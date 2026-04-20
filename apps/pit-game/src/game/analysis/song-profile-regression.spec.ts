import { describe, expect, it } from 'vitest';

import { buildAnalysisDraft } from './draft-song-profile';
import { buildDraftSongProfile } from './draft-song-profile';

function createBoundaryInput(frameCount: number) {
  const durationMs = 48_000;
  const segmentRms = [0.12, 0.3, 0.56, 0.72, 0.28, 0.9, 0.16, 0.58, 0.76, 0.26, 0.92, 0.34];

  return {
    title: `Boundary ${frameCount}`,
    durationMs,
    bpm: 192,
    beatGridMs: Array.from({ length: 153 }, (_, index) => Math.round(index * (60_000 / 192))),
    energyFrames: Array.from({ length: frameCount }, (_, index) => {
      const atMs = Math.round((durationMs / frameCount) * index);
      const segmentIndex = Math.min(segmentRms.length - 1, Math.floor(atMs / 4_000));

      return {
        atMs,
        rms: segmentRms[segmentIndex],
      };
    }),
    impactMoments: [12_000, 24_000, 36_000],
  };
}

describe('song profile regression', () => {
  it('keeps a dense high-energy upload readable', () => {
    const profile = buildDraftSongProfile({
      title: 'Dense Barrage',
      durationMs: 48_000,
      bpm: 192,
      beatGridMs: Array.from({ length: 153 }, (_, index) => Math.round(index * (60_000 / 192))),
      energyFrames: Array.from({ length: 96 }, (_, index) => {
        const progress = index / 95;

        if (progress < 0.22) {
          return {
            atMs: index * 500,
            rms: 0.18 + progress * 1.9,
          };
        }

        if (progress < 0.74) {
          return {
            atMs: index * 500,
            rms: 0.9 + ((index % 4) - 1.5) * 0.01,
          };
        }

        return {
          atMs: index * 500,
          rms: 0.9 - (progress - 0.74) * 1.5,
        };
      }),
      impactMoments: [12_000, 24_000, 36_000],
    });

    const sectionKinds = profile.sections.map((section) => section.kind);

    expect(profile.sections.length).toBeLessThanOrEqual(8);
    expect(sectionKinds[0]).not.toBe('breakdown');
    expect(sectionKinds.some((kind) => kind === 'push' || kind === 'two-step')).toBe(true);
    expect(sectionKinds.some((kind) => kind === 'breakdown')).toBe(true);
    expect(sectionKinds[sectionKinds.length - 1]).toBe('recovery');
  });

  it('promotes analyzer output into a separated analysis draft', () => {
    const draft = buildAnalysisDraft({
      title: 'Dense Barrage',
      durationMs: 48_000,
      bpm: 192,
      beatGridMs: Array.from({ length: 153 }, (_, index) => Math.round(index * (60_000 / 192))),
      energyFrames: Array.from({ length: 96 }, (_, index) => {
        const progress = index / 95;

        if (progress < 0.22) {
          return {
            atMs: index * 500,
            rms: 0.18 + progress * 1.9,
          };
        }

        if (progress < 0.74) {
          return {
            atMs: index * 500,
            rms: 0.9 + ((index % 4) - 1.5) * 0.01,
          };
        }

        return {
          atMs: index * 500,
          rms: 0.9 - (progress - 0.74) * 1.5,
        };
      }),
      impactMoments: [12_000, 24_000, 36_000],
    });

    expect(draft.impactCandidates.map((item) => item.strength)).toEqual(['accent', 'drop', 'hit']);
    expect(draft.warnings).toContain('low-confidence section 1');
  });

  it('keeps the dense-section heuristic stable around the density cutoff', () => {
    const sparseBoundary = buildDraftSongProfile(createBoundaryInput(71));
    const denseBoundary = buildDraftSongProfile(createBoundaryInput(72));

    expect(sparseBoundary.sections.length).toBeGreaterThan(denseBoundary.sections.length);
    expect(denseBoundary.sections.length).toBeLessThanOrEqual(8);
    expect(sparseBoundary.sections[sparseBoundary.sections.length - 1]?.kind).toBe('recovery');
    expect(denseBoundary.sections[denseBoundary.sections.length - 1]?.kind).toBe('recovery');
  });
});
