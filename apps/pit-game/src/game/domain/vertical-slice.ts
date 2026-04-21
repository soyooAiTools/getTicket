import { validateSongProfile, type ImpactMarker, type SongProfile } from './song-profile';

export type VerticalSlicePhaseKind =
  | 'walk-in-pressure'
  | 'build'
  | 'breakdown-peak'
  | 'aftershock';
export type VerticalSliceEventKind = 'crowd-build' | 'lateral-surge' | 'breakdown-hit' | 'aftershock-drop';
export type VerticalSliceDangerKind = 'push' | 'surge' | 'crush' | 'aftershock';
export type VerticalSliceRecommendedAction = 'move' | 'brace' | 'slip' | 'shove';
export type VerticalSliceCameraCue = 'follow' | 'pressure' | 'impact' | 'down';
export type VerticalSliceLightCue = 'room' | 'build' | 'hit' | 'aftershock';

export interface VerticalSliceAudioSource {
  artist: string;
  title: string;
  fileName: string;
  localPath: string;
  segmentStartMs: number;
  segmentEndMs: number;
}

export interface VerticalSlicePhase {
  kind: VerticalSlicePhaseKind;
  startMs: number;
  endMs: number;
  intensity: number;
}

export interface VerticalSliceEvent {
  atMs: number;
  kind: VerticalSliceEventKind;
  strength: number;
}

export interface VerticalSliceFrame {
  phase: VerticalSlicePhase;
  event: VerticalSliceEvent | null;
  dangerKind: VerticalSliceDangerKind;
  recommendedAction: VerticalSliceRecommendedAction;
  cameraCue: VerticalSliceCameraCue;
  lightCue: VerticalSliceLightCue;
  zonePressure: {
    front: number;
    center: number;
    edge: number;
    side: number;
  };
}

export interface VerticalSliceFixture {
  id: string;
  label: string;
  audio: VerticalSliceAudioSource;
  profile: SongProfile;
  phases: VerticalSlicePhase[];
  events: VerticalSliceEvent[];
}

export function createSliceImpact(kind: VerticalSliceEventKind, atMs: number): ImpactMarker {
  return {
    atMs,
    strength: kind === 'breakdown-hit' ? 'drop' : kind === 'aftershock-drop' ? 'accent' : 'hit',
  };
}

function isNormalizedValue(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

export function validateVerticalSliceFixture(fixture: VerticalSliceFixture): string[] {
  const errors: string[] = [];
  const durationMs = fixture.profile.durationMs;

  if (fixture.phases.length === 0) {
    errors.push('slice has no phases');
  } else {
    if (fixture.phases[0]?.startMs !== 0) {
      errors.push('first phase must start at 0');
    }

    if (fixture.phases[fixture.phases.length - 1]?.endMs !== fixture.profile.durationMs) {
      errors.push('last phase must end at the slice duration');
    }

    for (let index = 0; index < fixture.phases.length; index += 1) {
      const current = fixture.phases[index];
      const previous = fixture.phases[index - 1];

      if (!current) {
        continue;
      }

      if (current.startMs < 0 || current.startMs > durationMs) {
        errors.push(`phase ${index} starts outside the slice duration`);
      }

      if (current.endMs < 0 || current.endMs > durationMs) {
        errors.push(`phase ${index} ends outside the slice duration`);
      }

      if (current.startMs >= current.endMs) {
        errors.push(`phase ${index} has a non-positive range`);
      }

      if (!isNormalizedValue(current.intensity)) {
        errors.push(`phase ${index} has an invalid intensity`);
      }

      if (previous && previous.endMs !== current.startMs) {
        errors.push(`phase ${index} must start when phase ${index - 1} ends`);
      }
    }
  }

  for (let index = 0; index < fixture.events.length; index += 1) {
    const event = fixture.events[index];

    if (!event) {
      continue;
    }

    if (event.atMs < 0 || event.atMs >= durationMs) {
      errors.push(`event ${index} occurs outside the slice duration`);
    }

    if (!isNormalizedValue(event.strength)) {
      errors.push(`event ${index} has an invalid strength`);
    }
  }

  if (
    fixture.audio.segmentStartMs < 0 ||
    fixture.audio.segmentEndMs < 0 ||
    fixture.audio.segmentEndMs <= fixture.audio.segmentStartMs
  ) {
    errors.push('audio segment boundaries are invalid');
  }

  if (fixture.audio.segmentEndMs - fixture.audio.segmentStartMs !== durationMs) {
    errors.push('audio segment duration must match the slice duration');
  }

  if (fixture.events.length === 0) {
    errors.push('slice must contain authored events');
  }

  if (fixture.events.length !== fixture.profile.impacts.length) {
    errors.push('fixture events and profile impacts must stay aligned');
  } else {
    for (let index = 0; index < fixture.events.length; index += 1) {
      const event = fixture.events[index];
      const impact = fixture.profile.impacts[index];

      if (!event || !impact) {
        continue;
      }

      const expectedImpact = createSliceImpact(event.kind, event.atMs);

      if (impact.atMs !== expectedImpact.atMs || impact.strength !== expectedImpact.strength) {
        errors.push(`fixture event ${index} does not match profile impact ${index}`);
      }
    }
  }

  errors.push(...validateSongProfile(fixture.profile).map((error) => `profile: ${error}`));

  return errors;
}
