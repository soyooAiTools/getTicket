import { findSectionAtMs, type SectionKind, type SongProfile } from './song-profile';

export interface ShowFrame {
  section: SectionKind;
  chaos: number;
  crowdPreset: {
    centerDensity: number;
    edgeDensity: number;
    centerFlow: 'hold' | 'split' | 'collapse' | 'surge';
  };
  actionWeights: {
    twoStep: number;
    shove: number;
    slip: number;
    brace: number;
    lift: number;
  };
  missionPool: Array<'survive-window' | 'center-hold' | 'help-fallen' | 'cross-line'>;
  cameraPreset: 'steady' | 'tense' | 'impact';
}

const presetMap: Record<SectionKind, Omit<ShowFrame, 'section'>> = {
  gather: {
    chaos: 0.2,
    crowdPreset: { centerDensity: 0.35, edgeDensity: 0.18, centerFlow: 'hold' },
    actionWeights: { twoStep: 0.2, shove: 0.25, slip: 0.2, brace: 0.2, lift: 0.1 },
    missionPool: ['survive-window'],
    cameraPreset: 'steady',
  },
  push: {
    chaos: 0.45,
    crowdPreset: { centerDensity: 0.52, edgeDensity: 0.24, centerFlow: 'surge' },
    actionWeights: { twoStep: 0.35, shove: 0.42, slip: 0.32, brace: 0.28, lift: 0.12 },
    missionPool: ['survive-window', 'center-hold'],
    cameraPreset: 'tense',
  },
  'two-step': {
    chaos: 0.58,
    crowdPreset: { centerDensity: 0.5, edgeDensity: 0.24, centerFlow: 'hold' },
    actionWeights: { twoStep: 0.92, shove: 0.38, slip: 0.35, brace: 0.24, lift: 0.14 },
    missionPool: ['survive-window', 'center-hold'],
    cameraPreset: 'tense',
  },
  'side-to-side prep': {
    chaos: 0.66,
    crowdPreset: { centerDensity: 0.22, edgeDensity: 0.38, centerFlow: 'split' },
    actionWeights: { twoStep: 0.35, shove: 0.3, slip: 0.84, brace: 0.4, lift: 0.16 },
    missionPool: ['cross-line', 'survive-window'],
    cameraPreset: 'tense',
  },
  breakdown: {
    chaos: 0.94,
    crowdPreset: { centerDensity: 0.88, edgeDensity: 0.48, centerFlow: 'collapse' },
    actionWeights: { twoStep: 0.4, shove: 0.5, slip: 0.78, brace: 0.96, lift: 0.42 },
    missionPool: ['center-hold', 'help-fallen', 'survive-window'],
    cameraPreset: 'impact',
  },
  recovery: {
    chaos: 0.38,
    crowdPreset: { centerDensity: 0.32, edgeDensity: 0.2, centerFlow: 'hold' },
    actionWeights: { twoStep: 0.3, shove: 0.18, slip: 0.28, brace: 0.22, lift: 0.88 },
    missionPool: ['help-fallen', 'survive-window'],
    cameraPreset: 'steady',
  },
};

export function createShowFrame(profile: SongProfile, atMs: number): ShowFrame {
  const section = findSectionAtMs(profile, atMs) ?? profile.sections[profile.sections.length - 1];
  return {
    section: section.kind,
    ...presetMap[section.kind],
  };
}
