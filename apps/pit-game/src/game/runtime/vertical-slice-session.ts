import type { VerticalSliceFixture } from '../domain/vertical-slice';
import { createVerticalSliceFrame, type VerticalSliceFrame } from '../domain/vertical-slice-director';

export type VerticalSliceZone = 'front' | 'center' | 'edge' | 'side';
export type VerticalSliceAction = 'idle' | 'move' | 'shove' | 'brace' | 'slip';

export interface VerticalSliceInput {
  action: VerticalSliceAction;
  targetZone: VerticalSliceZone;
}

export interface VerticalSlicePlayerState {
  zone: VerticalSliceZone;
  stamina: number;
  balance: number;
  pose: 'move' | 'shove' | 'brace' | 'slip' | 'stagger' | 'fall';
  status: 'upright' | 'staggered' | 'down';
}

export interface VerticalSliceSummary {
  label: 'Survived' | 'Dropped';
  downCount: number;
  hitWindows: number;
}

export interface VerticalSliceSession {
  fixture: VerticalSliceFixture;
  elapsedMs: number;
  frame: VerticalSliceFrame;
  player: VerticalSlicePlayerState;
  failed: boolean;
  completed: boolean;
  summary: VerticalSliceSummary | null;
  downCount: number;
  hitWindows: number;
}

function createVerticalSlicePlayerState(): VerticalSlicePlayerState {
  return {
    zone: 'edge',
    stamina: 100,
    balance: 100,
    pose: 'move',
    status: 'upright',
  };
}

function resolveMitigationPerSecond(action: VerticalSliceAction): number {
  switch (action) {
    case 'brace':
      return 18;
    case 'slip':
      return 14;
    case 'shove':
      return 8;
    default:
      return 0;
  }
}

function matchesRecommendedAction(frame: VerticalSliceFrame, action: VerticalSliceAction): boolean {
  return frame.recommendedAction === action;
}

function resolvePlayerPose(
  action: VerticalSliceAction,
  balance: number,
): Pick<VerticalSlicePlayerState, 'pose' | 'status'> {
  if (balance === 0) {
    return { pose: 'fall', status: 'down' };
  }

  if (balance <= 18) {
    return { pose: 'stagger', status: 'staggered' };
  }

  if (action === 'brace' || action === 'slip' || action === 'shove') {
    return { pose: action, status: 'upright' };
  }

  return { pose: 'move', status: 'upright' };
}

export function createVerticalSliceSession(fixture: VerticalSliceFixture): VerticalSliceSession {
  return {
    fixture,
    elapsedMs: 0,
    frame: createVerticalSliceFrame(fixture, 0),
    player: createVerticalSlicePlayerState(),
    failed: false,
    completed: false,
    summary: null,
    downCount: 0,
    hitWindows: 0,
  };
}

export function stepVerticalSliceSession(
  session: VerticalSliceSession,
  input: VerticalSliceInput,
  dtMs: number,
): VerticalSliceSession {
  if (session.failed || session.completed) {
    return session;
  }

  const remainingMs = session.fixture.profile.durationMs - session.elapsedMs;
  const safeDtMs = Math.min(dtMs, remainingMs);

  if (safeDtMs <= 0) {
    return session;
  }

  const elapsedMs = session.elapsedMs + safeDtMs;
  const frameAtMs = Math.min(elapsedMs, session.fixture.profile.durationMs - 1);
  const frame = createVerticalSliceFrame(session.fixture, frameAtMs);
  const seconds = safeDtMs / 1_000;
  const pressure = frame.zonePressure[input.targetZone] * seconds * 0.32;
  const mitigation = resolveMitigationPerSecond(input.action) * seconds;
  const staminaDrainPerSecond = input.action === 'idle' ? 8 : 16;
  const balance = Math.max(0, session.player.balance - Math.max(0, pressure - mitigation));
  const stamina = Math.max(0, session.player.stamina - staminaDrainPerSecond * seconds);
  const failed = balance === 0;
  const completed = !failed && elapsedMs >= session.fixture.profile.durationMs;
  const hitWindows = session.hitWindows + (matchesRecommendedAction(frame, input.action) ? 1 : 0);
  const downCount = session.downCount + (failed ? 1 : 0);
  const playerFeedback = resolvePlayerPose(input.action, balance);

  return {
    ...session,
    elapsedMs,
    frame,
    player: {
      zone: input.targetZone,
      stamina,
      balance,
      pose: playerFeedback.pose,
      status: playerFeedback.status,
    },
    failed,
    completed,
    summary:
      failed || completed
        ? {
            label: failed ? 'Dropped' : 'Survived',
            downCount,
            hitWindows,
          }
        : null,
    downCount,
    hitWindows,
  };
}
