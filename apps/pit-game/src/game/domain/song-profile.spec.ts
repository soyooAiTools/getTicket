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
});
