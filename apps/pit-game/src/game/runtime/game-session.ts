import { advanceCrowdState, createCrowdState, type CrowdState } from '../domain/crowd-state';
import { createPlayerState, reducePlayerState, type PlayerInput, type PlayerState } from '../domain/player-state';
import { createShowFrame, type ShowFrame } from '../domain/show-director';
import { findSectionAtMs, type SongProfile } from '../domain/song-profile';

export interface GameSession {
  profile: SongProfile;
  elapsedMs: number;
  frame: ShowFrame;
  crowd: CrowdState;
  player: PlayerState;
  currentMission: 'survive-window' | 'center-hold' | 'help-fallen' | 'cross-line';
  failed: boolean;
}

export function createGameSession(profile: SongProfile, elapsedMs = 0): GameSession {
  const frame = createShowFrame(profile, elapsedMs);

  return {
    profile,
    elapsedMs,
    frame,
    crowd: createCrowdState(frame),
    player: createPlayerState(),
    currentMission: frame.missionPool[0],
    failed: false,
  };
}

function stepGameSessionSlice(session: GameSession, input: PlayerInput, dtMs: number): GameSession {
  const elapsedMs = session.elapsedMs + dtMs;
  const inputFrame = session.frame;
  const frame = createShowFrame(session.profile, elapsedMs);
  const crowd = advanceCrowdState(session.crowd, inputFrame, dtMs);
  const player = reducePlayerState(session.player, input, inputFrame, dtMs);

  return {
    ...session,
    elapsedMs,
    frame,
    crowd,
    player,
    currentMission: frame.missionPool[0],
    failed: session.failed || player.status === 'down',
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
