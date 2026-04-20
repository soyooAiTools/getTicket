import type { PlayerInput } from '../domain/player-state';
import type { SongProfile } from '../domain/song-profile';
import { createGameSession, stepGameSession, type GameSession } from './game-session';

export interface RuntimeController {
  subscribe(listener: (session: GameSession) => void): () => void;
  getSnapshot(): GameSession;
  step(input: PlayerInput, dtMs: number): void;
  reset(profile: SongProfile, elapsedMs?: number, previewEndMs?: number | null): void;
}

function getLastPlayableMs(profile: SongProfile, previewEndMs: number | null): number {
  const playbackEndMs =
    previewEndMs === null ? profile.durationMs : Math.min(profile.durationMs, previewEndMs);
  return Math.max(0, playbackEndMs - 1);
}

export function createRuntimeController(profile: SongProfile, elapsedMs = 0): RuntimeController {
  let snapshot = createGameSession(profile, elapsedMs);
  const listeners = new Set<(session: GameSession) => void>();
  let previewEndMs: number | null = null;

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
      if (snapshot.result) {
        return;
      }

      const lastPlayableMs = getLastPlayableMs(snapshot.profile, previewEndMs);
      const remainingMs = lastPlayableMs - snapshot.elapsedMs;
      const safeDtMs = Math.min(dtMs, remainingMs);

      if (safeDtMs <= 0) {
        return;
      }

      snapshot = stepGameSession(snapshot, input, safeDtMs);
      publish();
    },
    reset(nextProfile, nextElapsedMs = 0, nextPreviewEndMs = null) {
      previewEndMs = nextPreviewEndMs;
      snapshot = createGameSession(nextProfile, nextElapsedMs);
      publish();
    },
  };
}
