import type { VerticalSliceFixture } from '../domain/vertical-slice';
import {
  completeVerticalSliceSession,
  createVerticalSliceSession,
  stepVerticalSliceSession,
  type VerticalSliceInput,
  type VerticalSliceSession,
} from './vertical-slice-session';

export interface VerticalSliceController {
  subscribe(listener: (session: VerticalSliceSession) => void): () => void;
  getSnapshot(): VerticalSliceSession;
  step(input: VerticalSliceInput, dtMs: number): void;
  start(): void;
  pause(): void;
  complete(): void;
  isRunning(): boolean;
  reset(): void;
}

export function createVerticalSliceController(fixture: VerticalSliceFixture): VerticalSliceController {
  let snapshot = createVerticalSliceSession(fixture);
  let running = false;
  let latestInput: VerticalSliceInput = { action: 'idle', targetZone: snapshot.player.zone };
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
      if (!running) {
        return;
      }

      latestInput = input;
      const nextSnapshot = stepVerticalSliceSession(snapshot, input, dtMs);

      if (nextSnapshot === snapshot) {
        return;
      }

      snapshot = nextSnapshot;
      if (snapshot.failed || snapshot.completed) {
        running = false;
      }
      publish();
    },
    start() {
      if (running || snapshot.failed || snapshot.completed) {
        return;
      }

      running = true;
      publish();
    },
    pause() {
      if (!running) {
        return;
      }

      running = false;
      publish();
    },
    complete() {
      snapshot = completeVerticalSliceSession(snapshot, latestInput);
      running = false;
      publish();
    },
    isRunning() {
      return running;
    },
    reset() {
      snapshot = createVerticalSliceSession(fixture);
      running = false;
      latestInput = { action: 'idle', targetZone: snapshot.player.zone };
      publish();
    },
  };
}
