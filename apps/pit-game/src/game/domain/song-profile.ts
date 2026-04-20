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
  strength: ImpactStrength;
}

export type ImpactStrength = 'accent' | 'drop' | 'hit' | 'stop';

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
    return errors;
  }

  if (profile.sections[0]?.startMs !== 0) {
    errors.push('first section must start at 0');
  }

  const lastSection = profile.sections[profile.sections.length - 1];

  if (lastSection?.endMs !== profile.durationMs) {
    errors.push('last section must end at the song duration');
  }

  for (let index = 0; index < profile.sections.length; index += 1) {
    const current = profile.sections[index];
    const previous = profile.sections[index - 1];
    if (!current) {
      continue;
    }

    if (current.startMs < 0 || current.startMs > profile.durationMs) {
      errors.push(`section ${index} starts outside the song duration`);
    }

    if (current.endMs < 0 || current.endMs > profile.durationMs) {
      errors.push(`section ${index} ends outside the song duration`);
    }

    if (current.startMs >= current.endMs) {
      errors.push(`section ${index} has a non-positive range`);
    }

    if (previous && previous.endMs > current.startMs) {
      errors.push(`section ${index} overlaps section ${index - 1}`);
    }

    if (previous && previous.endMs < current.startMs) {
      errors.push(`section ${index} does not start when section ${index - 1} ends`);
    }
  }

  return errors;
}

export function findSectionAtMs(profile: SongProfile, atMs: number): SongSection | undefined {
  return profile.sections.find((section) => atMs >= section.startMs && atMs < section.endMs);
}
