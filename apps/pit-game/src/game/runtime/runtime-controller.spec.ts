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

  it('caps stepping at the authored song duration without crashing', () => {
    const controller = createRuntimeController(authoredSongProfile, authoredSongProfile.durationMs - 100);

    expect(() => controller.step({ action: 'idle', targetZone: 'center' }, 250)).not.toThrow();
    expect(controller.getSnapshot().elapsedMs).toBe(authoredSongProfile.durationMs - 1);
  });

  it('supports unsubscribe and reset notifications', () => {
    const controller = createRuntimeController(authoredSongProfile, 59_000);
    const snapshots: number[] = [];
    const unsubscribe = controller.subscribe((session) => {
      snapshots.push(session.elapsedMs);
    });

    controller.step({ action: 'brace', targetZone: 'center' }, 250);
    unsubscribe();
    controller.step({ action: 'brace', targetZone: 'center' }, 250);
    controller.reset(authoredSongProfile);

    expect(snapshots).toEqual([59_250]);
    expect(controller.getSnapshot().elapsedMs).toBe(0);
  });

  it('publishes a result when the run ends and stops stepping afterward', () => {
    const controller = createRuntimeController(authoredSongProfile, authoredSongProfile.durationMs - 1_000);

    controller.step({ action: 'brace', targetZone: 'center' }, 500);
    controller.step({ action: 'brace', targetZone: 'center' }, 500);

    const finished = controller.getSnapshot();
    expect(finished.completed).toBe(true);
    expect(finished.result).not.toBeNull();

    const elapsedMs = finished.elapsedMs;
    controller.step({ action: 'shove', targetZone: 'front' }, 250);

    expect(controller.getSnapshot().elapsedMs).toBe(elapsedMs);
  });
});
