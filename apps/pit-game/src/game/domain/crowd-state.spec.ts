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

  it('accumulates fallen fans consistently across smaller ticks', () => {
    const frame = createShowFrame(authoredSongProfile, 61_000);
    let smallTicks = createCrowdState();

    for (let index = 0; index < 10; index += 1) {
      smallTicks = advanceCrowdState(smallTicks, frame, 100);
    }

    const singleTick = advanceCrowdState(createCrowdState(), frame, 1_000);

    expect(smallTicks.fallenFans).toBeCloseTo(singleTick.fallenFans, 6);
    expect(smallTicks.fallenFans).toBeGreaterThan(0);
  });
});
