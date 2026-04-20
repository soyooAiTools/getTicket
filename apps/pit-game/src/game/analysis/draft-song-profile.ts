import { validateSongProfile, type SongProfile, type SongSection } from '../domain/song-profile';

export interface AnalysisInput {
  title: string;
  durationMs: number;
  bpm: number;
  beatGridMs: number[];
  energyFrames: Array<{ atMs: number; rms: number }>;
  impactMoments: number[];
}

export function buildDraftSongProfile(input: AnalysisInput): SongProfile {
  const sortedFrames = [...input.energyFrames].sort((left, right) => left.atMs - right.atMs);
  const maxEnergy = Math.max(...sortedFrames.map((frame) => frame.rms), 0.01);

  const sections: SongSection[] = sortedFrames.map((frame, index) => {
    const next = sortedFrames[index + 1];
    const normalized = frame.rms / maxEnergy;
    const kind =
      normalized > 0.82
        ? 'breakdown'
        : normalized > 0.64
          ? 'side-to-side prep'
          : normalized > 0.48
            ? 'two-step'
            : normalized > 0.24
              ? 'push'
              : 'gather';

    return {
      kind,
      startMs: frame.atMs,
      endMs: next?.atMs ?? input.durationMs,
      confidence: normalized > 0.8 || normalized < 0.25 ? 0.88 : 0.58,
      chaos: Number(normalized.toFixed(2)),
    };
  });

  if (sections.length > 0) {
    sections[sections.length - 1] = {
      ...sections[sections.length - 1],
      kind: 'recovery',
      endMs: input.durationMs,
      confidence: 0.72,
    };
  }

  return {
    id: input.title.toLowerCase().replace(/\s+/g, '-'),
    title: input.title,
    durationMs: input.durationMs,
    bpm: input.bpm,
    beatGridMs: input.beatGridMs,
    sections,
    impacts: input.impactMoments.map((atMs, index) => ({
      atMs,
      strength: index === input.impactMoments.length - 1 ? 'drop' : 'accent',
    })),
  };
}

export function buildValidatedDraftSongProfile(input: AnalysisInput): SongProfile {
  const profile = buildDraftSongProfile(input);
  const [validationError] = validateSongProfile(profile);

  if (validationError) {
    throw new Error(validationError);
  }

  return profile;
}
