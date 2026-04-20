// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createAnalysisDraft } from '../game/domain/analysis-draft';
import { createReviewSession, selectImpact, selectSection } from '../game/review/review-session';
import { ReviewPanel } from './ReviewPanel';

const draft = createAnalysisDraft({
  id: 'fan-edit',
  sourceTitle: 'Fan Edit',
  profile: {
    id: 'fan-edit',
    title: 'Fan Edit',
    durationMs: 16_000,
    bpm: 160,
    beatGridMs: [0, 375, 750, 1_125, 1_500, 1_875, 2_250, 2_625, 3_000, 3_375, 3_750, 4_125, 7_875, 8_000, 11_250, 12_000, 13_125, 16_000],
    sections: [
      { kind: 'push', startMs: 0, endMs: 8_000, confidence: 0.58, chaos: 0.52 },
      { kind: 'breakdown', startMs: 8_000, endMs: 12_000, confidence: 0.62, chaos: 0.88 },
      { kind: 'recovery', startMs: 12_000, endMs: 16_000, confidence: 0.72, chaos: 0.2 },
    ],
    impacts: [{ atMs: 8_000, strength: 'drop' }],
  },
  sectionSuggestions: [],
  impactCandidates: [{ atMs: 7_875, strength: 'hit', confidence: 0.77, reasons: ['transient cluster'] }],
  warnings: [],
});

function renderIntoDocument(element: ReturnType<typeof createElement>) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(element);
  });

  return {
    container,
    rerender(nextElement: ReturnType<typeof createElement>) {
      act(() => {
        root.render(nextElement);
      });
    },
    unmount() {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

describe('ReviewPanel', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

  it('renders the lightweight authoring shell with timeline, inspector, and preview areas', () => {
    const html = renderToStaticMarkup(
      createElement(ReviewPanel, {
        session: selectImpact(createReviewSession(draft), 0),
        onChange: () => undefined,
        onSave: () => undefined,
        onPreviewPlay: () => undefined,
        onPlay: () => undefined,
      }),
    );

    expect(html).toContain('Review Pass');
    expect(html).toContain('Timeline');
    expect(html).toContain('Selection');
    expect(html).toContain('Preview');
  });

  it('surfaces the relink action when the current review session has no local audio source', () => {
    const html = renderToStaticMarkup(
      createElement(ReviewPanel, {
        session: selectImpact(createReviewSession(draft), 0),
        onChange: () => undefined,
        onSave: () => undefined,
        onPreviewPlay: () => undefined,
        onPlay: () => undefined,
        onRelinkAudio: () => undefined,
      }),
    );

    expect(html).toContain('Relink audio');
    expect(html).toContain('Relink the original song file');
  });

  it('triggers section and impact authoring operations from the integrated shell', () => {
    const onChange = vi.fn();
    const sectionKinds = ['push', 'push', 'recovery'] as const;
    const interactiveDraft = createAnalysisDraft({
      ...draft,
      profile: {
        ...draft.profile,
        sections: draft.profile.sections.map((section, index) => ({
          ...section,
          kind: sectionKinds[index] ?? section.kind,
        })),
      },
    });
    const session = selectSection(createReviewSession(interactiveDraft), 0);
    const view = renderIntoDocument(
      createElement(ReviewPanel, {
        session,
        onChange,
        onSave: () => undefined,
        onPreviewPlay: () => undefined,
        onPlay: () => undefined,
      }),
    );

    const moveEndEarlierButton = Array.from(view.container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Move end earlier',
    );
    const splitButton = Array.from(view.container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Split section',
    );
    const mergeButton = Array.from(view.container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Merge forward',
    );
    const addDropImpactButton = Array.from(view.container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Add drop impact',
    );

    expect(moveEndEarlierButton).toBeDefined();
    expect(splitButton).toBeDefined();
    expect(mergeButton).toBeDefined();
    expect(addDropImpactButton).toBeDefined();

    act(() => {
      moveEndEarlierButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      splitButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      mergeButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      addDropImpactButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onChange).toHaveBeenCalledTimes(4);
    expect(onChange.mock.calls[0]?.[0].overlay.sections[0]?.endMs).toBe(7_875);
    expect(onChange.mock.calls[1]?.[0].overlay.sections).toHaveLength(4);
    expect(onChange.mock.calls[2]?.[0].overlay.sections[0]?.endMs).toBe(12_000);
    expect(onChange.mock.calls[3]?.[0].overlay.impacts.some((impact: { strength: string }) => impact.strength === 'drop')).toBe(true);

    view.unmount();
  });
});
