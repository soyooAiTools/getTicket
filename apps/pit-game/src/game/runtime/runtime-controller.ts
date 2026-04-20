import type { PlayerInput } from '../domain/player-state';
import type { SongProfile } from '../domain/song-profile';
import { createGameSession, stepGameSession, type GameSession } from './game-session';

export interface RuntimeController {
  subscribe(listener: (session: GameSession) => void): () => void;
  getSnapshot(): GameSession;
  step(input: PlayerInput, dtMs: number): void;
  reset(profile: SongProfile): void;
}

export function createRuntimeController(profile: SongProfile, elapsedMs = 0): RuntimeController {
  let snapshot = createGameSession(profile, elapsedMs);
  const listeners = new Set<(session: GameSession) => void>();

  function publish() {
    listeners.forEach((listener) => listener(snapshot));
  }

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot() {
      return snapshot;
    },
    step(input, dtMs) {
      snapshot = stepGameSession(snapshot, input, dtMs);
      publish();
    },
    reset(nextProfile) {
      snapshot = createGameSession(nextProfile);
      publish();
    },
  };
}
