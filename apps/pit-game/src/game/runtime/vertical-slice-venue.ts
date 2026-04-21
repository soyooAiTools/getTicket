import type { VerticalSliceZone } from './vertical-slice-session';

export function resolveVenueAnchor(key: 'stage' | 'front' | 'center' | 'edge') {
  switch (key) {
    case 'stage':
      return { x: 640, y: 146 };
    case 'front':
      return { x: 640, y: 286 };
    case 'center':
      return { x: 640, y: 452 };
    case 'edge':
      return { x: 640, y: 628 };
  }
}

export function resolveCameraShoulderFrame(zone: VerticalSliceZone) {
  return {
    playerScreenX: zone === 'side' ? 560 : 620,
    playerScreenY: zone === 'front' ? 470 : 520,
    zoom: zone === 'front' ? 1.08 : 1.02,
  };
}
