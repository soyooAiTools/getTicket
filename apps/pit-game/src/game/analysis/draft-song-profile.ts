import { createAnalysisDraft, type AnalysisDraft } from '../domain/analysis-draft';
import { validateSongProfile, type SongProfile, type SongSection } from '../domain/song-profile';

export interface AnalysisInput {
  title: string;
  durationMs: number;
  bpm: number;
  beatGridMs: number[];
  energyFrames: Array<{ atMs: number; rms: number }>;
  impactMoments: number[];
}

const targetSectionCount = 12;
const minimumSectionMs = 4_000;

function sortImpactMoments(impactMoments: number[]) {
  return [...impactMoments].sort((left, right) => left - right);
}

function getSectionKind(normalized: number): SongSection['kind'] {
  return normalized > 0.82
    ? 'breakdown'
    : normalized > 0.64
      ? 'side-to-side prep'
      : normalized > 0.48
        ? 'two-step'
        : normalized > 0.24
          ? 'push'
          : 'gather';
}

function buildCoarseFrames(input: AnalysisInput) {
  const sortedFrames = [...input.energyFrames].sort((left, right) => left.atMs - right.atMs);
  if (sortedFrames.length === 0) {
    return [];
  }

  const coarseWindowCount = Math.max(1, Math.ceil(input.durationMs / minimumSectionMs));
  const frameDensity = sortedFrames.length / coarseWindowCount;
  const denseSectionTargetCount = frameDensity >= 6 ? 8 : targetSectionCount;
  const sectionMs = Math.max(minimumSectionMs, Math.ceil(input.durationMs / denseSectionTargetCount));
  const bucketCount = Math.max(1, Math.ceil(input.durationMs / sectionMs));
  const buckets = Array.from({ length: bucketCount }, () => ({ sum: 0, count: 0 }));

  for (const frame of sortedFrames) {
    const bucketIndex = Math.min(bucketCount - 1, Math.floor(frame.atMs / sectionMs));
    buckets[bucketIndex].sum += frame.rms;
    buckets[bucketIndex].count += 1;
  }

  let fallbackRms = sortedFrames[0].rms;
  return buckets.map((bucket, index) => {
    const averageRms = bucket.count > 0 ? bucket.sum / bucket.count : fallbackRms;
    fallbackRms = averageRms;

    return {
      atMs: index * sectionMs,
      endMs: Math.min(input.durationMs, (index + 1) * sectionMs),
      rms: averageRms,
    };
  });
}

export function buildDraftSongProfile(input: AnalysisInput): SongProfile {
  const coarseFrames = buildCoarseFrames(input);
  const sortedImpactMoments = sortImpactMoments(input.impactMoments);
  const maxEnergy = Math.max(...coarseFrames.map((frame) => frame.rms), 0.01);

  const sections = coarseFrames.reduce<SongSection[]>((result, frame) => {
    const normalized = frame.rms / maxEnergy;
    const nextSection: SongSection = {
      kind: getSectionKind(normalized),
      startMs: frame.atMs,
      endMs: frame.endMs,
      confidence: normalized > 0.8 || normalized < 0.25 ? 0.88 : 0.58,
      chaos: Number(normalized.toFixed(2)),
    };

    const previous = result[result.length - 1];
    if (previous?.kind === nextSection.kind) {
      previous.endMs = nextSection.endMs;
      previous.chaos = Number(((previous.chaos + nextSection.chaos) / 2).toFixed(2));
      previous.confidence = Math.max(previous.confidence, nextSection.confidence);
      return result;
    }

    result.push(nextSection);
    return result;
  }, []);

  if (sections.length > 0) {
    sections[sections.length - 1] = {
      ...sections[sections.length - 1],
      kind: 'recovery',
      endMs: input.durationMs,
      confidence: 0.72,
    };
  }

  const impacts: SongProfile['impacts'] = sortedImpactMoments.map<SongProfile['impacts'][number]>((atMs, index) => ({
    atMs,
    strength: index === sortedImpactMoments.length - 1 ? 'drop' : 'accent',
  }));

  return {
    id: input.title.toLowerCase().replace(/\s+/g, '-'),
    title: input.title,
    durationMs: input.durationMs,
    bpm: input.bpm,
    beatGridMs: input.beatGridMs,
    sections,
    impacts,
  };
}

export function buildAnalysisDraft(input: AnalysisInput): AnalysisDraft {
  const profile = buildDraftSongProfile(input);
  const sortedImpactMoments = sortImpactMoments(input.impactMoments);
  const impactCandidates: AnalysisDraft['impactCandidates'] = sortedImpactMoments.map<AnalysisDraft['impactCandidates'][number]>((atMs, index, all) => {
    const isLast = index === all.length - 1;
    const isPenultimate = all.length >= 3 && index === all.length - 2;

    return {
      atMs,
      strength: isLast ? 'hit' : isPenultimate ? 'drop' : 'accent',
      confidence: isLast ? 0.81 : isPenultimate ? 0.69 : 0.62,
      reasons: isLast
        ? ['terminal transient cluster']
        : isPenultimate
          ? ['trailing impact valley']
          : ['energy spike'],
    };
  });

  return createAnalysisDraft({
    id: profile.id,
    sourceTitle: input.title,
    profile,
    sectionSuggestions: profile.sections.map((section, index) => ({
      index,
      confidence: section.confidence,
      reasons: section.chaos > 0.8 ? ['peak energy bucket'] : ['coarse energy bucket'],
    })),
    impactCandidates,
    warnings: profile.sections
      .map((section, index) => ({ section, index }))
      .filter(({ section }) => section.confidence < 0.7)
      .map(({ index }) => `low-confidence section ${index}`),
  });
}

export function buildValidatedDraftSongProfile(input: AnalysisInput): SongProfile {
  const profile = buildDraftSongProfile(input);
  const [validationError] = validateSongProfile(profile);

  if (validationError) {
    throw new Error(validationError);
  }

  return profile;
}
