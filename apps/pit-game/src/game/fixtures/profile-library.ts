import type { SongProfile, SongSection } from '../domain/song-profile';

export interface SampleProfileEntry {
  id: string;
  name: string;
  description: string;
  profile: SongProfile;
}

const beatMsFromBpm = (bpm: number) => 60_000 / bpm;

function createBeatGrid(bpm: number, durationMs: number): number[] {
  const beatMs = beatMsFromBpm(bpm);
  return Array.from({ length: Math.floor(durationMs / beatMs) }, (_, index) => Math.round(index * beatMs));
}

function createSection(
  kind: SongSection['kind'],
  startMs: number,
  endMs: number,
  chaos: number,
  confidence = 1,
): SongSection {
  return {
    kind,
    startMs,
    endMs,
    chaos,
    confidence,
  };
}

function createSampleProfile(
  id: string,
  title: string,
  bpm: number,
  durationMs: number,
  sections: SongSection[],
  impacts: SongProfile['impacts'],
): SongProfile {
  return {
    id,
    title,
    durationMs,
    bpm,
    beatGridMs: createBeatGrid(bpm, durationMs),
    sections,
    impacts,
  };
}

export const sampleProfileLibrary: SampleProfileEntry[] = [
  {
    id: 'basement-surge',
    name: 'Basement Surge',
    description: 'Fast center pressure that opens into one clean breakdown.',
    profile: createSampleProfile(
      'basement-surge',
      'Basement Surge',
      180,
      92_000,
      [
        createSection('gather', 0, 10_000, 0.18),
        createSection('push', 10_000, 28_000, 0.42),
        createSection('two-step', 28_000, 42_000, 0.57),
        createSection('side-to-side prep', 42_000, 53_000, 0.68),
        createSection('breakdown', 53_000, 67_000, 0.94),
        createSection('recovery', 67_000, 92_000, 0.36),
      ],
      [
        { atMs: 28_000, strength: 'accent' },
        { atMs: 42_000, strength: 'accent' },
        { atMs: 53_000, strength: 'drop' },
        { atMs: 61_000, strength: 'accent' },
      ],
    ),
  },
  {
    id: 'crowd-relay',
    name: 'Crowd Relay',
    description: 'A wider groove with a mid-song side-to-side swing.',
    profile: createSampleProfile(
      'crowd-relay',
      'Crowd Relay',
      172,
      84_000,
      [
        createSection('gather', 0, 8_000, 0.2),
        createSection('push', 8_000, 20_000, 0.38),
        createSection('two-step', 20_000, 36_000, 0.54),
        createSection('push', 36_000, 48_000, 0.45),
        createSection('side-to-side prep', 48_000, 60_000, 0.66),
        createSection('breakdown', 60_000, 72_000, 0.91),
        createSection('recovery', 72_000, 84_000, 0.32),
      ],
      [
        { atMs: 20_000, strength: 'accent' },
        { atMs: 48_000, strength: 'accent' },
        { atMs: 60_000, strength: 'drop' },
        { atMs: 68_000, strength: 'accent' },
      ],
    ),
  },
  {
    id: 'heat-sink',
    name: 'Heat Sink',
    description: 'Shorter, denser pressure with a second punch before the exit.',
    profile: createSampleProfile(
      'heat-sink',
      'Heat Sink',
      192,
      76_000,
      [
        createSection('gather', 0, 6_000, 0.16),
        createSection('push', 6_000, 18_000, 0.41),
        createSection('breakdown', 18_000, 32_000, 0.9),
        createSection('two-step', 32_000, 46_000, 0.56),
        createSection('side-to-side prep', 46_000, 56_000, 0.69),
        createSection('breakdown', 56_000, 68_000, 0.93),
        createSection('recovery', 68_000, 76_000, 0.34),
      ],
      [
        { atMs: 18_000, strength: 'drop' },
        { atMs: 32_000, strength: 'accent' },
        { atMs: 56_000, strength: 'drop' },
        { atMs: 68_000, strength: 'accent' },
      ],
    ),
  },
];
