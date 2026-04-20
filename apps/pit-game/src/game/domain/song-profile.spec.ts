import { describe, expect, it } from 'vitest';

import { authoredSongProfile } from '../fixtures/authored-song-profile';
import { findSectionAtMs, validateSongProfile } from './song-profile';

describe('song profile', () => {
  it('accepts the authored fixture without ordering errors', () => {
    expect(validateSongProfile(authoredSongProfile)).toEqual([]);
  });

  it('returns the active section for a timestamp', () => {
    expect(findSectionAtMs(authoredSongProfile, 61_000)?.kind).toBe('breakdown');
  });
});
