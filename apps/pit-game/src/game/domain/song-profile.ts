export type SectionKind =
  | 'gather'
  | 'push'
  | 'two-step'
  | 'side-to-side prep'
  | 'breakdown'
  | 'recovery';

export interface SongSection {
  kind: SectionKind;
  startMs: number;
  endMs: number;
  confidence: number;
  chaos: number;
}

export interface ImpactMarker {
  atMs: number;
  strength: 'accent' | 'drop';
}

export interface SongProfile {
  id: string;
  title: string;
  durationMs: number;
  bpm: number;
  beatGridMs: number[];
  sections: SongSection[];
  impacts: ImpactMarker[];
}

export function validateSongProfile(profile: SongProfile): string[] {
  const errors: string[] = [];

  if (profile.sections.length === 0) {
    errors.push('profile has no sections');
  }

  for (let index = 0; index < profile.sections.length; index += 1) {
    const current = profile.sections[index];
    const previous = profile.sections[index - 1];

    if (current.startMs >= current.endMs) {
      errors.push(`section ${index} has a non-positive range`);
    }

    if (previous && previous.endMs > current.startMs) {
      errors.push(`section ${index} overlaps section ${index - 1}`);
    }
  }

  return errors;
}

export function findSectionAtMs(profile: SongProfile, atMs: number): SongSection | undefined {
  return profile.sections.find((section) => atMs >= section.startMs && atMs < section.endMs);
}
