import { advanceCrowdState, createCrowdState, type CrowdState } from '../domain/crowd-state';
import { createPlayerState, reducePlayerState, type PlayerInput, type PlayerState } from '../domain/player-state';
import { createShowFrame, type ShowFrame } from '../domain/show-director';
import type { SongProfile } from '../domain/song-profile';

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

export function stepGameSession(session: GameSession, input: PlayerInput, dtMs: number): GameSession {
  const elapsedMs = session.elapsedMs + dtMs;
  const frame = createShowFrame(session.profile, elapsedMs);
  const crowd = advanceCrowdState(session.crowd, frame, dtMs);
  const player = reducePlayerState(session.player, input, frame, dtMs);

  return {
    ...session,
    elapsedMs,
    frame,
    crowd,
    player,
    currentMission: frame.missionPool[0],
    failed: player.status === 'down',
  };
}
