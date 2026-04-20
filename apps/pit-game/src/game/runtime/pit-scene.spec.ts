import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Scene: class {},
  },
}));

import { authoredSongProfile } from '../fixtures/authored-song-profile';
import { createCrowdState } from '../domain/crowd-state';
import { createPlayerState } from '../domain/player-state';
import { deriveSessionFeedback } from '../domain/session-feedback';
import { createShowFrame } from '../domain/show-director';
import { buildPitZoneVisuals, resolvePitInput } from './pit-scene';

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

  it('builds a readable zone layout with mirrored side lanes and highlighted target states', () => {
    const frame = createShowFrame(authoredSongProfile, 61_000);
    const feedback = deriveSessionFeedback({
      frame,
      crowd: createCrowdState(frame),
      player: createPlayerState(),
      currentMission: 'center-hold',
      failed: false,
    });

    const visuals = buildPitZoneVisuals(feedback);

    expect(visuals.map((visual) => visual.id)).toEqual([
      'front',
      'side-left',
      'center',
      'side-right',
      'edge',
    ]);
    expect(visuals[0].label).toBe('FRONT');
    expect(visuals[2].isRecommendedZone).toBe(true);
    expect(visuals[1].zone).toBe('side');
    expect(visuals[3].zone).toBe('side');
  });
});
