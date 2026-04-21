import type { VerticalSliceFixture } from '../domain/vertical-slice';
import {
  createVerticalSliceFrame,
  getVerticalSliceWindowKey,
  type VerticalSliceFrame,
} from '../domain/vertical-slice-director';

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
  pose: 'move' | 'shove' | 'brace' | 'slip' | 'stagger' | 'fall' | 'recover';
  status: 'upright' | 'staggered' | 'down';
  control: 'stable' | 'stagger' | 'down';
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

const SCORED_WINDOW_KEYS = Symbol('vertical-slice-scored-window-keys');
const MAX_STEP_SLICE_MS = 100;

type VerticalSliceSessionState = VerticalSliceSession & {
  [SCORED_WINDOW_KEYS]: ReadonlySet<string>;
};

function createVerticalSlicePlayerState(): VerticalSlicePlayerState {
  return {
    zone: 'edge',
    stamina: 100,
    balance: 100,
    pose: 'move',
    status: 'upright',
    control: 'stable',
  };
}

function resolvePressureSeverity(frame: VerticalSliceFrame, zone: VerticalSliceZone) {
  const pressure = frame.zonePressure[zone];
  if (frame.dangerKind === 'crush') {
    return pressure * 0.42;
  }
  if (frame.dangerKind === 'surge') {
    return pressure * 0.34;
  }
  return pressure * 0.26;
}

function resolveMitigation(frame: VerticalSliceFrame, action: VerticalSliceAction) {
  if (frame.dangerKind === 'crush' && action === 'brace') {
    return 28;
  }
  if (frame.dangerKind === 'surge' && action === 'slip') {
    return 24;
  }
  if (action === 'shove') {
    return 10;
  }
  return action === 'move' ? 4 : 0;
}

function matchesRecommendedAction(frame: VerticalSliceFrame, action: VerticalSliceAction): boolean {
  return frame.recommendedAction === action;
}

function resolvePlayerControl(balanceLoss: number, balance: number): VerticalSlicePlayerState['control'] {
  if (balance === 0 || balance <= 20) {
    return 'down';
  }

  if (balanceLoss >= 12) {
    return 'stagger';
  }

  return 'stable';
}

function resolvePlayerPose(
  action: VerticalSliceAction,
  control: VerticalSlicePlayerState['control'],
): Pick<VerticalSlicePlayerState, 'pose' | 'status'> {
  if (control === 'down') {
    return { pose: 'fall', status: 'down' };
  }

  if (control === 'stagger') {
    if (action === 'brace' || action === 'slip' || action === 'shove') {
      return { pose: action, status: 'staggered' };
    }

    return { pose: 'stagger', status: 'staggered' };
  }

  if (action === 'brace' || action === 'slip' || action === 'shove') {
    return { pose: action, status: 'upright' };
  }

  return { pose: 'move', status: 'upright' };
}

export function createVerticalSliceSession(fixture: VerticalSliceFixture): VerticalSliceSession {
  const session: VerticalSliceSessionState = {
    fixture,
    elapsedMs: 0,
    frame: createVerticalSliceFrame(fixture, 0),
    player: createVerticalSlicePlayerState(),
    failed: false,
    completed: false,
    summary: null,
    downCount: 0,
    hitWindows: 0,
    [SCORED_WINDOW_KEYS]: new Set<string>(),
  };

  return session;
}

function getScoredWindowKeys(session: VerticalSliceSession): ReadonlySet<string> {
  return (session as VerticalSliceSessionState)[SCORED_WINDOW_KEYS] ?? new Set<string>();
}

function stepVerticalSliceSessionSlice(
  session: VerticalSliceSession,
  input: VerticalSliceInput,
  dtMs: number,
): VerticalSliceSessionState {
  const elapsedMs = session.elapsedMs + dtMs;
  const frameAtMs = Math.min(elapsedMs, session.fixture.profile.durationMs - 1);
  const frame = createVerticalSliceFrame(session.fixture, frameAtMs);
  const scoredWindowKeys = new Set(getScoredWindowKeys(session));
  const windowKey = getVerticalSliceWindowKey(frame);
  const isNewHitWindow = matchesRecommendedAction(frame, input.action) && !scoredWindowKeys.has(windowKey);

  if (isNewHitWindow) {
    scoredWindowKeys.add(windowKey);
  }

  const hitWindows = session.hitWindows + (isNewHitWindow ? 1 : 0);

  return {
    ...session,
    elapsedMs,
    frame,
    hitWindows,
    [SCORED_WINDOW_KEYS]: scoredWindowKeys,
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

  const availableMs = session.fixture.profile.durationMs - session.elapsedMs;
  const safeDtMs = Math.min(dtMs, availableMs);

  if (safeDtMs <= 0) {
    return session;
  }

  let current = session;
  let remainingMs = safeDtMs;

  while (remainingMs > 0) {
    const sliceMs = Math.min(remainingMs, MAX_STEP_SLICE_MS);
    current = stepVerticalSliceSessionSlice(current, input, sliceMs);
    remainingMs -= sliceMs;

    if (current.failed || current.completed) {
      break;
    }
  }

  const seconds = safeDtMs / 1_000;
  const pressure = resolvePressureSeverity(current.frame, input.targetZone);
  const mitigation = resolveMitigation(current.frame, input.action);
  const balanceLoss = Math.max(0, pressure - mitigation);
  const balance = Math.max(0, session.player.balance - balanceLoss);
  const staminaDrainPerSecond = input.action === 'idle' ? 8 : 16;
  const stamina = Math.max(0, session.player.stamina - staminaDrainPerSecond * seconds);
  const control = resolvePlayerControl(balanceLoss, balance);
  const playerFeedback = resolvePlayerPose(input.action, control);
  const failed = control === 'down';
  const completed = !failed && current.elapsedMs >= session.fixture.profile.durationMs;
  const downCount = current.downCount + (failed ? 1 : 0);
  const hitWindows = current.hitWindows;

  return {
    ...current,
    downCount,
    failed,
    completed,
    player: {
      zone: input.targetZone,
      stamina,
      balance,
      pose: playerFeedback.pose,
      status: playerFeedback.status,
      control,
    },
    summary:
      failed || completed
        ? {
            label: failed ? 'Dropped' : 'Survived',
            downCount,
            hitWindows,
          }
        : null,
  };
}

export function completeVerticalSliceSession(
  session: VerticalSliceSession,
  input: VerticalSliceInput = { action: 'idle', targetZone: session.player.zone },
): VerticalSliceSession {
  if (session.completed) {
    return session;
  }

  return {
    ...session,
    completed: true,
    failed: false,
    frame: session.frame,
    player: {
      ...session.player,
      zone: input.targetZone,
      pose: session.player.status === 'down' ? 'recover' : session.player.pose,
    },
    summary: {
      label: 'Survived',
      downCount: session.downCount,
      hitWindows: session.hitWindows,
    },
  };
}
