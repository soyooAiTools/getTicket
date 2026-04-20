import { describe, expect, it } from 'vitest';

import { authoredSongProfile } from '../fixtures/authored-song-profile';
import { createCrowdState } from './crowd-state';
import { createPlayerState } from './player-state';
import { deriveSessionFeedback } from './session-feedback';
import { createShowFrame } from './show-director';

describe('session feedback', () => {
  it('describes a calm readable state with a clear front-line recommendation', () => {
    const frame = createShowFrame(authoredSongProfile, 8_000);
    const feedback = deriveSessionFeedback({
      frame,
      crowd: createCrowdState(frame),
      player: createPlayerState(),
      currentMission: 'survive-window',
      failed: false,
    });

    expect(feedback.section.label).toBe('Gather');
    expect(feedback.danger.state).toBe('readable');
    expect(feedback.danger.label).toBe('Readable');
    expect(feedback.action.recommendedZone).toBe('front');
    expect(feedback.action.label).toBe('Lean into the front and stay light');
    expect(feedback.zones.front.isRecommendedZone).toBe(true);
    expect(feedback.player.condition).toBe('Stable');
  });

  it('describes a high-danger breakdown state with center-hold positioning', () => {
    const frame = createShowFrame(authoredSongProfile, 61_000);
    const feedback = deriveSessionFeedback({
      frame,
      crowd: {
        ...createCrowdState(frame),
        center: { density: 0.5, aggression: 0.45, fallRisk: 0.16, flow: 'collapse' },
        front: { density: 0.36, aggression: 0.3, fallRisk: 0.12, flow: 'surge' },
      },
      player: { ...createPlayerState(), stamina: 100, balance: 100, respect: 16 },
      currentMission: 'survive-window',
      failed: false,
    });

    expect(feedback.section.label).toBe('Breakdown');
    expect(feedback.danger.state).toBe('high');
    expect(feedback.danger.label).toBe('High');
    expect(feedback.action.recommendedZone).toBe('center');
    expect(feedback.action.label).toBe('Brace and keep your feet under you');
    expect(feedback.zones.center.isRecommendedZone).toBe(true);
  });

  it('marks a downed player as removed from the pit', () => {
    const frame = createShowFrame(authoredSongProfile, 61_000);
    const feedback = deriveSessionFeedback({
      frame,
      crowd: createCrowdState(frame),
      player: { ...createPlayerState(), status: 'down', balance: 0, stamina: 12, zone: 'edge' },
      currentMission: 'help-fallen',
      failed: true,
    });

    expect(feedback.danger.state).toBe('removed');
    expect(feedback.danger.label).toBe('Removed');
    expect(feedback.action.label).toBe('Removed from the pit');
    expect(feedback.player.condition).toBe('Removed from the pit');
    expect(feedback.action.recommendedZone).toBe('edge');
  });
});
