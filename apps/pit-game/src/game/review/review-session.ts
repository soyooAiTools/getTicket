import type { SectionKind, SongProfile } from '../domain/song-profile';

export interface ReviewSession {
  draft: SongProfile;
  overrides: {
    sectionKinds: Record<number, SectionKind>;
    reviewedSections: Record<number, true>;
  };
}

export function createReviewSession(draft: SongProfile): ReviewSession {
  return {
    draft,
    overrides: {
      sectionKinds: {},
      reviewedSections: {},
    },
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
  return {
    ...session.draft,
    sections: session.draft.sections.map((section, index) => ({
      ...section,
      kind: session.overrides.sectionKinds[index] ?? section.kind,
      confidence: session.overrides.reviewedSections[index] ? 1 : section.confidence,
    })),
  };
}
