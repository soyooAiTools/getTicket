import type { SectionKind, SongProfile } from '../domain/song-profile';
import type { ReviewedProfileDraft, ReviewedProfileReviewState } from '../persistence/song-profile-storage';

export interface ReviewSession {
  draft: SongProfile;
  name: string;
  overrides: {
    sectionKinds: Record<number, SectionKind>;
    sectionChaos: Record<number, number>;
    reviewedSections: Record<number, true>;
  };
}

function createEmptyOverrides(): ReviewSession['overrides'] {
  return {
    sectionKinds: {},
    sectionChaos: {},
    reviewedSections: {},
  };
}

function clampChaos(value: number): number {
  return Math.max(0, Math.min(1, Number(value.toFixed(2))));
}

function mergeOverrides(overrides?: Partial<ReviewedProfileReviewState>): ReviewSession['overrides'] {
  return {
    sectionKinds: { ...(overrides?.sectionKinds ?? {}) },
    sectionChaos: { ...(overrides?.sectionChaos ?? {}) },
    reviewedSections: { ...(overrides?.reviewedSections ?? {}) },
  };
}

export function createReviewSession(
  draft: SongProfile,
  name = draft.title,
  overrides?: Partial<ReviewedProfileReviewState>,
): ReviewSession {
  return {
    draft,
    name,
    overrides: overrides ? mergeOverrides(overrides) : createEmptyOverrides(),
  };
}

export function getLowConfidenceSections(session: ReviewSession) {
  return session.draft.sections
    .map((section, index) => ({ section, index }))
    .filter(
      ({ section, index }) =>
        section.confidence < 0.7 && session.overrides.reviewedSections[index] !== true,
    );
}

export function applySectionOverride(
  session: ReviewSession,
  index: number,
  kind: SectionKind,
): ReviewSession {
  return {
    ...session,
    overrides: {
      ...session.overrides,
      sectionKinds: {
        ...session.overrides.sectionKinds,
        [index]: kind,
      },
      sectionChaos: {
        ...session.overrides.sectionChaos,
      },
      reviewedSections: {
        ...session.overrides.reviewedSections,
        [index]: true,
      },
    },
  };
}

export function setSectionChaos(session: ReviewSession, index: number, chaos: number): ReviewSession {
  return {
    ...session,
    overrides: {
      ...session.overrides,
      sectionChaos: {
        ...session.overrides.sectionChaos,
        [index]: clampChaos(chaos),
      },
      reviewedSections: {
        ...session.overrides.reviewedSections,
        [index]: true,
      },
    },
  };
}

export function acceptSectionReview(session: ReviewSession, index: number): ReviewSession {
  return {
    ...session,
    overrides: {
      ...session.overrides,
      reviewedSections: {
        ...session.overrides.reviewedSections,
        [index]: true,
      },
    },
  };
}

export function buildPlayableProfile(session: ReviewSession): SongProfile {
  const title = session.name.trim() || session.draft.title;

  return {
    ...session.draft,
    title,
    sections: session.draft.sections.map((section, index) => ({
      ...section,
      kind: session.overrides.sectionKinds[index] ?? section.kind,
      chaos: session.overrides.sectionChaos[index] ?? section.chaos,
      confidence: session.overrides.reviewedSections[index] ? 1 : section.confidence,
    })),
  };
}

export function buildReviewedProfileDraft(session: ReviewSession): ReviewedProfileDraft {
  return {
    name: session.name.trim() || session.draft.title,
    sourceTitle: session.draft.title,
    profile: buildPlayableProfile(session),
    review: mergeOverrides(session.overrides),
  };
}

export function setReviewName(session: ReviewSession, name: string): ReviewSession {
  return {
    ...session,
    name,
  };
}
