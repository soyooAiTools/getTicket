import type { ImpactMarker, SongProfile } from './song-profile';

export type VerticalSlicePhaseKind = 'tension-in' | 'breakdown-peak' | 'aftershock';
export type VerticalSliceEventKind = 'crowd-build' | 'lateral-surge' | 'breakdown-hit' | 'aftershock-drop';

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

export function validateVerticalSliceFixture(fixture: VerticalSliceFixture): string[] {
  const errors: string[] = [];

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

      if (current.startMs >= current.endMs) {
        errors.push(`phase ${index} has a non-positive range`);
      }

      if (previous && previous.endMs !== current.startMs) {
        errors.push(`phase ${index} must start when phase ${index - 1} ends`);
      }
    }
  }

  if (fixture.audio.segmentEndMs - fixture.audio.segmentStartMs !== fixture.profile.durationMs) {
    errors.push('audio segment duration must match the slice duration');
  }

  if (fixture.events.length === 0) {
    errors.push('slice must contain authored events');
  }

  return errors;
}
