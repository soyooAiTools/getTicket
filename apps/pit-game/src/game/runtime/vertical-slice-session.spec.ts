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

  it('completes the slice with a survived summary when the player follows the authored windows', () => {
    let session = createVerticalSliceSession(minorityThreatVerticalSlice);

    const plan = [
      { action: 'brace' as const, targetZone: 'edge' as const, dtMs: 24_000 },
      { action: 'shove' as const, targetZone: 'edge' as const, dtMs: 6_000 },
    ];

    for (const step of plan) {
      session = stepVerticalSliceSession(session, step, step.dtMs);
    }

    expect(session.completed).toBe(true);
    expect(session.failed).toBe(false);
    expect(session.summary?.label).toBe('Survived');
  });

  it('captures authored event windows during large-dt stepping instead of skipping them', () => {
    let session = createVerticalSliceSession(minorityThreatVerticalSlice);

    session = stepVerticalSliceSession(session, { action: 'idle', targetZone: 'edge' }, 7_300);
    session = stepVerticalSliceSession(session, { action: 'slip', targetZone: 'side' }, 400);

    expect(session.frame.event?.kind).toBe('lateral-surge');
    expect(session.frame.recommendedAction).toBe('slip');
    expect(session.hitWindows).toBe(1);
  });

  it('only counts a matching authored window once across repeated steps', () => {
    let session = createVerticalSliceSession(minorityThreatVerticalSlice);

    session = stepVerticalSliceSession(session, { action: 'move', targetZone: 'edge' }, 1_000);
    session = stepVerticalSliceSession(session, { action: 'move', targetZone: 'edge' }, 100);
    session = stepVerticalSliceSession(session, { action: 'move', targetZone: 'edge' }, 100);

    expect(session.frame.phase.kind).toBe('tension-in');
    expect(session.hitWindows).toBe(1);
  });
});
