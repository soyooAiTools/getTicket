import type { CrowdState } from './crowd-state';
import type { PlayerState, PlayerZone } from './player-state';
import type { SectionKind } from './song-profile';
import type { ShowFrame } from './show-director';

export type SessionMission = 'survive-window' | 'center-hold' | 'help-fallen' | 'cross-line';
export type SessionDangerState = 'readable' | 'building' | 'high' | 'critical' | 'removed';

export interface SessionFeedbackInput {
  frame: ShowFrame;
  crowd: CrowdState;
  player: PlayerState;
  currentMission: SessionMission;
  failed: boolean;
}

export interface SessionZoneFeedback {
  label: string;
  pressure: number;
  pressureLabel: 'Open' | 'Active' | 'Hot' | 'Crushing';
  state: 'open' | 'steady' | 'hot' | 'crushing';
  cue: string;
  isCurrentZone: boolean;
  isRecommendedZone: boolean;
}

export interface SessionFeedback {
  section: {
    kind: SectionKind;
    label: string;
    detail: string;
  };
  danger: {
    state: SessionDangerState;
    label: string;
    detail: string;
    score: number;
  };
  mission: {
    kind: SessionMission;
    label: string;
    detail: string;
  };
  action: {
    label: string;
    detail: string;
    recommendedZone: PlayerZone;
  };
  player: {
    condition: string;
    detail: string;
    stamina: number;
    balance: number;
    respect: number;
  };
  zones: Record<PlayerZone, SessionZoneFeedback>;
}

function getSectionLabel(kind: SectionKind): string {
  switch (kind) {
    case 'gather':
      return 'Gather';
    case 'push':
      return 'Push';
    case 'two-step':
      return 'Two-step';
    case 'side-to-side prep':
      return 'Side-to-side prep';
    case 'breakdown':
      return 'Breakdown';
    case 'recovery':
      return 'Recovery';
  }

  throw new Error(`Unsupported section kind: ${kind}`);
}

function getSectionDetail(kind: SectionKind): string {
  switch (kind) {
    case 'gather':
      return 'The room is opening up and the pit is still readable.';
    case 'push':
      return 'The crowd is leaning forward and the crush is starting to build.';
    case 'two-step':
      return 'The groove is clear, so clean rhythmic movement pays off.';
    case 'side-to-side prep':
      return 'The floor is splitting left and right before the crash.';
    case 'breakdown':
      return 'The heaviest pressure window is on the floor right now.';
    case 'recovery':
      return 'The room is breathing again and the floor is loosening.';
  }

  throw new Error(`Unsupported section kind: ${kind}`);
}

function getMissionLabel(kind: SessionMission): string {
  switch (kind) {
    case 'survive-window':
      return 'Survive the window';
    case 'center-hold':
      return 'Hold the center';
    case 'help-fallen':
      return 'Help the fallen';
    case 'cross-line':
      return 'Cross the line';
  }

  throw new Error(`Unsupported mission kind: ${kind}`);
}

function getMissionDetail(kind: SessionMission): string {
  switch (kind) {
    case 'survive-window':
      return 'Stay upright until the pressure drops.';
    case 'center-hold':
      return 'Keep your feet under you and protect the middle.';
    case 'help-fallen':
      return 'Scan for anyone down and get them back up safely.';
    case 'cross-line':
      return 'Move across the split without getting pinned.';
  }

  throw new Error(`Unsupported mission kind: ${kind}`);
}

function getDangerLabel(state: SessionDangerState): string {
  switch (state) {
    case 'readable':
      return 'Readable';
    case 'building':
      return 'Building';
    case 'high':
      return 'High';
    case 'critical':
      return 'Critical';
    case 'removed':
      return 'Removed';
  }

  throw new Error(`Unsupported danger state: ${state}`);
}

function getZoneLabel(zone: PlayerZone): string {
  switch (zone) {
    case 'front':
      return 'Front';
    case 'center':
      return 'Center';
    case 'edge':
      return 'Edge';
    case 'side':
      return 'Side';
  }

  throw new Error(`Unsupported zone: ${zone}`);
}

function getZoneState(pressure: number): SessionZoneFeedback['state'] {
  if (pressure >= 82) {
    return 'crushing';
  }

  if (pressure >= 60) {
    return 'hot';
  }

  if (pressure >= 35) {
    return 'steady';
  }

  return 'open';
}

function getZoneCue(zone: PlayerZone, pressure: number, recommendedZone: PlayerZone): string {
  if (zone === recommendedZone) {
    return pressure >= 60 ? 'Right where the pressure wants you.' : 'Best place to work the room.';
  }

  if (pressure >= 60) {
    return 'Watch the crush before you step in.';
  }

  return 'Open enough to move through.';
}

function getZonePressure(zone: { density: number; aggression: number; fallRisk: number }): number {
  return Math.max(
    0,
    Math.min(100, Math.round(zone.density * 45 + zone.aggression * 35 + zone.fallRisk * 20)),
  );
}

function getDangerScore(input: SessionFeedbackInput): number {
  const base = input.frame.section === 'breakdown' ? 54 : input.frame.chaos * 45;
  const crowdPressure =
    input.crowd.center.aggression * 18 + input.crowd.center.fallRisk * 18 + input.crowd.front.density * 8;
  const playerPressure = (100 - input.player.balance) * 0.35 + (100 - input.player.stamina) * 0.2;
  const missionPressure = input.currentMission === 'center-hold' ? 8 : input.currentMission === 'help-fallen' ? 4 : 0;

  return Math.max(0, Math.min(100, Math.round(base + crowdPressure + playerPressure + missionPressure)));
}

function getDangerState(input: SessionFeedbackInput, dangerScore: number): SessionDangerState {
  if (input.failed || input.player.status === 'down') {
    return 'removed';
  }

  if (dangerScore >= 88) {
    return 'critical';
  }

  if (dangerScore >= 68) {
    return 'high';
  }

  if (dangerScore >= 38) {
    return 'building';
  }

  return 'readable';
}

function getRecommendedZone(input: SessionFeedbackInput, dangerState: SessionDangerState): PlayerZone {
  if (dangerState === 'removed') {
    return input.player.zone;
  }

  switch (input.currentMission) {
    case 'center-hold':
      return 'center';
    case 'help-fallen':
      return 'edge';
    case 'cross-line':
      return 'side';
    case 'survive-window':
      break;
  }

  switch (input.frame.section) {
    case 'breakdown':
      return 'center';
    case 'side-to-side prep':
      return 'side';
    case 'two-step':
      return 'center';
    case 'push':
      return 'front';
    case 'recovery':
      return 'edge';
    case 'gather':
      return 'front';
  }
}

function getActionLabel(input: SessionFeedbackInput, dangerState: SessionDangerState, recommendedZone: PlayerZone): string {
  if (dangerState === 'removed') {
    return 'Removed from the pit';
  }

  if (input.player.status === 'down') {
    return 'Get clear and recover';
  }

  if (dangerState === 'critical' || input.frame.section === 'breakdown') {
    return input.currentMission === 'help-fallen'
      ? 'Brace, then lift anyone down'
      : 'Brace and keep your feet under you';
  }

  if (input.frame.section === 'side-to-side prep') {
    return 'Slip toward the side lane and cross on the next opening';
  }

  if (input.frame.section === 'two-step') {
    return 'Keep the bounce with two-step';
  }

  if (input.currentMission === 'help-fallen') {
    return 'Watch the floor and help someone up';
  }

  if (input.currentMission === 'cross-line') {
    return 'Use the side lane to cross cleanly';
  }

  if (recommendedZone === 'front') {
    return 'Lean into the front and stay light';
  }

  if (recommendedZone === 'center') {
    return 'Anchor the center and ride the motion';
  }

  return 'Keep moving and read the opening';
}

function getActionDetail(
  input: SessionFeedbackInput,
  dangerState: SessionDangerState,
  recommendedZone: PlayerZone,
  dangerScore: number,
): string {
  if (dangerState === 'removed') {
    return 'You have been carried out of the active pit lane.';
  }

  const zoneText = `The next readable lane is the ${getZoneLabel(recommendedZone).toLowerCase()} zone.`;

  if (dangerState === 'critical') {
    return `${zoneText} The room is at maximum pressure, so protect your footing first.`;
  }

  if (input.frame.section === 'breakdown') {
    return `${zoneText} The breakdown is hot enough to reward bracing before movement.`;
  }

  if (input.frame.section === 'side-to-side prep') {
    return `${zoneText} The room is splitting, so cross with the lateral pull.`;
  }

  if (dangerScore < 38) {
    return `${zoneText} The room is readable, so you can choose position before the next hit.`;
  }

  return `${zoneText} Keep your footing and follow the crowd's pressure curve.`;
}

function buildZoneFeedback(
  zone: PlayerZone,
  pressure: number,
  currentZone: PlayerZone,
  recommendedZone: PlayerZone,
): SessionZoneFeedback {
  const pressureLabel = getZonePressureLabel(pressure);

  return {
    label: getZoneLabel(zone),
    pressure,
    pressureLabel,
    state: getZoneState(pressure),
    cue: getZoneCue(zone, pressure, recommendedZone),
    isCurrentZone: zone === currentZone,
    isRecommendedZone: zone === recommendedZone,
  };
}

function getZonePressureLabel(pressure: number): SessionZoneFeedback['pressureLabel'] {
  if (pressure >= 82) {
    return 'Crushing';
  }

  if (pressure >= 60) {
    return 'Hot';
  }

  if (pressure >= 35) {
    return 'Active';
  }

  return 'Open';
}

export function deriveSessionFeedback(input: SessionFeedbackInput): SessionFeedback {
  const dangerScore = getDangerScore(input);
  const dangerState = getDangerState(input, dangerScore);
  const recommendedZone = getRecommendedZone(input, dangerState);
  const zoneFeedback = {
    front: buildZoneFeedback('front', getZonePressure(input.crowd.front), input.player.zone, recommendedZone),
    center: buildZoneFeedback('center', getZonePressure(input.crowd.center), input.player.zone, recommendedZone),
    edge: buildZoneFeedback('edge', getZonePressure(input.crowd.edge), input.player.zone, recommendedZone),
    side: buildZoneFeedback('side', getZonePressure(input.crowd.side), input.player.zone, recommendedZone),
  } satisfies Record<PlayerZone, SessionZoneFeedback>;

  return {
    section: {
      kind: input.frame.section,
      label: getSectionLabel(input.frame.section),
      detail: getSectionDetail(input.frame.section),
    },
    danger: {
      state: dangerState,
      label: getDangerLabel(dangerState),
      detail:
        dangerState === 'removed'
          ? 'The player is no longer standing in the active pit.'
          : dangerState === 'critical'
            ? 'The pit is at its heaviest and the room is collapsing inward.'
            : dangerState === 'high'
              ? 'The pit is pressing hard and movement windows are tight.'
              : dangerState === 'building'
                ? 'Pressure is climbing and the next section will matter.'
                : 'The room is readable and the next opening is easy to spot.',
      score: dangerScore,
    },
    mission: {
      kind: input.currentMission,
      label: getMissionLabel(input.currentMission),
      detail: getMissionDetail(input.currentMission),
    },
    action: {
      label: getActionLabel(input, dangerState, recommendedZone),
      detail: getActionDetail(input, dangerState, recommendedZone, dangerScore),
      recommendedZone,
    },
    player: {
      condition:
        dangerState === 'removed'
          ? 'Removed from the pit'
          : input.player.status === 'down'
            ? 'Down'
            : input.player.balance >= 70
              ? 'Stable'
              : input.player.balance >= 35
                ? 'Wobbling'
                : 'Barely standing',
      detail:
        dangerState === 'removed'
          ? 'The set has pushed you out of the active floor.'
          : input.player.status === 'down'
            ? 'You are down and need room to recover.'
            : input.player.balance >= 70
              ? 'You have enough balance to keep reading the room.'
              : input.player.balance >= 35
                ? 'Your footing is slipping and the next hit will matter.'
                : 'One bad hit can take you out.',
      stamina: input.player.stamina,
      balance: input.player.balance,
      respect: input.player.respect,
    },
    zones: zoneFeedback,
  };
}
