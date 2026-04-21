import { describe, expect, it } from 'vitest';

import { minorityThreatVerticalSlice } from '../fixtures/minority-threat-vertical-slice';
import { createVerticalSliceController } from './vertical-slice-controller';

describe('vertical slice controller lifecycle', () => {
  it('does not advance until start is called', () => {
    const controller = createVerticalSliceController(minorityThreatVerticalSlice);

    controller.step({ action: 'move', targetZone: 'edge' }, 2_000);

    expect(controller.getSnapshot().elapsedMs).toBe(0);

    controller.start();
    controller.step({ action: 'move', targetZone: 'edge' }, 2_000);

    expect(controller.getSnapshot().elapsedMs).toBe(2_000);
  });

  it('publishes a completed summary when forced complete is called', () => {
    const controller = createVerticalSliceController(minorityThreatVerticalSlice);
    controller.start();
    controller.complete();

    expect(controller.getSnapshot().completed).toBe(true);
    expect(controller.getSnapshot().summary?.label).toBe('Survived');
  });
});
