import type { VerticalSliceEvent, VerticalSliceFixture, VerticalSlicePhase } from './vertical-slice';

export type SliceRecommendedAction = 'move' | 'shove' | 'brace' | 'slip';
export type SliceCameraCue = 'steady' | 'build' | 'punch' | 'collapse';
export type SliceLightCue = 'room' | 'tension' | 'hit' | 'aftershock';

export interface VerticalSliceFrame {
  phase: VerticalSlicePhase;
  event: VerticalSliceEvent | null;
  zonePressure: {
    front: number;
    center: number;
    edge: number;
    side: number;
  };
  recommendedAction: SliceRecommendedAction;
  cameraCue: SliceCameraCue;
  lightCue: SliceLightCue;
}

const ACTIVE_EVENT_WINDOW_MS = 250;

function findPhase(fixture: VerticalSliceFixture, atMs: number): VerticalSlicePhase {
  const phase = fixture.phases.find((candidate) => atMs >= candidate.startMs && atMs < candidate.endMs);

  if (!phase) {
    throw new Error(`No slice phase found for timestamp ${atMs}`);
  }

  return phase;
}

function findActiveEvent(fixture: VerticalSliceFixture, atMs: number): VerticalSliceEvent | null {
  let activeEvent: VerticalSliceEvent | null = null;
  let smallestDistance = Number.POSITIVE_INFINITY;

  for (const event of fixture.events) {
    const distance = Math.abs(event.atMs - atMs);
    if (distance > ACTIVE_EVENT_WINDOW_MS || distance >= smallestDistance) {
      continue;
    }

    activeEvent = event;
    smallestDistance = distance;
  }

  return activeEvent;
}

export function createVerticalSliceFrame(fixture: VerticalSliceFixture, atMs: number): VerticalSliceFrame {
  const phase = findPhase(fixture, atMs);
  const event = findActiveEvent(fixture, atMs);

  if (event?.kind === 'breakdown-hit') {
    return {
      phase,
      event,
      zonePressure: { front: 88, center: 100, edge: 74, side: 78 },
      recommendedAction: 'brace',
      cameraCue: 'punch',
      lightCue: 'hit',
    };
  }

  if (phase.kind === 'tension-in') {
    return {
      phase,
      event,
      zonePressure: { front: 50, center: 58, edge: 30, side: 36 },
      recommendedAction: 'move',
      cameraCue: 'build',
      lightCue: 'tension',
    };
  }

  if (phase.kind === 'breakdown-peak') {
    const lateralSurgeActive = event?.kind === 'lateral-surge';

    return {
      phase,
      event,
      zonePressure: { front: 82, center: 92, edge: 66, side: 72 },
      recommendedAction: lateralSurgeActive ? 'slip' : 'brace',
      cameraCue: lateralSurgeActive ? 'build' : 'steady',
      lightCue: 'tension',
    };
  }

  return {
    phase,
    event,
    zonePressure: { front: 54, center: 62, edge: 34, side: 42 },
    recommendedAction: 'shove',
    cameraCue: 'steady',
    lightCue: 'aftershock',
  };
}

export function getVerticalSliceWindowKey(frame: VerticalSliceFrame): string {
  if (frame.event) {
    return `event:${frame.event.kind}:${frame.event.atMs}`;
  }

  return `phase:${frame.phase.kind}:${frame.phase.startMs}:${frame.phase.endMs}`;
}
