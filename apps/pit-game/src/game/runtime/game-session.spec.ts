import { describe, expect, it } from 'vitest';

import { authoredSongProfile } from '../fixtures/authored-song-profile';
import { createGameSession, stepGameSession } from './game-session';

describe('game session', () => {
  it('advances time, updates the mission, and records failure when balance collapses', () => {
    let session = createGameSession(authoredSongProfile, 61_000);

    for (let index = 0; index < 8; index += 1) {
      session = stepGameSession(session, { action: 'two-step', targetZone: 'center' }, 250);
    }

    expect(session.elapsedMs).toBe(63_000);
    expect(session.currentMission).toBe('center-hold');
    expect(session.failed).toBe(true);
  });

  it('seeds crowd state from the starting frame when created mid-song', () => {
    const session = createGameSession(authoredSongProfile, 61_000);

    expect(session.crowd.center.flow).toBe('collapse');
    expect(session.crowd.center.density).toBe(0.88);
    expect(session.crowd.edge.density).toBe(0.48);
  });

  it('splits a step across a section boundary consistently', () => {
    const startMs = 58_000;

    let combined = createGameSession(authoredSongProfile, startMs);
    combined = stepGameSession(combined, { action: 'brace', targetZone: 'center' }, 2_000);

    let split = createGameSession(authoredSongProfile, startMs);
    split = stepGameSession(split, { action: 'brace', targetZone: 'center' }, 500);
    split = stepGameSession(split, { action: 'brace', targetZone: 'center' }, 1_500);

    expect(combined.elapsedMs).toBe(split.elapsedMs);
    expect(combined.currentMission).toBe(split.currentMission);
    expect(combined.player.balance).toBeCloseTo(split.player.balance, 6);
    expect(combined.crowd.fallenFans).toBeCloseTo(split.crowd.fallenFans, 6);
  });
});
