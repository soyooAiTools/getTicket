import { describe, expect, it } from 'vitest';

import { minorityThreatVerticalSlice } from '../fixtures/minority-threat-vertical-slice';
import { createVerticalSliceController } from './vertical-slice-controller';

describe('vertical slice controller', () => {
  it('does not advance before playback starts', () => {
    const controller = createVerticalSliceController(minorityThreatVerticalSlice);

    controller.step({ action: 'move', targetZone: 'edge' }, 1_000);

    expect(controller.getSnapshot().elapsedMs).toBe(0);
    expect(controller.isRunning()).toBe(false);
  });

  it('publishes step updates to subscribers', () => {
    const controller = createVerticalSliceController(minorityThreatVerticalSlice);
    const updates: number[] = [];
    const unsubscribe = controller.subscribe((session) => {
      updates.push(session.elapsedMs);
    });

    controller.start();
    controller.step({ action: 'move', targetZone: 'edge' }, 1_000);
    controller.pause();
    unsubscribe();
    controller.step({ action: 'move', targetZone: 'edge' }, 1_000);

    expect(updates).toEqual([0, 1_000, 1_000]);
  });

  it('resets playback state and pauses the runtime', () => {
    const controller = createVerticalSliceController(minorityThreatVerticalSlice);

    controller.start();
    controller.step({ action: 'move', targetZone: 'edge' }, 1_000);
    controller.pause();
    controller.reset();

    expect(controller.getSnapshot().elapsedMs).toBe(0);
    expect(controller.isRunning()).toBe(false);
  });

  it('resets back to a fresh session for the same fixture', () => {
    const controller = createVerticalSliceController(minorityThreatVerticalSlice);

    controller.start();
    controller.step({ action: 'move', targetZone: 'edge' }, 3_000);
    const beforeReset = controller.getSnapshot();

    controller.reset();
    const afterReset = controller.getSnapshot();

    expect(beforeReset.elapsedMs).toBe(3_000);
    expect(afterReset.elapsedMs).toBe(0);
    expect(afterReset.failed).toBe(false);
    expect(afterReset.completed).toBe(false);
    expect(afterReset.summary).toBeNull();
    expect(afterReset.player.zone).toBe('edge');
    expect(afterReset.player.balance).toBe(100);
    expect(afterReset.player.stamina).toBe(100);
    expect(afterReset.fixture).toBe(minorityThreatVerticalSlice);
  });
});
