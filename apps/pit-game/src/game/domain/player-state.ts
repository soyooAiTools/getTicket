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

const actionStaminaLoss: Record<PlayerAction, number> = {
  idle: 2,
  'two-step': 8,
  shove: 6,
  slip: 5,
  brace: 4,
  lift: 7,
};

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
  const pace = frame.chaos * 20 * seconds;
  const breakdownPressure = frame.section === 'breakdown' ? 12 : 0;
  const braceMitigation = input.action === 'brace' ? 6 : 0;
  const actionPressure = input.action === 'two-step' ? 4 : input.action === 'shove' ? 2 : input.action === 'lift' ? 1.5 : 0;
  const balanceLoss = Math.max(1, pace + breakdownPressure + actionPressure - braceMitigation);
  const respectDelta = input.action === 'two-step' && frame.actionWeights.twoStep > 0.8 ? 6 : input.action === 'lift' ? 8 : 1;
  const balance = Math.max(0, state.balance - balanceLoss);

  return {
    zone: input.targetZone,
    stamina: Math.max(0, state.stamina - actionStaminaLoss[input.action]),
    balance,
    respect: state.respect + respectDelta,
    status: balance === 0 ? 'down' : 'upright',
  };
}
