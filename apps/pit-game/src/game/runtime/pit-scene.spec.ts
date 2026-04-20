import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Scene: class {},
  },
}));

import { resolvePitInput } from './pit-scene';

describe('pit scene controls', () => {
  it('keeps an action active while its key remains held', () => {
    expect(
      resolvePitInput(
        {
          slip: true,
          twoStep: false,
          shove: false,
          brace: false,
          lift: false,
          edge: false,
          center: false,
          front: false,
          side: false,
        },
        'center',
      ),
    ).toEqual({
      action: 'slip',
      targetZone: 'center',
    });
  });

  it('updates the selected target zone from directional controls', () => {
    expect(
      resolvePitInput(
        {
          slip: false,
          twoStep: false,
          shove: false,
          brace: false,
          lift: false,
          edge: false,
          center: false,
          front: true,
          side: false,
        },
        'edge',
      ),
    ).toEqual({
      action: 'idle',
      targetZone: 'front',
    });

    expect(
      resolvePitInput(
        {
          slip: false,
          twoStep: false,
          shove: false,
          brace: true,
          lift: false,
          edge: false,
          center: false,
          front: false,
          side: true,
        },
        'front',
      ),
    ).toEqual({
      action: 'brace',
      targetZone: 'side',
    });
  });
});
