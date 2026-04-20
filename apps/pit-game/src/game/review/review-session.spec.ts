import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ReviewPanel } from '../../components/ReviewPanel';
import { authoredSongProfile } from '../fixtures/authored-song-profile';
import {
  acceptSectionReview,
  applySectionOverride,
  buildPlayableProfile,
  createReviewSession,
  getLowConfidenceSections,
  setReviewName,
  setSectionChaos,
} from './review-session';

describe('review session', () => {
  it('surfaces uncertain sections and applies name, section, and chaos overrides', () => {
    const session = createReviewSession({
      ...authoredSongProfile,
      sections: authoredSongProfile.sections.map((section, index) => ({
        ...section,
        confidence: index === 2 ? 0.52 : section.confidence,
      })),
    });

    expect(getLowConfidenceSections(session)).toHaveLength(1);

    const renamed = setReviewName(session, 'Weekend Chain');
    const relabeled = applySectionOverride(renamed, 2, 'two-step');
    const adjusted = setSectionChaos(relabeled, 2, 0.84);
    const playable = buildPlayableProfile(adjusted);

    expect(playable.title).toBe('Weekend Chain');
    expect(playable.sections[2].kind).toBe('two-step');
    expect(playable.sections[2].chaos).toBe(0.84);
  });

  it('allows a low-confidence section to be accepted without changing its label', () => {
    const session = createReviewSession({
      ...authoredSongProfile,
      sections: authoredSongProfile.sections.map((section, index) => ({
        ...section,
        confidence: index === 2 ? 0.52 : section.confidence,
      })),
    });

    expect(getLowConfidenceSections(session)).toHaveLength(1);

    const accepted = acceptSectionReview(session, 2);

    expect(getLowConfidenceSections(accepted)).toHaveLength(0);
    expect(buildPlayableProfile(accepted).sections[2]).toMatchObject({
      kind: authoredSongProfile.sections[2].kind,
      confidence: 1,
    });
  });

  it('renders an explicit accept-current-label action for low-confidence sections', () => {
    const session = createReviewSession({
      ...authoredSongProfile,
      sections: authoredSongProfile.sections.map((section, index) => ({
        ...section,
        confidence: index === 2 ? 0.52 : section.confidence,
      })),
    });

    const markup = renderToStaticMarkup(
      createElement(ReviewPanel, {
        session,
        onChange: () => undefined,
        onSave: () => undefined,
        onPlay: () => undefined,
      }),
    );
    const styles = readFileSync(join(process.cwd(), 'src/styles.css'), 'utf8');

    expect(markup).toContain('Accept Current Label');
    expect(markup).toContain('class="form-control"');
    expect(styles).toContain('.form-control');
  });
});
