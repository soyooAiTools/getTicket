import { describe, expect, it } from 'vitest';

import { authoredSongProfile } from '../fixtures/authored-song-profile';
import { createRuntimeController } from './runtime-controller';

describe('runtime controller', () => {
  it('steps the session and publishes snapshots to subscribers', () => {
    const controller = createRuntimeController(authoredSongProfile, 59_000);
    const snapshots: number[] = [];

    controller.subscribe((session) => {
      snapshots.push(session.elapsedMs);
    });

    controller.step({ action: 'brace', targetZone: 'center' }, 250);

    expect(snapshots).toEqual([59_250]);
    expect(controller.getSnapshot().currentMission).toBe('center-hold');
  });
});
