import { describe, expect, it } from 'vitest';

import { minorityThreatVerticalSlice } from '../fixtures/minority-threat-vertical-slice';
import { createVerticalSliceController } from './vertical-slice-controller';

describe('vertical slice controller', () => {
  it('publishes step updates to subscribers', () => {
    const controller = createVerticalSliceController(minorityThreatVerticalSlice);
    const updates: number[] = [];
    const unsubscribe = controller.subscribe((session) => {
      updates.push(session.elapsedMs);
    });

    controller.step({ action: 'move', targetZone: 'edge' }, 1_000);
    unsubscribe();
    controller.step({ action: 'move', targetZone: 'edge' }, 1_000);

    expect(updates).toEqual([1_000]);
  });

  it('resets back to a fresh session for the same fixture', () => {
    const controller = createVerticalSliceController(minorityThreatVerticalSlice);

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
