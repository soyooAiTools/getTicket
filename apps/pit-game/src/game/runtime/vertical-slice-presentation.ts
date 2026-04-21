import { createVerticalSliceFrame, type SliceLightCue } from '../domain/vertical-slice-director';
import type { VerticalSliceSession, VerticalSliceZone } from './vertical-slice-session';
import { resolveCameraShoulderFrame, resolveVenueAnchor } from './vertical-slice-venue';

export interface CrowdBodyVisual {
  zone: VerticalSliceZone;
  x: number;
  y: number;
  tint: number;
  scale: number;
}

export interface PlayerPoseStyle {
  fillColor: number;
  scaleX: number;
  scaleY: number;
  angle: number;
}

export interface SliceLightPalette {
  venueFill: number;
  bandFill: number;
  barrierFill: number;
  pitFill: number;
  edgeFill: number;
  panelFill: number;
  accentText: string;
  bodyAlpha: number;
  crowdAlpha: number;
}

export interface SliceRenderState {
  camera: {
    mode: 'impact' | 'pressure';
    zoom: number;
    playerScreenX: number;
    playerScreenY: number;
  };
  venue: {
    stage: { x: number; y: number };
    front: { x: number; y: number };
    center: { x: number; y: number };
    edge: { x: number; y: number };
    lightCue: SliceLightCue;
    palette: SliceLightPalette;
  };
  player: {
    animation: 'fall' | 'brace' | 'slip' | 'shove' | 'stagger' | 'move';
    poseStyle: PlayerPoseStyle;
    x: number;
    y: number;
  };
  crowd: {
    center: CrowdBodyVisual[];
    edge: CrowdBodyVisual[];
    side: CrowdBodyVisual[];
    front: CrowdBodyVisual[];
  };
}

const ZONE_BOUNDS: Record<VerticalSliceZone, { centerX: number; centerY: number; width: number; height: number }> = {
  front: { centerX: 640, centerY: 262, width: 640, height: 88 },
  center: { centerX: 640, centerY: 438, width: 500, height: 220 },
  edge: { centerX: 640, centerY: 624, width: 760, height: 80 },
  side: { centerX: 640, centerY: 456, width: 920, height: 240 },
};

const ZONE_TINTS: Record<VerticalSliceZone, number> = {
  front: 0xcf6f48,
  center: 0xa65738,
  edge: 0x6d4634,
  side: 0x86513d,
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function zonePopulation(zone: VerticalSliceZone, pressure: number): number {
  switch (zone) {
    case 'center':
      return Math.max(8, Math.floor(pressure / 10));
    case 'front':
      return Math.max(4, Math.floor(pressure / 18));
    case 'side':
      return Math.max(4, Math.floor(pressure / 16));
    case 'edge':
      return Math.max(3, Math.floor(pressure / 18));
  }
}

function createZoneBodyVisuals(zone: VerticalSliceZone, count: number, pressure: number): CrowdBodyVisual[] {
  const bounds = ZONE_BOUNDS[zone];
  const visuals: CrowdBodyVisual[] = [];
  const columns = Math.max(1, Math.ceil(Math.sqrt(count)));
  const rows = Math.max(1, Math.ceil(count / columns));
  const stepX = bounds.width / (columns + 1);
  const stepY = bounds.height / (rows + 1);
  const pressureScale = 0.78 + pressure / 260;

  for (let index = 0; index < count; index += 1) {
    const row = Math.floor(index / columns);
    const column = index % columns;
    const centeredX =
      zone === 'side'
        ? (column % 2 === 0 ? 274 : 1_006) + (row % 2 === 0 ? -18 : 18)
        : bounds.centerX - bounds.width / 2 + stepX * (column + 1);
    const centeredY = bounds.centerY - bounds.height / 2 + stepY * (row + 1);
    const lateralOffset =
      zone === 'side'
        ? (index % 2 === 0 ? -1 : 1) * (18 + row * 6)
        : (column - (columns - 1) / 2) * 6;
    const verticalOffset = ((index % 3) - 1) * 5;

    visuals.push({
      zone,
      x: centeredX + lateralOffset,
      y: centeredY + verticalOffset,
      tint: ZONE_TINTS[zone],
      scale: clamp(pressureScale + ((index % 4) - 1.5) * 0.03, 0.74, 1.22),
    });
  }

  return visuals;
}

export function resolvePlayerPoseStyle(animation: SliceRenderState['player']['animation']): PlayerPoseStyle {
  switch (animation) {
    case 'fall':
      return { fillColor: 0x7f5a49, scaleX: 1.18, scaleY: 0.48, angle: 88 };
    case 'brace':
      return { fillColor: 0xf6d59c, scaleX: 0.96, scaleY: 0.82, angle: 0 };
    case 'slip':
      return { fillColor: 0xf6d59c, scaleX: 1.18, scaleY: 0.86, angle: -18 };
    case 'shove':
      return { fillColor: 0xf1c485, scaleX: 1.08, scaleY: 0.92, angle: 12 };
    case 'stagger':
      return { fillColor: 0xd28f72, scaleX: 1.02, scaleY: 0.88, angle: 14 };
    default:
      return { fillColor: 0xf9e4ba, scaleX: 1, scaleY: 1, angle: 0 };
  }
}

export function resolveSliceLightPalette(lightCue: SliceLightCue): SliceLightPalette {
  switch (lightCue) {
    case 'room':
      return {
        venueFill: 0x130e0d,
        bandFill: 0x25100f,
        barrierFill: 0xb18a62,
        pitFill: 0x241715,
        edgeFill: 0x1a1211,
        panelFill: 0x090808,
        accentText: '#e8c894',
        bodyAlpha: 0.92,
        crowdAlpha: 0.84,
      };
    case 'build':
      return {
        venueFill: 0x1c110f,
        bandFill: 0x3d1f1a,
        barrierFill: 0xc79e6b,
        pitFill: 0x2d1815,
        edgeFill: 0x201212,
        panelFill: 0x110909,
        accentText: '#ffce96',
        bodyAlpha: 0.95,
        crowdAlpha: 0.9,
      };
    case 'hit':
      return {
        venueFill: 0x24110f,
        bandFill: 0x513128,
        barrierFill: 0xf0c07f,
        pitFill: 0x3a1e1a,
        edgeFill: 0x261515,
        panelFill: 0x170c0b,
        accentText: '#ffe3b0',
        bodyAlpha: 1,
        crowdAlpha: 0.98,
      };
    case 'aftershock':
      return {
        venueFill: 0x171010,
        bandFill: 0x2f1715,
        barrierFill: 0xa67e63,
        pitFill: 0x261919,
        edgeFill: 0x1d1414,
        panelFill: 0x0d0909,
        accentText: '#d8b59d',
        bodyAlpha: 0.9,
        crowdAlpha: 0.8,
      };
  }
}

function resolvePlayerAnimation(session: VerticalSliceSession): SliceRenderState['player']['animation'] {
  if (session.player.status === 'down') {
    return 'fall';
  }
  if (session.player.pose === 'brace') {
    return 'brace';
  }
  if (session.player.pose === 'slip') {
    return 'slip';
  }
  if (session.player.pose === 'shove') {
    return 'shove';
  }
  if (session.player.status === 'staggered') {
    return 'stagger';
  }
  return 'move';
}

function resolveFrame(session: VerticalSliceSession) {
  const frameAtMs = Math.min(session.elapsedMs, session.fixture.profile.durationMs - 1);
  return createVerticalSliceFrame(session.fixture, frameAtMs);
}

export function createSliceRenderState(session: VerticalSliceSession): SliceRenderState {
  const frame = resolveFrame(session);
  const centerDensity = frame.zonePressure.center;
  const edgeDensity = frame.zonePressure.edge;
  const animation = resolvePlayerAnimation(session);
  const cameraFrame = resolveCameraShoulderFrame(session.player.zone);
  const stage = resolveVenueAnchor('stage');
  const front = resolveVenueAnchor('front');
  const center = resolveVenueAnchor('center');
  const edge = resolveVenueAnchor('edge');

  return {
    camera: {
      mode: frame.cameraCue === 'impact' ? 'impact' : 'pressure',
      zoom: cameraFrame.zoom,
      playerScreenX: cameraFrame.playerScreenX,
      playerScreenY: cameraFrame.playerScreenY,
    },
    venue: {
      stage,
      front,
      center,
      edge,
      lightCue: frame.lightCue,
      palette: resolveSliceLightPalette(frame.lightCue),
    },
    player: {
      animation,
      poseStyle: resolvePlayerPoseStyle(animation),
      x: cameraFrame.playerScreenX,
      y: session.player.status === 'down' ? cameraFrame.playerScreenY + 22 : cameraFrame.playerScreenY,
    },
    crowd: {
      center: createZoneBodyVisuals('center', zonePopulation('center', centerDensity), centerDensity),
      edge: createZoneBodyVisuals('edge', zonePopulation('edge', edgeDensity), edgeDensity),
      side: createZoneBodyVisuals('side', zonePopulation('side', frame.zonePressure.side), frame.zonePressure.side),
      front: createZoneBodyVisuals('front', zonePopulation('front', frame.zonePressure.front), frame.zonePressure.front),
    },
  };
}
