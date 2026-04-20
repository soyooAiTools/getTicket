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

import { createVerticalSliceFrame } from '../domain/vertical-slice-director';
import { minorityThreatVerticalSlice } from '../fixtures/minority-threat-vertical-slice';
import { createVerticalSliceController } from './vertical-slice-controller';
import {
  buildCrowdBodyLayout,
  resolveSliceLightPalette,
  stepSceneController,
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
    const visuals = buildCrowdBodyLayout(createVerticalSliceFrame(minorityThreatVerticalSlice, 9_000));
    const centerBodies = visuals.filter((body) => body.zone === 'center');
    const edgeBodies = visuals.filter((body) => body.zone === 'edge');

    expect(visuals.length).toBeGreaterThanOrEqual(18);
    expect(centerBodies.length).toBeGreaterThan(edgeBodies.length);
  });

  it('keeps side-lane bodies out of the center corridor', () => {
    const visuals = buildCrowdBodyLayout(createVerticalSliceFrame(minorityThreatVerticalSlice, 9_000));
    const sideBodies = visuals.filter((body) => body.zone === 'side');

    expect(sideBodies.length).toBeGreaterThan(0);
    expect(sideBodies.every((body) => body.x <= 430 || body.x >= 850)).toBe(true);
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

  it('maps the down state to the collapsed body style', () => {
    expect(
      resolvePlayerPoseStyle({
        pose: 'fall',
        status: 'down',
      }),
    ).toEqual({
      fillColor: 0x7f5a49,
      scaleX: 1.18,
      scaleY: 0.48,
      angle: 88,
    });
  });

  it('resolves a visible palette from the authored light cue', () => {
    expect(resolveSliceLightPalette('hit')).toMatchObject({
      venueFill: 0x24110f,
      bandFill: 0x513128,
      crowdAlpha: 0.98,
      accentText: '#ffe3b0',
    });
  });

  it('detects punch cues even when the scene advances through a large hitch', () => {
    const controller = createVerticalSliceController(minorityThreatVerticalSlice);
    controller.step({ action: 'brace', targetZone: 'edge' }, 8_700);

    const result = stepSceneController(
      controller,
      { action: 'brace', targetZone: 'center' },
      800,
    );

    expect(result.punchDetected).toBe(true);
    expect(result.snapshot.elapsedMs).toBe(9_500);
    expect(result.snapshot.frame.cameraCue).toBe('steady');
  });
});
