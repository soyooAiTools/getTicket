import type { SongProfile } from '../domain/song-profile';

const beatMs = 60_000 / 180;

export const authoredSongProfile: SongProfile = {
  id: 'venue-basement-fixture',
  title: 'Basement Eruption',
  durationMs: 96_000,
  bpm: 180,
  beatGridMs: Array.from({ length: 288 }, (_, index) => Math.round(index * beatMs)),
  sections: [
    { kind: 'gather', startMs: 0, endMs: 12_000, confidence: 1, chaos: 0.2 },
    { kind: 'push', startMs: 12_000, endMs: 34_000, confidence: 1, chaos: 0.42 },
    { kind: 'two-step', startMs: 34_000, endMs: 49_000, confidence: 1, chaos: 0.58 },
    { kind: 'side-to-side prep', startMs: 49_000, endMs: 59_000, confidence: 1, chaos: 0.66 },
    { kind: 'breakdown', startMs: 59_000, endMs: 74_000, confidence: 1, chaos: 0.94 },
    { kind: 'recovery', startMs: 74_000, endMs: 96_000, confidence: 1, chaos: 0.38 },
  ],
  impacts: [
    { atMs: 34_000, strength: 'accent' },
    { atMs: 49_000, strength: 'accent' },
    { atMs: 59_000, strength: 'drop' },
    { atMs: 67_000, strength: 'accent' },
  ],
};
