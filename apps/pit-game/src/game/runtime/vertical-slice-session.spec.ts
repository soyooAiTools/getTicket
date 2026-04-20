import { describe, expect, it } from 'vitest';

import { minorityThreatVerticalSlice } from '../fixtures/minority-threat-vertical-slice';
import { createVerticalSliceSession, stepVerticalSliceSession } from './vertical-slice-session';

describe('vertical slice session', () => {
  it('fails when the player idles through the breakdown peak', () => {
    let session = createVerticalSliceSession(minorityThreatVerticalSlice);

    for (let index = 0; index < 30; index += 1) {
      session = stepVerticalSliceSession(session, { action: 'idle', targetZone: 'center' }, 1_000);
      if (session.failed) {
        break;
      }
    }

    expect(session.failed).toBe(true);
    expect(session.summary?.label).toBe('Dropped');
  });
});
