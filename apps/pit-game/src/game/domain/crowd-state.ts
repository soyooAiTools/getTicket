import type { ShowFrame } from './show-director';

export interface CrowdZoneState {
  density: number;
  aggression: number;
  fallRisk: number;
  flow: 'hold' | 'split' | 'collapse' | 'surge';
}

export interface CrowdState {
  center: CrowdZoneState;
  edge: CrowdZoneState;
  front: CrowdZoneState;
  side: CrowdZoneState;
  fallenFans: number;
}

export function createCrowdState(frame?: ShowFrame): CrowdState {
  if (!frame) {
    return {
      center: { density: 0.45, aggression: 0.4, fallRisk: 0.18, flow: 'hold' },
      edge: { density: 0.18, aggression: 0.16, fallRisk: 0.05, flow: 'hold' },
      front: { density: 0.36, aggression: 0.24, fallRisk: 0.12, flow: 'surge' },
      side: { density: 0.2, aggression: 0.12, fallRisk: 0.05, flow: 'hold' },
      fallenFans: 0,
    };
  }

  return {
    center: {
      density: frame.crowdPreset.centerDensity,
      aggression: frame.chaos,
      fallRisk: Math.min(1, frame.chaos * 0.45 + (frame.section === 'breakdown' ? 0.2 : 0)),
      flow: frame.crowdPreset.centerFlow,
    },
    edge: {
      density: frame.crowdPreset.edgeDensity,
      aggression: Math.max(0.1, frame.chaos - 0.2),
      fallRisk: Math.max(0.03, frame.chaos * 0.45 + (frame.section === 'breakdown' ? 0.2 : 0) - 0.18),
      flow: frame.crowdPreset.centerFlow === 'split' ? 'surge' : 'hold',
    },
    front: {
      density: Math.min(0.95, frame.crowdPreset.centerDensity + 0.08),
      aggression: Math.min(1, frame.chaos + 0.08),
      fallRisk: Math.min(1, frame.chaos * 0.45 + (frame.section === 'breakdown' ? 0.2 : 0) + 0.05),
      flow: 'surge',
    },
    side: {
      density: Math.max(0.12, frame.crowdPreset.edgeDensity - 0.04),
      aggression: Math.max(0.08, frame.chaos - 0.24),
      fallRisk: Math.max(0.02, frame.chaos * 0.45 + (frame.section === 'breakdown' ? 0.2 : 0) - 0.24),
      flow: frame.crowdPreset.centerFlow === 'split' ? 'surge' : 'hold',
    },
    fallenFans: 0,
  };
}

export function advanceCrowdState(previous: CrowdState, frame: ShowFrame, dtMs: number): CrowdState {
  const seconds = dtMs / 1_000;
  const centerDensity = frame.crowdPreset.centerDensity;
  const edgeDensity = frame.crowdPreset.edgeDensity;
  const aggression = frame.chaos;
  const fallRisk = Math.min(1, frame.chaos * 0.45 + (frame.section === 'breakdown' ? 0.2 : 0));

  return {
    center: {
      density: centerDensity,
      aggression,
      fallRisk,
      flow: frame.crowdPreset.centerFlow,
    },
    edge: {
      density: edgeDensity,
      aggression: Math.max(0.1, aggression - 0.2),
      fallRisk: Math.max(0.03, fallRisk - 0.18),
      flow: frame.crowdPreset.centerFlow === 'split' ? 'surge' : 'hold',
    },
    front: {
      density: Math.min(0.95, centerDensity + 0.08),
      aggression: Math.min(1, aggression + 0.08),
      fallRisk: Math.min(1, fallRisk + 0.05),
      flow: 'surge',
    },
    side: {
      density: Math.max(0.12, edgeDensity - 0.04),
      aggression: Math.max(0.08, aggression - 0.24),
      fallRisk: Math.max(0.02, fallRisk - 0.24),
      flow: frame.crowdPreset.centerFlow === 'split' ? 'surge' : 'hold',
    },
    fallenFans: previous.fallenFans + (frame.section === 'breakdown' ? seconds * 2 : 0),
  };
}
