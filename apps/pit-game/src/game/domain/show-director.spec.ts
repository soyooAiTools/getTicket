import { describe, expect, it } from 'vitest';

import { authoredSongProfile } from '../fixtures/authored-song-profile';
import type { SongProfile } from './song-profile';
import { createShowFrame } from './show-director';

describe('show director', () => {
  it('raises brace priority during breakdown sections', () => {
    const calmFrame = createShowFrame(authoredSongProfile, 8_000);
    const breakdownFrame = createShowFrame(authoredSongProfile, 61_000);

    expect(breakdownFrame.actionWeights.brace).toBeGreaterThan(calmFrame.actionWeights.brace);
  });

  it('splits the center during side-to-side preparation', () => {
    expect(createShowFrame(authoredSongProfile, 52_000).crowdPreset.centerFlow).toBe('split');
  });

  it('throws for timestamps outside the song profile', () => {
    expect(() => createShowFrame(authoredSongProfile, -1)).toThrow('No section found for timestamp -1');
  });

  it('throws for profiles with no sections', () => {
    const emptySectionsProfile = {
      ...authoredSongProfile,
      sections: [],
    } satisfies SongProfile;

    expect(() => createShowFrame(emptySectionsProfile, 1_000)).toThrow('Profile has no sections');
  });
});
