import { describe, expect, it } from 'vitest';

import { createVerticalSliceFrame } from '../domain/vertical-slice-director';
import { minorityThreatVerticalSlice } from '../fixtures/minority-threat-vertical-slice';
import { createVerticalSliceSession } from './vertical-slice-session';
import { createSliceRenderState } from './vertical-slice-presentation';

describe('createSliceRenderState', () => {
  it('preserves the authored follow camera cue instead of flattening it', () => {
    const session = createVerticalSliceSession(minorityThreatVerticalSlice);

    const renderState = createSliceRenderState(session);

    expect(renderState.camera.mode).toBe('follow');
  });

  it('derives presentation from the controller-published frame instead of recomputing one', () => {
    const session = createVerticalSliceSession(minorityThreatVerticalSlice);
    session.elapsedMs = 12_000;
    session.frame = createVerticalSliceFrame(minorityThreatVerticalSlice, 0);

    const renderState = createSliceRenderState(session);

    expect(renderState.camera.mode).toBe('follow');
    expect(renderState.venue.lightCue).toBe('room');
    expect(renderState.crowd.center.length).toBe(8);
    expect(renderState.crowd.edge.length).toBe(3);
  });

  it('renders a shoulder-framed player rig and dense center crowd during the peak', () => {
    const session = createVerticalSliceSession(minorityThreatVerticalSlice);
    session.elapsedMs = 12_000;
    session.frame = createVerticalSliceFrame(minorityThreatVerticalSlice, 12_000);

    const renderState = createSliceRenderState(session);

    expect(renderState.player.animation).toBe('move');
    expect(renderState.camera.mode).toBe('pressure');
    expect(renderState.crowd.center.length).toBeGreaterThan(renderState.crowd.edge.length);
  });
});
