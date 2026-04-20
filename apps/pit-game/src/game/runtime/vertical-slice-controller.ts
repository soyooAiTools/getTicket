import type { VerticalSliceFixture } from '../domain/vertical-slice';
import {
  createVerticalSliceSession,
  stepVerticalSliceSession,
  type VerticalSliceInput,
  type VerticalSliceSession,
} from './vertical-slice-session';

export interface VerticalSliceController {
  subscribe(listener: (session: VerticalSliceSession) => void): () => void;
  getSnapshot(): VerticalSliceSession;
  step(input: VerticalSliceInput, dtMs: number): void;
  reset(): void;
}

export function createVerticalSliceController(fixture: VerticalSliceFixture): VerticalSliceController {
  let snapshot = createVerticalSliceSession(fixture);
  const listeners = new Set<(session: VerticalSliceSession) => void>();

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
      const nextSnapshot = stepVerticalSliceSession(snapshot, input, dtMs);

      if (nextSnapshot === snapshot) {
        return;
      }

      snapshot = nextSnapshot;
      publish();
    },
    reset() {
      snapshot = createVerticalSliceSession(fixture);
      publish();
    },
  };
}
