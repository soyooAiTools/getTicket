import { advanceCrowdState, createCrowdState, type CrowdState } from '../domain/crowd-state';
import { createPlayerState, reducePlayerState, type PlayerInput, type PlayerState } from '../domain/player-state';
import { deriveSessionFeedback, type SessionFeedback, type SessionMission } from '../domain/session-feedback';
import { rateRun, type RunRating } from '../domain/run-rating';
import { createShowFrame, type ShowFrame } from '../domain/show-director';
import { findSectionAtMs, type SongProfile } from '../domain/song-profile';

export interface GameSessionStats {
  downEvents: number;
  liftCount: number;
  missionAlignedMs: number;
  recommendedZoneMs: number;
  rhythmMatchMs: number;
  rhythmOpportunityMs: number;
}

export interface GameSession {
  profile: SongProfile;
  elapsedMs: number;
  frame: ShowFrame;
  crowd: CrowdState;
  player: PlayerState;
  currentMission: SessionMission;
  failed: boolean;
  completed: boolean;
  result: RunRating | null;
  stats: GameSessionStats;
  feedback: SessionFeedback;
}

function createGameSessionStats(): GameSessionStats {
  return {
    downEvents: 0,
    liftCount: 0,
    missionAlignedMs: 0,
    recommendedZoneMs: 0,
    rhythmMatchMs: 0,
    rhythmOpportunityMs: 0,
  };
}

function isRhythmMatch(frame: ShowFrame, input: PlayerInput): boolean {
  switch (frame.section) {
    case 'gather':
    case 'push':
      return input.action === 'shove';
    case 'two-step':
      return input.action === 'two-step';
    case 'side-to-side prep':
      return input.action === 'slip';
    case 'breakdown':
      return input.action === 'brace' || input.action === 'lift';
    case 'recovery':
      return input.action === 'lift';
  }
}

function isMissionAligned(
  mission: SessionMission,
  player: PlayerState,
  input: PlayerInput,
): boolean {
  switch (mission) {
    case 'survive-window':
      return player.status === 'upright' && player.balance > 30;
    case 'center-hold':
      return player.zone === 'center' && player.balance > 35;
    case 'help-fallen':
      return input.action === 'lift';
    case 'cross-line':
      return player.zone === 'side' || input.action === 'slip';
  }
}

function buildRunResult(session: GameSession, player: PlayerState, completed: boolean): RunRating {
  return rateRun({
    completed,
    failed: session.failed,
    durationMs: session.profile.durationMs,
    elapsedMs: session.elapsedMs,
    finalBalance: player.balance,
    finalRespect: player.respect,
    finalStamina: player.stamina,
    downEvents: session.stats.downEvents,
    liftCount: session.stats.liftCount,
    missionAlignedMs: session.stats.missionAlignedMs,
    recommendedZoneMs: session.stats.recommendedZoneMs,
    rhythmMatchMs: session.stats.rhythmMatchMs,
    rhythmOpportunityMs: session.stats.rhythmOpportunityMs,
  });
}

export function createGameSession(profile: SongProfile, elapsedMs = 0): GameSession {
  const safeElapsedMs = Math.min(Math.max(0, elapsedMs), profile.durationMs - 1);
  const frame = createShowFrame(profile, safeElapsedMs);
  const crowd = createCrowdState(frame);
  const player = createPlayerState();
  const currentMission = frame.missionPool[0];
  const failed = false;

  return {
    profile,
    elapsedMs: safeElapsedMs,
    frame,
    crowd,
    player,
    currentMission,
    failed,
    completed: false,
    result: null,
    stats: createGameSessionStats(),
    feedback: deriveSessionFeedback({
      frame,
      crowd,
      player,
      currentMission,
      failed,
    }),
  };
}

function stepGameSessionSlice(session: GameSession, input: PlayerInput, dtMs: number): GameSession {
  if (session.result) {
    return session;
  }

  const elapsedMs = Math.min(session.profile.durationMs - 1, session.elapsedMs + dtMs);
  const inputFrame = session.frame;
  const frame = createShowFrame(session.profile, elapsedMs);
  const crowd = advanceCrowdState(session.crowd, inputFrame, dtMs);
  const player = reducePlayerState(session.player, input, inputFrame, dtMs);
  const currentMission = frame.missionPool[0];
  const failed = session.failed || player.status === 'down';
  const feedback = deriveSessionFeedback({
    frame,
    crowd,
    player,
    currentMission,
    failed,
  });
  const stats: GameSessionStats = {
    ...session.stats,
    rhythmOpportunityMs: session.stats.rhythmOpportunityMs + dtMs,
    rhythmMatchMs: session.stats.rhythmMatchMs + (isRhythmMatch(frame, input) ? dtMs : 0),
    recommendedZoneMs: session.stats.recommendedZoneMs + (player.zone === feedback.action.recommendedZone ? dtMs : 0),
    missionAlignedMs: session.stats.missionAlignedMs + (isMissionAligned(currentMission, player, input) ? dtMs : 0),
    downEvents: session.stats.downEvents + (session.player.status === 'upright' && player.status === 'down' ? 1 : 0),
    liftCount: session.stats.liftCount + (input.action === 'lift' ? 1 : 0),
  };
  const completed = !failed && elapsedMs >= session.profile.durationMs - 1;
  const result = session.result ?? (failed || completed ? buildRunResult({ ...session, elapsedMs, failed, stats }, player, completed) : null);

  return {
    ...session,
    elapsedMs,
    frame,
    crowd,
    player,
    currentMission,
    failed,
    completed,
    result,
    stats,
    feedback,
  };
}

export function stepGameSession(session: GameSession, input: PlayerInput, dtMs: number): GameSession {
  if (session.result) {
    return session;
  }

  let current = session;
  let remainingMs = dtMs;

  while (remainingMs > 0) {
    const section = findSectionAtMs(current.profile, current.elapsedMs);
    if (!section) {
      throw new Error(`No section found for timestamp ${current.elapsedMs}`);
    }

    const sliceMs = Math.min(remainingMs, section.endMs - current.elapsedMs);
    current = stepGameSessionSlice(current, input, sliceMs);
    remainingMs -= sliceMs;

    if (current.result) {
      break;
    }
  }

  return current;
}
