import type {
  VerticalSliceCameraCue,
  VerticalSliceEvent,
  VerticalSliceFixture,
  VerticalSliceFrame,
  VerticalSliceLightCue,
  VerticalSliceRecommendedAction,
} from './vertical-slice';

export type SliceRecommendedAction = VerticalSliceRecommendedAction;
export type SliceCameraCue = VerticalSliceCameraCue;
export type SliceLightCue = VerticalSliceLightCue;
export type { VerticalSliceFrame } from './vertical-slice';

const ACTIVE_EVENT_WINDOW_MS = 250;

function findPhase(fixture: VerticalSliceFixture, atMs: number) {
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

  if (phase.kind === 'walk-in-pressure') {
    return {
      phase,
      event,
      dangerKind: 'push',
      recommendedAction: 'move',
      cameraCue: 'follow',
      lightCue: 'room',
      zonePressure: { front: 42, center: 48, edge: 22, side: 28 },
    };
  }

  if (phase.kind === 'build') {
    return {
      phase,
      event,
      dangerKind: event?.kind === 'lateral-surge' ? 'surge' : 'push',
      recommendedAction: event?.kind === 'lateral-surge' ? 'slip' : 'move',
      cameraCue: event?.kind === 'lateral-surge' ? 'pressure' : 'follow',
      lightCue: 'build',
      zonePressure: { front: 62, center: 72, edge: 38, side: 58 },
    };
  }

  if (phase.kind === 'breakdown-peak') {
    return {
      phase,
      event,
      dangerKind: 'crush',
      recommendedAction: event?.kind === 'breakdown-hit' ? 'brace' : 'shove',
      cameraCue: event?.kind === 'breakdown-hit' ? 'impact' : 'pressure',
      lightCue: event?.kind === 'breakdown-hit' ? 'hit' : 'build',
      zonePressure: { front: 86, center: 100, edge: 68, side: 76 },
    };
  }

  return {
    phase,
    event,
    dangerKind: 'aftershock',
    recommendedAction: 'shove',
    cameraCue: 'follow',
    lightCue: 'aftershock',
    zonePressure: { front: 48, center: 58, edge: 30, side: 36 },
  };
}

export function getVerticalSliceWindowKey(frame: VerticalSliceFrame): string {
  if (frame.event) {
    return `event:${frame.event.kind}:${frame.event.atMs}`;
  }

  return `phase:${frame.phase.kind}:${frame.phase.startMs}:${frame.phase.endMs}`;
}
