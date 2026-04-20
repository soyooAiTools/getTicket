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
});
