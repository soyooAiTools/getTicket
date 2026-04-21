import { describe, expect, it } from 'vitest';

import { minorityThreatVerticalSlice } from '../fixtures/minority-threat-vertical-slice';
import { createVerticalSliceSession } from './vertical-slice-session';
import { createSliceRenderState } from './vertical-slice-presentation';

describe('createSliceRenderState', () => {
  it('renders a shoulder-framed player rig and dense center crowd during the peak', () => {
    const session = createVerticalSliceSession(minorityThreatVerticalSlice);
    session.elapsedMs = 12_000;

    const renderState = createSliceRenderState(session);

    expect(renderState.player.animation).toBeDefined();
    expect(renderState.camera.mode).toBe('pressure');
    expect(renderState.crowd.center.length).toBeGreaterThan(renderState.crowd.edge.length);
  });
});
