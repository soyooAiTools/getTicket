import type { VerticalSliceZone } from './vertical-slice-session';

export const VENUE_ANCHORS = {
  stage: { x: 640, y: 146 },
  front: { x: 640, y: 286 },
  center: { x: 640, y: 452 },
  edge: { x: 640, y: 628 },
} as const;

export const CAMERA_SHOULDER_FRAMES = {
  front: { playerScreenX: 620, playerScreenY: 470, zoom: 1.08 },
  center: { playerScreenX: 620, playerScreenY: 520, zoom: 1.02 },
  edge: { playerScreenX: 620, playerScreenY: 520, zoom: 1.02 },
  side: { playerScreenX: 560, playerScreenY: 520, zoom: 1.02 },
} as const;

export function resolveVenueAnchor(key: 'stage' | 'front' | 'center' | 'edge') {
  return VENUE_ANCHORS[key];
}

export function resolveCameraShoulderFrame(zone: VerticalSliceZone) {
  return CAMERA_SHOULDER_FRAMES[zone];
}
