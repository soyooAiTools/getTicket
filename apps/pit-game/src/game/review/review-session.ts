import type { SectionKind, SongProfile } from '../domain/song-profile';

export interface ReviewSession {
  draft: SongProfile;
  overrides: {
    sectionKinds: Record<number, SectionKind>;
  };
}

export function createReviewSession(draft: SongProfile): ReviewSession {
  return {
    draft,
    overrides: {
      sectionKinds: {},
    },
  };
}

export function getLowConfidenceSections(session: ReviewSession) {
  return session.draft.sections
    .map((section, index) => ({ section, index }))
    .filter(({ section }) => section.confidence < 0.7);
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
    },
  };
}

export function buildPlayableProfile(session: ReviewSession): SongProfile {
  return {
    ...session.draft,
    sections: session.draft.sections.map((section, index) => ({
      ...section,
      kind: session.overrides.sectionKinds[index] ?? section.kind,
      confidence: session.overrides.sectionKinds[index] ? 1 : section.confidence,
    })),
  };
}
