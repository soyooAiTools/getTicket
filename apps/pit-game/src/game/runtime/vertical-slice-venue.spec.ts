import { describe, expect, it } from 'vitest';

import { resolveCameraShoulderFrame, resolveVenueAnchor } from './vertical-slice-venue';

describe('vertical slice venue', () => {
  it('keeps the player anchored in a readable shoulder frame', () => {
    const camera = resolveCameraShoulderFrame('center');

    expect(camera.playerScreenX).toBeGreaterThan(420);
    expect(camera.playerScreenX).toBeLessThan(720);
    expect(camera.playerScreenY).toBeGreaterThan(430);
  });

  it('separates stage, center pit, and edge lane anchors', () => {
    expect(resolveVenueAnchor('stage').y).toBeLessThan(resolveVenueAnchor('center').y);
    expect(resolveVenueAnchor('edge').y).toBeGreaterThan(resolveVenueAnchor('center').y);
  });
});
