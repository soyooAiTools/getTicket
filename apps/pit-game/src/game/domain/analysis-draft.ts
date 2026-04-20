import type { ImpactStrength, SongProfile } from './song-profile';

export interface SectionSuggestion {
  index: number;
  confidence: number;
  reasons: string[];
}

export interface ImpactCandidate {
  atMs: number;
  strength: ImpactStrength;
  confidence: number;
  reasons: string[];
}

export interface AnalysisDraft {
  id: string;
  sourceTitle: string;
  profile: SongProfile;
  sectionSuggestions: SectionSuggestion[];
  impactCandidates: ImpactCandidate[];
  warnings: string[];
}

export function createAnalysisDraft(input: AnalysisDraft): AnalysisDraft {
  return {
    ...input,
    sectionSuggestions: input.sectionSuggestions.map((suggestion) => ({
      ...suggestion,
      reasons: [...suggestion.reasons],
    })),
    impactCandidates: [...input.impactCandidates]
      .map((candidate) => ({
        ...candidate,
        reasons: [...candidate.reasons],
      }))
      .sort((left, right) => left.atMs - right.atMs),
    warnings: [...input.warnings],
  };
}
