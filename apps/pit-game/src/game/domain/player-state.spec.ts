import { describe, expect, it } from 'vitest';

import { authoredSongProfile } from '../fixtures/authored-song-profile';
import { createShowFrame } from './show-director';
import { createPlayerState, reducePlayerState } from './player-state';

describe('player state', () => {
  it('preserves more balance when bracing during a breakdown', () => {
    const frame = createShowFrame(authoredSongProfile, 61_000);
    const braced = reducePlayerState(createPlayerState(), { action: 'brace', targetZone: 'center' }, frame, 250);
    const reckless = reducePlayerState(createPlayerState(), { action: 'two-step', targetZone: 'center' }, frame, 250);

    expect(braced.balance).toBeGreaterThan(reckless.balance);
  });

  it('keeps the same balance loss over the same real-time window', () => {
    const frame = createShowFrame(authoredSongProfile, 61_000);
    const singleStep = reducePlayerState(createPlayerState(), { action: 'two-step', targetZone: 'center' }, frame, 500);

    const firstTick = reducePlayerState(createPlayerState(), { action: 'two-step', targetZone: 'center' }, frame, 250);
    const secondTick = reducePlayerState(firstTick, { action: 'two-step', targetZone: 'center' }, frame, 250);

    expect(secondTick.balance).toBeCloseTo(singleStep.balance, 6);
  });
});
