import type { ShowFrame } from './show-director';

export type PlayerZone = 'center' | 'edge' | 'front' | 'side';
export type PlayerAction = 'idle' | 'two-step' | 'shove' | 'slip' | 'brace' | 'lift';

export interface PlayerInput {
  action: PlayerAction;
  targetZone: PlayerZone;
}

export interface PlayerState {
  zone: PlayerZone;
  stamina: number;
  balance: number;
  respect: number;
  status: 'upright' | 'down';
}

const actionStaminaLossPerSecond: Record<PlayerAction, number> = {
  idle: 8,
  'two-step': 32,
  shove: 24,
  slip: 20,
  brace: 16,
  lift: 28,
};

const actionPressurePerSecond: Partial<Record<PlayerAction, number>> = {
  'two-step': 16,
  shove: 8,
  lift: 6,
};

const braceMitigationPerSecond = 24;
const slipBonusPerSecond = 20;
const breakthroughRespectPerSecond = 24;
const standardRespectPerSecond = 4;
const liftRespectPerSecond = 32;

function getRespectRate(action: PlayerAction, frame: ShowFrame): number {
  if (action === 'lift') {
    return liftRespectPerSecond;
  }

  if (action === 'two-step' && frame.actionWeights.twoStep > 0.8) {
    return breakthroughRespectPerSecond;
  }

  return standardRespectPerSecond;
}

export function createPlayerState(): PlayerState {
  return {
    zone: 'edge',
    stamina: 100,
    balance: 100,
    respect: 0,
    status: 'upright',
  };
}

export function reducePlayerState(
  state: PlayerState,
  input: PlayerInput,
  frame: ShowFrame,
  dtMs: number,
): PlayerState {
  const seconds = dtMs / 1_000;
  const chaosPressure = frame.chaos * 20 * seconds;
  const breakdownPressure = frame.section === 'breakdown' ? 48 * seconds : 0;
  const braceMitigation = input.action === 'brace' ? braceMitigationPerSecond * seconds : 0;
  const actionPressure = (actionPressurePerSecond[input.action] ?? 0) * seconds;
  const slipBonus = input.action === 'slip' && frame.section === 'side-to-side prep' ? slipBonusPerSecond * seconds : 0;
  const balanceLoss = Math.max(0, chaosPressure + breakdownPressure + actionPressure - braceMitigation - slipBonus);
  const respectDelta = getRespectRate(input.action, frame) * seconds;
  const balance = Math.max(0, state.balance - balanceLoss);

  return {
    zone: input.targetZone,
    stamina: Math.max(0, state.stamina - actionStaminaLossPerSecond[input.action] * seconds),
    balance,
    respect: state.respect + respectDelta,
    status: balance === 0 ? 'down' : 'upright',
  };
}
