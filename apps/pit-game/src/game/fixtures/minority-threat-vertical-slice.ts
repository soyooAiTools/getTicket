import type { SongProfile } from '../domain/song-profile';
import { createSliceImpact, type VerticalSliceFixture } from '../domain/vertical-slice';

const beatMs = 60_000 / 176;

const profile: SongProfile = {
  id: 'minority-threat-slice',
  title: 'Minority Threat',
  durationMs: 30_000,
  bpm: 176,
  beatGridMs: Array.from({ length: 89 }, (_, index) => Math.round(index * beatMs)),
  sections: [
    { kind: 'push', startMs: 0, endMs: 5_000, confidence: 1, chaos: 0.46 },
    { kind: 'side-to-side prep', startMs: 5_000, endMs: 9_000, confidence: 1, chaos: 0.72 },
    { kind: 'breakdown', startMs: 9_000, endMs: 24_000, confidence: 1, chaos: 0.98 },
    { kind: 'recovery', startMs: 24_000, endMs: 30_000, confidence: 1, chaos: 0.42 },
  ],
  impacts: [
    createSliceImpact('crowd-build', 3_000),
    createSliceImpact('lateral-surge', 7_500),
    createSliceImpact('breakdown-hit', 9_000),
    createSliceImpact('breakdown-hit', 15_000),
    createSliceImpact('aftershock-drop', 24_000),
  ],
};

export const minorityThreatVerticalSlice: VerticalSliceFixture = {
  id: 'minority-threat-vertical-slice',
  label: 'Minority Threat Vertical Slice',
  audio: {
    artist: 'Minority Unit',
    title: 'Minority Threat',
    fileName: 'Minority Unit - Minority Threat.mp3',
    localPath: 'C:/Users/Nick/Desktop/Minority Unit - Minority Threat.mp3',
    segmentStartMs: 46_000,
    segmentEndMs: 76_000,
  },
  profile,
  phases: [
    { kind: 'tension-in', startMs: 0, endMs: 6_000, intensity: 0.44 },
    { kind: 'breakdown-peak', startMs: 6_000, endMs: 24_000, intensity: 1 },
    { kind: 'aftershock', startMs: 24_000, endMs: 30_000, intensity: 0.5 },
  ],
  events: [
    { atMs: 3_000, kind: 'crowd-build', strength: 0.58 },
    { atMs: 7_500, kind: 'lateral-surge', strength: 0.82 },
    { atMs: 9_000, kind: 'breakdown-hit', strength: 1 },
    { atMs: 15_000, kind: 'breakdown-hit', strength: 0.92 },
    { atMs: 24_000, kind: 'aftershock-drop', strength: 0.64 },
  ],
};
