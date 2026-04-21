import { describe, expect, it } from 'vitest';

import { minorityThreatVerticalSlice } from '../fixtures/minority-threat-vertical-slice';
import { createVerticalSliceFrame } from './vertical-slice-director';

describe('createVerticalSliceFrame', () => {
  it('maps the walk-in opener to room lights and lighter front pressure', () => {
    const frame = createVerticalSliceFrame(minorityThreatVerticalSlice, 2_500);

    expect(frame.phase.kind).toBe('walk-in-pressure');
    expect(frame.event?.kind).toBe('crowd-build');
    expect(frame.lightCue).toBe('room');
    expect(frame.zonePressure).toEqual({ front: 42, center: 48, edge: 22, side: 28 });
  });

  it('marks build surges as slip windows', () => {
    const frame = createVerticalSliceFrame(minorityThreatVerticalSlice, 7_000);

    expect(frame.phase.kind).toBe('build');
    expect(frame.dangerKind).toBe('surge');
    expect(frame.recommendedAction).toBe('slip');
    expect(frame.lightCue).toBe('build');
    expect(frame.zonePressure.center).toBe(72);
  });

  it('marks breakdown hits as brace-first windows', () => {
    const frame = createVerticalSliceFrame(minorityThreatVerticalSlice, 10_250);

    expect(frame.phase.kind).toBe('breakdown-peak');
    expect(frame.event?.kind).toBe('breakdown-hit');
    expect(frame.dangerKind).toBe('crush');
    expect(frame.recommendedAction).toBe('brace');
    expect(frame.cameraCue).toBe('impact');
  });

  it('keeps non-hit peak frames out of the brace window', () => {
    const frame = createVerticalSliceFrame(minorityThreatVerticalSlice, 12_000);

    expect(frame.phase.kind).toBe('breakdown-peak');
    expect(frame.event).toBeNull();
    expect(frame.dangerKind).toBe('crush');
    expect(frame.recommendedAction).toBe('shove');
    expect(frame.cameraCue).toBe('pressure');
  });

  it('settles into aftershock cues once the peak resolves', () => {
    const frame = createVerticalSliceFrame(minorityThreatVerticalSlice, 24_000);

    expect(frame.phase.kind).toBe('aftershock');
    expect(frame.event?.kind).toBe('aftershock-drop');
    expect(frame.dangerKind).toBe('aftershock');
    expect(frame.lightCue).toBe('aftershock');
    expect(frame.zonePressure).toEqual({ front: 48, center: 58, edge: 30, side: 36 });
  });
});
