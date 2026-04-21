import { describe, expect, it } from 'vitest';

import { minorityThreatVerticalSlice } from '../fixtures/minority-threat-vertical-slice';
import {
  completeVerticalSliceSession,
  createVerticalSliceSession,
  stepVerticalSliceSession,
} from './vertical-slice-session';

describe('vertical slice session pressure loop', () => {
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

    session = stepVerticalSliceSession(session, { action: 'idle', targetZone: 'edge' }, 6_800);
    session = stepVerticalSliceSession(session, { action: 'slip', targetZone: 'side' }, 400);

    expect(session.frame.event?.kind).toBe('lateral-surge');
    expect(session.frame.recommendedAction).toBe('slip');
    expect(session.hitWindows).toBe(1);
  });

  it('only counts a matching authored window once across repeated steps', () => {
    let session = createVerticalSliceSession(minorityThreatVerticalSlice);

    session = stepVerticalSliceSession(session, { action: 'move', targetZone: 'edge' }, 2_400);
    session = stepVerticalSliceSession(session, { action: 'move', targetZone: 'edge' }, 100);
    session = stepVerticalSliceSession(session, { action: 'move', targetZone: 'edge' }, 100);
    session = stepVerticalSliceSession(session, { action: 'move', targetZone: 'edge' }, 100);

    expect(session.frame.phase.kind).toBe('walk-in-pressure');
    expect(session.frame.event?.kind).toBe('crowd-build');
    expect(session.hitWindows).toBe(2);
  });

  it('scales pressure loss with the amount of time spent under the same final frame', () => {
    let longExposure = createVerticalSliceSession(minorityThreatVerticalSlice);
    let shortExposure = createVerticalSliceSession(minorityThreatVerticalSlice);

    longExposure = stepVerticalSliceSession(longExposure, { action: 'move', targetZone: 'center' }, 2_000);
    longExposure = stepVerticalSliceSession(longExposure, { action: 'idle', targetZone: 'center' }, 1_000);

    shortExposure = stepVerticalSliceSession(shortExposure, { action: 'move', targetZone: 'center' }, 2_900);
    shortExposure = stepVerticalSliceSession(shortExposure, { action: 'idle', targetZone: 'center' }, 100);

    expect(longExposure.elapsedMs).toBe(shortExposure.elapsedMs);
    expect(longExposure.player.balance).toBeLessThan(shortExposure.player.balance);
  });

  it('accumulates pressure across stepped phases instead of reusing only the ending frame', () => {
    let singleStep = createVerticalSliceSession(minorityThreatVerticalSlice);
    let phasedSteps = createVerticalSliceSession(minorityThreatVerticalSlice);

    singleStep = stepVerticalSliceSession(singleStep, { action: 'move', targetZone: 'edge' }, 25_000);

    phasedSteps = stepVerticalSliceSession(phasedSteps, { action: 'move', targetZone: 'edge' }, 4_000);
    phasedSteps = stepVerticalSliceSession(phasedSteps, { action: 'move', targetZone: 'edge' }, 6_000);
    phasedSteps = stepVerticalSliceSession(phasedSteps, { action: 'move', targetZone: 'edge' }, 14_000);
    phasedSteps = stepVerticalSliceSession(phasedSteps, { action: 'move', targetZone: 'edge' }, 1_000);

    expect(singleStep.elapsedMs).toBe(phasedSteps.elapsedMs);
    expect(singleStep.frame.phase.kind).toBe('aftershock');
    expect(phasedSteps.frame.phase.kind).toBe('aftershock');
    expect(singleStep.player.balance).toBeCloseTo(phasedSteps.player.balance, 6);
  });

  it('does not convert a failed run into a survived completion', () => {
    let session = createVerticalSliceSession(minorityThreatVerticalSlice);

    for (let index = 0; index < 30; index += 1) {
      session = stepVerticalSliceSession(session, { action: 'idle', targetZone: 'center' }, 1_000);
      if (session.failed) {
        break;
      }
    }

    const completed = completeVerticalSliceSession(session, {
      action: 'brace',
      targetZone: 'side',
    });

    expect(completed.failed).toBe(true);
    expect(completed.summary?.label).toBe('Dropped');
    expect(completed.player.status).toBe('down');
    expect(completed.player.pose).toBe('fall');
  });
});
