import { describe, expect, it } from 'vitest';

import { authoredSongProfile } from '../fixtures/authored-song-profile';
import type { SongProfile } from './song-profile';
import { findSectionAtMs, validateSongProfile } from './song-profile';

describe('song profile', () => {
  it('accepts the authored fixture without ordering errors', () => {
    expect(validateSongProfile(authoredSongProfile)).toEqual([]);
  });

  it('rejects profiles with no sections', () => {
    const emptySectionsProfile = {
      ...authoredSongProfile,
      sections: [],
    } satisfies SongProfile;

    expect(validateSongProfile(emptySectionsProfile)).toContain('profile has no sections');
  });

  it('returns the active section for a timestamp', () => {
    expect(findSectionAtMs(authoredSongProfile, 61_000)?.kind).toBe('breakdown');
  });

  it('accepts authored hit and stop markers', () => {
    const errors = validateSongProfile({
      id: 'fixture',
      title: 'Fixture',
      durationMs: 8_000,
      bpm: 150,
      beatGridMs: [0, 400, 800, 1_200],
      sections: [
        { kind: 'push', startMs: 0, endMs: 4_000, confidence: 1, chaos: 0.5 },
        { kind: 'recovery', startMs: 4_000, endMs: 8_000, confidence: 1, chaos: 0.2 },
      ],
      impacts: [
        { atMs: 2_000, strength: 'hit' },
        { atMs: 3_200, strength: 'stop' },
      ],
    });

    expect(errors).toEqual([]);
  });

  it('rejects profiles whose first section does not start at zero', () => {
    const errors = validateSongProfile({
      ...authoredSongProfile,
      sections: [
        { ...authoredSongProfile.sections[0]!, startMs: 500 },
        ...authoredSongProfile.sections.slice(1),
      ],
    });

    expect(errors).toContain('first section must start at 0');
  });

  it('rejects gaps and incomplete coverage at the end of the song', () => {
    const errors = validateSongProfile({
      ...authoredSongProfile,
      sections: [
        { ...authoredSongProfile.sections[0]!, endMs: 11_500 },
        { ...authoredSongProfile.sections[1]!, startMs: 12_000 },
        ...authoredSongProfile.sections.slice(2, -1),
        {
          ...authoredSongProfile.sections[authoredSongProfile.sections.length - 1]!,
          endMs: authoredSongProfile.durationMs - 1_000,
        },
      ],
    });

    expect(errors).toContain('section 1 does not start when section 0 ends');
    expect(errors).toContain('last section must end at the song duration');
  });

  it('rejects sections that extend outside the song duration', () => {
    const errors = validateSongProfile({
      ...authoredSongProfile,
      sections: [
        { ...authoredSongProfile.sections[0]!, startMs: -250 },
        ...authoredSongProfile.sections.slice(1, -1),
        {
          ...authoredSongProfile.sections[authoredSongProfile.sections.length - 1]!,
          endMs: authoredSongProfile.durationMs + 250,
        },
      ],
    });

    expect(errors).toContain('section 0 starts outside the song duration');
    expect(errors).toContain(`section ${authoredSongProfile.sections.length - 1} ends outside the song duration`);
  });
});
