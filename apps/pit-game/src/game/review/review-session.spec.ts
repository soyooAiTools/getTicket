import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ReviewPanel } from '../../components/ReviewPanel';
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

  it('applies the shared form-control class to review controls', () => {
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
        onPlay: () => undefined,
      }),
    );
    const styles = readFileSync(join(process.cwd(), 'src/styles.css'), 'utf8');

    expect(markup).toContain('class="form-control"');
    expect(styles).toContain('.form-control');
  });
});
