import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    AUTO: 'AUTO',
    Scene: class {},
    Input: {
      Keyboard: {
        KeyCodes: {
          A: 65,
          S: 83,
          D: 68,
          F: 70,
          UP: 38,
          DOWN: 40,
          LEFT: 37,
          RIGHT: 39,
        },
      },
    },
  },
}));

import { minorityThreatVerticalSlice } from '../fixtures/minority-threat-vertical-slice';
import {
  buildCrowdBodyLayout,
  resolvePlayerPoseStyle,
  resolveSliceInput,
} from './vertical-slice-scene';

describe('vertical slice scene helpers', () => {
  it('resolves held controls into one action and one zone', () => {
    expect(
      resolveSliceInput(
        {
          move: false,
          shove: false,
          brace: true,
          slip: false,
          front: false,
          center: true,
          edge: false,
          side: false,
        },
        'edge',
      ),
    ).toEqual({
      action: 'brace',
      targetZone: 'center',
    });
  });

  it('builds a denser center crowd layout for the breakdown-hit peak', () => {
    const frame = minorityThreatVerticalSlice.events.find((event) => event.atMs === 9_000);
    expect(frame).toBeDefined();

    const breakdownFrame = {
      phase: minorityThreatVerticalSlice.phases[1],
      event: frame ?? null,
      zonePressure: { front: 88, center: 100, edge: 74, side: 78 },
      recommendedAction: 'brace' as const,
      cameraCue: 'punch' as const,
      lightCue: 'hit' as const,
    };

    const visuals = buildCrowdBodyLayout(breakdownFrame);
    const centerBodies = visuals.filter((body) => body.zone === 'center');
    const edgeBodies = visuals.filter((body) => body.zone === 'edge');

    expect(visuals.length).toBeGreaterThanOrEqual(18);
    expect(centerBodies.length).toBeGreaterThan(edgeBodies.length);
  });

  it('maps the brace pose to the authored body style', () => {
    expect(
      resolvePlayerPoseStyle({
        pose: 'brace',
        status: 'upright',
      }),
    ).toMatchObject({
      fillColor: 0xf6d59c,
      scaleY: 0.82,
    });
  });
});
