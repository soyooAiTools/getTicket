import { advanceCrowdState, createCrowdState, type CrowdState } from '../domain/crowd-state';
import { createPlayerState, reducePlayerState, type PlayerInput, type PlayerState } from '../domain/player-state';
import { deriveSessionFeedback, type SessionFeedback, type SessionMission } from '../domain/session-feedback';
import { createShowFrame, type ShowFrame } from '../domain/show-director';
import { findSectionAtMs, type SongProfile } from '../domain/song-profile';

export interface GameSession {
  profile: SongProfile;
  elapsedMs: number;
  frame: ShowFrame;
  crowd: CrowdState;
  player: PlayerState;
  currentMission: SessionMission;
  failed: boolean;
  feedback: SessionFeedback;
}

export function createGameSession(profile: SongProfile, elapsedMs = 0): GameSession {
  const frame = createShowFrame(profile, elapsedMs);
  const crowd = createCrowdState(frame);
  const player = createPlayerState();
  const currentMission = frame.missionPool[0];
  const failed = false;

  return {
    profile,
    elapsedMs,
    frame,
    crowd,
    player,
    currentMission,
    failed,
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
  const elapsedMs = session.elapsedMs + dtMs;
  const inputFrame = session.frame;
  const frame = createShowFrame(session.profile, elapsedMs);
  const crowd = advanceCrowdState(session.crowd, inputFrame, dtMs);
  const player = reducePlayerState(session.player, input, inputFrame, dtMs);
  const currentMission = frame.missionPool[0];
  const failed = session.failed || player.status === 'down';

  return {
    ...session,
    elapsedMs,
    frame,
    crowd,
    player,
    currentMission,
    failed,
    feedback: deriveSessionFeedback({
      frame,
      crowd,
      player,
      currentMission,
      failed,
    }),
  };
}

export function stepGameSession(session: GameSession, input: PlayerInput, dtMs: number): GameSession {
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
  }

  return current;
}
