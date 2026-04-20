import { describe, expect, it } from 'vitest';

import { rateRun } from './run-rating';

describe('run rating', () => {
  it('rates a strong clean completed run as a real one', () => {
    const rating = rateRun({
      completed: true,
      failed: false,
      durationMs: 96_000,
      elapsedMs: 96_000,
      finalBalance: 82,
      finalRespect: 156,
      finalStamina: 74,
      downEvents: 0,
      liftCount: 5,
      missionAlignedMs: 81_000,
      recommendedZoneMs: 85_000,
      rhythmMatchMs: 88_000,
      rhythmOpportunityMs: 96_000,
    });

    expect(rating.completed).toBe(true);
    expect(rating.failed).toBe(false);
    expect(rating.label).toBe('Real One');
    expect(rating.axes.survival.score).toBeGreaterThanOrEqual(90);
    expect(rating.axes.rhythm.score).toBeGreaterThanOrEqual(85);
    expect(rating.axes.presence.score).toBeGreaterThanOrEqual(80);
    expect(rating.axes.respect.score).toBeGreaterThanOrEqual(80);
  });

  it('rates a weak failed run as crowd meat', () => {
    const rating = rateRun({
      completed: false,
      failed: true,
      durationMs: 96_000,
      elapsedMs: 18_000,
      finalBalance: 0,
      finalRespect: 12,
      finalStamina: 10,
      downEvents: 2,
      liftCount: 0,
      missionAlignedMs: 1_500,
      recommendedZoneMs: 3_000,
      rhythmMatchMs: 1_200,
      rhythmOpportunityMs: 18_000,
    });

    expect(rating.completed).toBe(false);
    expect(rating.failed).toBe(true);
    expect(rating.label).toBe('Crowd Meat');
    expect(rating.axes.survival.score).toBeLessThan(40);
    expect(rating.axes.rhythm.score).toBeLessThan(35);
    expect(rating.axes.presence.score).toBeLessThan(35);
    expect(rating.axes.respect.score).toBeLessThan(35);
  });

  it('caps a strong failed run at held ground and keeps the summary aligned with removal', () => {
    const rating = rateRun({
      completed: false,
      failed: true,
      durationMs: 96_000,
      elapsedMs: 88_000,
      finalBalance: 0,
      finalRespect: 104,
      finalStamina: 42,
      downEvents: 1,
      liftCount: 3,
      missionAlignedMs: 70_000,
      recommendedZoneMs: 72_000,
      rhythmMatchMs: 78_000,
      rhythmOpportunityMs: 88_000,
    });

    expect(rating.label).toBe('Held Ground');
    expect(rating.summary).toContain('carried you out');
    expect(rating.label).not.toBe('Pit Regular');
    expect(rating.label).not.toBe('Real One');
  });
});
