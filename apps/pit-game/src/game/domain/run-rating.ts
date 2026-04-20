export type RunAxisId = 'survival' | 'rhythm' | 'presence' | 'respect';
export type RunLabel = 'Crowd Meat' | 'Held Ground' | 'Pit Regular' | 'Real One';

export interface RunRatingAxis {
  label: string;
  detail: string;
  score: number;
}

export interface RunRatingInput {
  completed: boolean;
  failed: boolean;
  durationMs: number;
  elapsedMs: number;
  finalBalance: number;
  finalRespect: number;
  finalStamina: number;
  downEvents: number;
  liftCount: number;
  missionAlignedMs: number;
  recommendedZoneMs: number;
  rhythmMatchMs: number;
  rhythmOpportunityMs: number;
}

export interface RunRating {
  completed: boolean;
  failed: boolean;
  label: RunLabel;
  score: number;
  summary: string;
  axes: Record<RunAxisId, RunRatingAxis>;
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function getRatio(numerator: number, denominator: number): number {
  if (denominator <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(1, numerator / denominator));
}

function buildSurvivalAxis(input: RunRatingInput): RunRatingAxis {
  const progress = getRatio(input.elapsedMs, input.durationMs);
  const balanceSafety = getRatio(input.finalBalance, 100);
  const staminaSafety = getRatio(input.finalStamina, 100);
  const score = clampScore(
    progress * 72 + (input.completed ? 24 : 0) + balanceSafety * 8 + staminaSafety * 6 - input.downEvents * 10 - (input.failed ? 20 : 0),
  );

  return {
    score,
    label: score >= 85 ? 'Crowd-proof' : score >= 60 ? 'Holding' : score >= 35 ? 'Shaken' : 'Fell early',
    detail:
      score >= 85
        ? 'You stayed upright through the full set.'
        : score >= 60
          ? 'You lasted through the pit pressure and kept moving.'
          : score >= 35
            ? 'You made a run of it, but the floor kept asking for more.'
            : 'The room took you out before the set settled.',
  };
}

function buildRhythmAxis(input: RunRatingInput): RunRatingAxis {
  const ratio = getRatio(input.rhythmMatchMs, input.rhythmOpportunityMs);
  const score = clampScore(ratio * 88 + (input.completed ? 10 : 0) - input.downEvents * 6);

  return {
    score,
    label: score >= 85 ? 'On the pulse' : score >= 60 ? 'In the pocket' : score >= 35 ? 'Finding time' : 'Off-time',
    detail:
      score >= 85
        ? 'Your movement kept locking to the groove.'
        : score >= 60
          ? 'You were reading the beat instead of fighting it.'
          : score >= 35
            ? 'You found a few clean windows, but not enough to settle in.'
            : 'The set kept moving faster than your feet could track.',
  };
}

function buildPresenceAxis(input: RunRatingInput): RunRatingAxis {
  const elapsedRatio = getRatio(input.elapsedMs, input.durationMs);
  const zoneRatio = getRatio(input.recommendedZoneMs, input.elapsedMs);
  const missionRatio = getRatio(input.missionAlignedMs, input.elapsedMs);
  const score = clampScore(zoneRatio * 58 + missionRatio * 34 + (input.completed ? 8 : 0) - input.downEvents * 5 + elapsedRatio * 4);

  return {
    score,
    label: score >= 85 ? 'Owns the floor' : score >= 60 ? 'Holding the floor' : score >= 35 ? 'In the room' : 'At the edge',
    detail:
      score >= 85
        ? 'You stayed in the right part of the room and shaped the lane.'
        : score >= 60
          ? 'You were present where the pit wanted you.'
          : score >= 35
            ? 'You touched the right openings, but not for long.'
            : 'You spent more time getting moved than moving the room.',
  };
}

function buildRespectAxis(input: RunRatingInput): RunRatingAxis {
  const score = clampScore(input.finalRespect * 0.65 + input.liftCount * 10 + (input.completed ? 6 : 0) - input.downEvents * 8);

  return {
    score,
    label: score >= 85 ? 'Real one' : score >= 60 ? 'Known' : score >= 35 ? 'Noticed' : 'Green',
    detail:
      score >= 85
        ? 'You earned room-wide respect by the end of the set.'
        : score >= 60
          ? 'You left the room knowing who you were.'
          : score >= 35
            ? 'You made enough good decisions to be remembered.'
            : 'The crowd never really had time to know your name.',
  };
}

function getTotalScore(axes: Record<RunAxisId, RunRatingAxis>): number {
  return clampScore(axes.survival.score * 0.35 + axes.rhythm.score * 0.25 + axes.presence.score * 0.2 + axes.respect.score * 0.2);
}

function getLabel(completed: boolean, failed: boolean, score: number): RunLabel {
  if (failed) {
    return score >= 52 ? 'Held Ground' : 'Crowd Meat';
  }

  if (completed && score >= 86) {
    return 'Real One';
  }

  if (score >= 66) {
    return 'Pit Regular';
  }

  if (score >= 40) {
    return 'Held Ground';
  }

  return 'Crowd Meat';
}

function getSummary(label: RunLabel, input: RunRatingInput): string {
  if (input.failed) {
    return label === 'Crowd Meat'
      ? 'The pit carried you out before the set could settle.'
      : 'You held your lane deep into the set, but the room still carried you out.';
  }

  if (input.completed) {
    return label === 'Real One'
      ? 'You finished the set clean and earned the room.'
      : 'You finished the set and held your lane.';
  }

  return 'The run ended before the set was complete.';
}

export function rateRun(input: RunRatingInput): RunRating {
  const axes = {
    survival: buildSurvivalAxis(input),
    rhythm: buildRhythmAxis(input),
    presence: buildPresenceAxis(input),
    respect: buildRespectAxis(input),
  } satisfies Record<RunAxisId, RunRatingAxis>;
  const score = getTotalScore(axes);
  const label = getLabel(input.completed, input.failed, score);

  return {
    completed: input.completed,
    failed: input.failed,
    label,
    score,
    summary: getSummary(label, input),
    axes,
  };
}
