import type { AnalysisDraft } from '../domain/analysis-draft';
import type {
  ImpactMarker,
  ImpactStrength,
  SectionKind,
  SongProfile,
  SongSection,
} from '../domain/song-profile';
import type {
  ReviewedProfileDraft,
  ReviewedProfileReviewState,
} from '../persistence/song-profile-storage';
import { buildPreviewWindow, type PreviewWindow } from './preview-window';

export type ReviewState = 'suggested' | 'accepted' | 'modified' | 'user-added';

export interface AuthoredSection extends SongSection {
  reviewState: ReviewState;
  sourceIndex: number | null;
}

export interface AuthoredImpact extends ImpactMarker {
  reviewState: ReviewState;
  source: 'profile' | 'candidate' | 'user';
}

interface ReviewDraft extends AnalysisDraft {
  title: string;
}

export interface ReviewSession {
  draft: ReviewDraft;
  name: string;
  overlay: {
    sections: AuthoredSection[];
    impacts: AuthoredImpact[];
  };
  overrides: ReviewedProfileReviewState;
  selection:
    | { kind: 'section'; index: number }
    | { kind: 'impact'; index: number }
    | null;
  loopRange: PreviewWindow | null;
  audioSource: { name: string; objectUrl: string } | null;
}

function clampChaos(value: number): number {
  return Math.max(0, Math.min(1, Number(value.toFixed(2))));
}

function snapMsToBeat(beatGridMs: number[], atMs: number): number {
  return beatGridMs.reduce(
    (closest, beat) => (Math.abs(beat - atMs) < Math.abs(closest - atMs) ? beat : closest),
    beatGridMs[0] ?? 0,
  );
}

function cloneSection(section: AuthoredSection): AuthoredSection {
  return { ...section };
}

function cloneImpact(impact: AuthoredImpact): AuthoredImpact {
  return { ...impact };
}

function isStorageCompatibleImpact(impact: ImpactMarker): impact is ImpactMarker & { strength: 'accent' | 'drop' } {
  return impact.strength === 'accent' || impact.strength === 'drop';
}

function toPlayableImpacts(session: ReviewSession): ImpactMarker[] {
  return session.overlay.impacts
    .filter((impact) => impact.reviewState !== 'suggested')
    .map(({ reviewState, source, ...impact }) => impact);
}

function toReviewDraft(draftOrProfile: AnalysisDraft | SongProfile): ReviewDraft {
  if ('sourceTitle' in draftOrProfile) {
    return {
      ...draftOrProfile,
      title: draftOrProfile.profile.title,
    };
  }

  return {
    id: draftOrProfile.id,
    sourceTitle: draftOrProfile.title,
    title: draftOrProfile.title,
    profile: draftOrProfile,
    sectionSuggestions: [],
    impactCandidates: [],
    warnings: [],
  };
}

function createOverlayFromDraft(
  draft: ReviewDraft,
  overrides?: Partial<ReviewedProfileReviewState>,
): ReviewSession['overlay'] {
  const sections = draft.profile.sections.map<AuthoredSection>((section, index) => ({
    ...section,
    kind: overrides?.sectionKinds?.[index] ?? section.kind,
    chaos: overrides?.sectionChaos?.[index] ?? section.chaos,
    confidence: overrides?.reviewedSections?.[index] ? 1 : section.confidence,
    reviewState: overrides?.reviewedSections?.[index] ? 'accepted' : 'suggested',
    sourceIndex: index,
  }));
  const impacts = [
    ...draft.profile.impacts.map<AuthoredImpact>((impact) => ({
      ...impact,
      reviewState: 'accepted',
      source: 'profile',
    })),
    ...draft.impactCandidates.map<AuthoredImpact>((impact) => ({
      atMs: impact.atMs,
      strength: impact.strength,
      reviewState: 'suggested',
      source: 'candidate',
    })),
  ].sort((left, right) => left.atMs - right.atMs);

  return { sections, impacts };
}

function buildOverridesFromOverlay(session: Pick<ReviewSession, 'draft' | 'overlay'>): ReviewedProfileReviewState {
  const sectionKinds: Record<number, SectionKind> = {};
  const sectionChaos: Record<number, number> = {};
  const reviewedSections: Record<number, true> = {};

  session.overlay.sections.forEach((section, index) => {
    const sourceSection = section.sourceIndex === null ? null : session.draft.profile.sections[section.sourceIndex];

    if (sourceSection && sourceSection.kind !== section.kind) {
      sectionKinds[index] = section.kind;
    }

    if (sourceSection && sourceSection.chaos !== section.chaos) {
      sectionChaos[index] = section.chaos;
    }

    if (section.reviewState !== 'suggested') {
      reviewedSections[index] = true;
    }
  });

  return {
    sectionKinds,
    sectionChaos,
    reviewedSections,
  };
}

function withUpdatedOverlay(
  session: ReviewSession,
  overlay: ReviewSession['overlay'],
): ReviewSession {
  return {
    ...session,
    overlay,
    overrides: buildOverridesFromOverlay({
      draft: session.draft,
      overlay,
    }),
    selection: null,
    loopRange: null,
  };
}

export function createReviewSession(
  draft: AnalysisDraft,
  audioSource?: ReviewSession['audioSource'],
): ReviewSession;
export function createReviewSession(
  profile: SongProfile,
  name?: string,
  overrides?: Partial<ReviewedProfileReviewState>,
): ReviewSession;
export function createReviewSession(
  draftOrProfile: AnalysisDraft | SongProfile,
  secondArg?: ReviewSession['audioSource'] | string,
  thirdArg?: Partial<ReviewedProfileReviewState>,
): ReviewSession {
  const draft = toReviewDraft(draftOrProfile);
  const isAudioSource = typeof secondArg === 'object' && secondArg !== null && 'objectUrl' in secondArg;
  const audioSource = isAudioSource ? secondArg : null;
  const name = typeof secondArg === 'string' ? secondArg : draft.profile.title;
  const overrides = typeof secondArg === 'string' ? thirdArg : undefined;

  return {
    draft,
    name,
    overlay: createOverlayFromDraft(draft, overrides),
    overrides: overrides
      ? {
          sectionKinds: { ...(overrides.sectionKinds ?? {}) },
          sectionChaos: { ...(overrides.sectionChaos ?? {}) },
          reviewedSections: { ...(overrides.reviewedSections ?? {}) },
        }
      : { sectionKinds: {}, sectionChaos: {}, reviewedSections: {} },
    selection: null,
    loopRange: null,
    audioSource,
  };
}

export function moveSectionBoundary(
  session: ReviewSession,
  index: number,
  edge: 'start' | 'end',
  nextMs: number,
): ReviewSession {
  const snapped = snapMsToBeat(session.draft.profile.beatGridMs, nextMs);
  const sections = session.overlay.sections.map(cloneSection);
  const current = sections[index];
  const previous = sections[index - 1];
  const following = sections[index + 1];

  if (!current) {
    return session;
  }

  if (edge === 'end' && following) {
    if (snapped <= current.startMs || snapped >= following.endMs) {
      return session;
    }
    current.endMs = snapped;
    current.reviewState = 'modified';
    following.startMs = snapped;
    following.reviewState = 'modified';
  }

  if (edge === 'start' && previous) {
    if (snapped <= previous.startMs || snapped >= current.endMs) {
      return session;
    }
    current.startMs = snapped;
    current.reviewState = 'modified';
    previous.endMs = snapped;
    previous.reviewState = 'modified';
  }

  return withUpdatedOverlay(session, {
    ...session.overlay,
    sections,
  });
}

export function splitSectionAtBeat(session: ReviewSession, index: number, atMs: number): ReviewSession {
  const sections = session.overlay.sections.map(cloneSection);
  const current = sections[index];

  if (!current) {
    return session;
  }

  const splitAt = snapMsToBeat(session.draft.profile.beatGridMs, atMs);
  if (splitAt <= current.startMs || splitAt >= current.endMs) {
    return session;
  }

  const head: AuthoredSection = {
    ...current,
    endMs: splitAt,
    reviewState: 'modified',
  };
  const tail: AuthoredSection = {
    ...current,
    startMs: splitAt,
    reviewState: 'modified',
    sourceIndex: null,
  };
  sections.splice(index, 1, head, tail);

  return withUpdatedOverlay(session, {
    ...session.overlay,
    sections,
  });
}

export function mergeSectionForward(session: ReviewSession, index: number): ReviewSession {
  const sections = session.overlay.sections.map(cloneSection);
  const current = sections[index];
  const following = sections[index + 1];

  if (!current || !following || current.kind !== following.kind) {
    return session;
  }

  sections.splice(index, 2, {
    ...current,
    endMs: following.endMs,
    chaos: Number(((current.chaos + following.chaos) / 2).toFixed(2)),
    confidence: Math.max(current.confidence, following.confidence),
    reviewState: 'modified',
    sourceIndex: null,
  });

  return withUpdatedOverlay(session, {
    ...session.overlay,
    sections,
  });
}

export function addImpactMarker(
  session: ReviewSession,
  impact: { atMs: number; strength: ImpactStrength },
): ReviewSession {
  const atMs = snapMsToBeat(session.draft.profile.beatGridMs, impact.atMs);

  return withUpdatedOverlay(session, {
    ...session.overlay,
    impacts: [
      ...session.overlay.impacts.map(cloneImpact),
      {
        atMs,
        strength: impact.strength,
        reviewState: 'user-added' as const,
        source: 'user' as const,
      },
    ].sort((left, right) => left.atMs - right.atMs),
  });
}

export function getAuthoringWarnings(session: ReviewSession): string[] {
  const warnings: string[] = [];

  session.overlay.sections.forEach((section, index) => {
    const next = session.overlay.sections[index + 1];
    if (next && section.endMs !== next.startMs) {
      warnings.push(`section-gap-${index}`);
    }

    if (section.kind === 'recovery') {
      const dropsInside = session.overlay.impacts.filter(
        (impact) =>
          impact.strength === 'drop' &&
          impact.atMs >= section.startMs &&
          impact.atMs < section.endMs,
      );
      if (dropsInside.length > 0) {
        warnings.push(`recovery-drop-${index}`);
      }
    }
  });

  return warnings;
}

export function getLowConfidenceSections(session: ReviewSession) {
  return session.overlay.sections
    .map((section, index) => ({ section, index }))
    .filter(({ section }) => section.confidence < 0.7 && section.reviewState === 'suggested');
}

export function applySectionOverride(
  session: ReviewSession,
  index: number,
  kind: SectionKind,
): ReviewSession {
  const sections = session.overlay.sections.map((section, sectionIndex) =>
    sectionIndex === index
      ? {
          ...section,
          kind,
          reviewState: 'modified' as const,
        }
      : cloneSection(section),
  );

  return withUpdatedOverlay(session, {
    ...session.overlay,
    sections,
  });
}

export function setSectionChaos(session: ReviewSession, index: number, chaos: number): ReviewSession {
  const sections = session.overlay.sections.map((section, sectionIndex) =>
    sectionIndex === index
      ? {
          ...section,
          chaos: clampChaos(chaos),
          reviewState: 'modified' as const,
        }
      : cloneSection(section),
  );

  return withUpdatedOverlay(session, {
    ...session.overlay,
    sections,
  });
}

export function acceptSectionReview(session: ReviewSession, index: number): ReviewSession {
  const sections = session.overlay.sections.map((section, sectionIndex) =>
    sectionIndex === index
      ? {
          ...section,
          confidence: 1,
          reviewState: 'accepted' as const,
        }
      : cloneSection(section),
  );

  return withUpdatedOverlay(session, {
    ...session.overlay,
    sections,
  });
}

export function selectSection(session: ReviewSession, index: number): ReviewSession {
  const section = session.overlay.sections[index];

  if (!section) {
    return session;
  }

  return {
    ...session,
    selection: { kind: 'section', index },
    loopRange: buildPreviewWindow(session.draft.profile, {
      startMs: section.startMs,
      endMs: section.endMs,
    }),
  };
}

export function selectImpact(session: ReviewSession, index: number): ReviewSession {
  const impact = session.overlay.impacts[index];

  if (!impact) {
    return session;
  }

  return {
    ...session,
    selection: { kind: 'impact', index },
    loopRange: buildPreviewWindow(session.draft.profile, {
      startMs: Math.max(0, impact.atMs - 1_500),
      endMs: Math.min(session.draft.profile.durationMs, impact.atMs + 1_500),
    }),
  };
}

export function buildPlayableProfile(session: ReviewSession): SongProfile {
  return {
    ...session.draft.profile,
    title: session.name.trim() || session.draft.profile.title,
    sections: session.overlay.sections.map(({ reviewState, sourceIndex, ...section }) => section),
    impacts: toPlayableImpacts(session),
  };
}

export function buildReviewedProfileDraft(session: ReviewSession): ReviewedProfileDraft {
  return {
    name: session.name.trim() || session.draft.profile.title,
    sourceTitle: session.draft.sourceTitle,
    profile: {
      ...buildPlayableProfile(session),
      impacts: toPlayableImpacts(session).filter(isStorageCompatibleImpact),
    },
    review: buildOverridesFromOverlay(session),
  };
}

export function setReviewName(session: ReviewSession, name: string): ReviewSession {
  return {
    ...session,
    name,
  };
}
