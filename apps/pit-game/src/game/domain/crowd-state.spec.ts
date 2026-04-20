import { describe, expect, it } from 'vitest';

import { authoredSongProfile } from '../fixtures/authored-song-profile';
import { createShowFrame } from './show-director';
import { advanceCrowdState, createCrowdState } from './crowd-state';

describe('crowd state', () => {
  it('opens the center before a lateral crash during side-to-side prep', () => {
    const frame = createShowFrame(authoredSongProfile, 52_000);
    const next = advanceCrowdState(createCrowdState(), frame, 250);

    expect(next.center.flow).toBe('split');
    expect(next.center.density).toBeLessThan(next.edge.density);
  });
});
