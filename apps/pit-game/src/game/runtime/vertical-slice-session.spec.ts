import { describe, expect, it } from 'vitest';

import { minorityThreatVerticalSlice } from '../fixtures/minority-threat-vertical-slice';
import { createVerticalSliceSession, stepVerticalSliceSession } from './vertical-slice-session';

describe('vertical slice session pressure loop', () => {
  it('drops the player into stagger when they eat a build surge without slipping', () => {
    let session = createVerticalSliceSession(minorityThreatVerticalSlice);

    session = stepVerticalSliceSession(session, { action: 'move', targetZone: 'side' }, 7_000);

    expect(session.player.status).toBe('staggered');
  });

  it('lets the player survive the first peak window by bracing correctly', () => {
    let session = createVerticalSliceSession(minorityThreatVerticalSlice);

    session = stepVerticalSliceSession(session, { action: 'brace', targetZone: 'center' }, 10_500);

    expect(session.player.status).not.toBe('down');
    expect(session.player.balance).toBeGreaterThan(0);
  });
});
