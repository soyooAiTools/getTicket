import { describe, expect, it } from 'vitest';

import { authoredSongProfile } from '../fixtures/authored-song-profile';
import {
  applySectionOverride,
  buildPlayableProfile,
  createReviewSession,
  getLowConfidenceSections,
} from './review-session';

describe('review session', () => {
  it('surfaces uncertain sections and applies section relabels', () => {
    const session = createReviewSession({
      ...authoredSongProfile,
      sections: authoredSongProfile.sections.map((section, index) => ({
        ...section,
        confidence: index === 2 ? 0.52 : section.confidence,
      })),
    });

    expect(getLowConfidenceSections(session)).toHaveLength(1);

    const updated = applySectionOverride(session, 2, 'two-step');
    expect(buildPlayableProfile(updated).sections[2].kind).toBe('two-step');
  });
});
