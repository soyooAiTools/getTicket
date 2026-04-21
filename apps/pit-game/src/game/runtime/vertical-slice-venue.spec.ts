import { describe, expect, it } from 'vitest';

import {
  CAMERA_SHOULDER_FRAMES,
  VENUE_ANCHORS,
  resolveCameraShoulderFrame,
  resolveVenueAnchor,
} from './vertical-slice-venue';

describe('vertical slice venue', () => {
  it('pins the authored venue anchors as named geometry constants', () => {
    expect(VENUE_ANCHORS).toEqual({
      stage: { x: 640, y: 146 },
      front: { x: 640, y: 286 },
      center: { x: 640, y: 452 },
      edge: { x: 640, y: 628 },
    });
    expect(resolveVenueAnchor('stage')).toEqual({ x: 640, y: 146 });
    expect(resolveVenueAnchor('center')).toEqual({ x: 640, y: 452 });
  });

  it('pins the shoulder-frame outputs for each authored lane', () => {
    expect(CAMERA_SHOULDER_FRAMES).toEqual({
      front: { playerScreenX: 620, playerScreenY: 470, zoom: 1.08 },
      center: { playerScreenX: 620, playerScreenY: 520, zoom: 1.02 },
      edge: { playerScreenX: 620, playerScreenY: 520, zoom: 1.02 },
      side: { playerScreenX: 560, playerScreenY: 520, zoom: 1.02 },
    });
    expect(resolveCameraShoulderFrame('front')).toEqual({ playerScreenX: 620, playerScreenY: 470, zoom: 1.08 });
    expect(resolveCameraShoulderFrame('side')).toEqual({ playerScreenX: 560, playerScreenY: 520, zoom: 1.02 });
  });
});
