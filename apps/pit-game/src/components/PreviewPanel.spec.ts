// @vitest-environment jsdom

import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createAnalysisDraft } from '../game/domain/analysis-draft';
import { createReviewSession, selectSection } from '../game/review/review-session';
import { PreviewPanel } from './PreviewPanel';

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

describe('PreviewPanel', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('shows the selected loop range and relink guidance when preview audio is unavailable', () => {
    const session = {
      ...selectSection(createReviewSession(draft), 1),
      audioSource: null,
    };

    const html = renderToStaticMarkup(
      createElement(PreviewPanel, {
        session,
        onPreviewPlay: () => undefined,
        onPlayFull: () => undefined,
      }),
    );

    expect(html).toContain('Preview');
    expect(html).toContain('Loop');
    expect(html).toContain('4.13s');
    expect(html).toContain('12.00s');
    expect(html).toContain('Relink the original song file');
  });

  it('shows lightweight local audio preview controls when audio is linked', () => {
    const session = selectSection(
      createReviewSession(draft, {
        name: 'fan-edit.mp3',
        objectUrl: 'blob:fan-edit',
      }),
      1,
    );

    const html = renderToStaticMarkup(
      createElement(PreviewPanel, {
        session,
        onPreviewPlay: () => undefined,
        onPlayFull: () => undefined,
      }),
    );

    expect(html).toContain('Preview audio window');
    expect(html).toContain('Linked local audio: fan-edit.mp3');
    expect(html).toContain('audio');
    expect(html).not.toContain('Relink the original song file');
  });

  it('tears down preview audio timers and playback when the linked source disappears', () => {
    const playSpy = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    const pauseSpy = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
    const loadSpy = vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined);

    const sessionWithAudio = selectSection(
      createReviewSession(draft, {
        name: 'fan-edit.mp3',
        objectUrl: 'blob:fan-edit',
      }),
      1,
    );
    const view = renderIntoDocument(
      createElement(PreviewPanel, {
        session: sessionWithAudio,
        onPreviewPlay: () => undefined,
        onPlayFull: () => undefined,
      }),
    );
    const audio = view.container.querySelector('audio') as HTMLAudioElement;

    Object.defineProperty(audio, 'readyState', {
      configurable: true,
      get: () => 1,
    });

    const previewButton = Array.from(view.container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Preview audio window',
    );

    expect(previewButton).toBeDefined();

    act(() => {
      previewButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(playSpy).toHaveBeenCalledTimes(1);
    expect(audio.currentTime).toBe(4.125);

    view.rerender(
      createElement(PreviewPanel, {
        session: {
          ...sessionWithAudio,
          audioSource: null,
        },
        onPreviewPlay: () => undefined,
        onPlayFull: () => undefined,
      }),
    );

    expect(pauseSpy).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(8_000);
    });

    expect(pauseSpy).toHaveBeenCalledTimes(1);
    expect(loadSpy).not.toHaveBeenCalled();

    view.unmount();
  });

  it('removes a pending loadedmetadata listener when the linked source changes', () => {
    const playSpy = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    const pauseSpy = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
    const loadSpy = vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined);

    const sessionWithAudio = selectSection(
      createReviewSession(draft, {
        name: 'fan-edit.mp3',
        objectUrl: 'blob:fan-edit',
      }),
      1,
    );
    const view = renderIntoDocument(
      createElement(PreviewPanel, {
        session: sessionWithAudio,
        onPreviewPlay: () => undefined,
        onPlayFull: () => undefined,
      }),
    );
    const audio = view.container.querySelector('audio') as HTMLAudioElement;
    const addEventListenerSpy = vi.spyOn(audio, 'addEventListener');
    const removeEventListenerSpy = vi.spyOn(audio, 'removeEventListener');

    Object.defineProperty(audio, 'readyState', {
      configurable: true,
      get: () => 0,
    });

    const previewButton = Array.from(view.container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Preview audio window',
    );

    act(() => {
      previewButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(loadSpy).toHaveBeenCalledTimes(1);
    expect(addEventListenerSpy).toHaveBeenCalledWith('loadedmetadata', expect.any(Function));

    view.rerender(
      createElement(PreviewPanel, {
        session: {
          ...sessionWithAudio,
          audioSource: {
            name: 'fan-edit-2.mp3',
            objectUrl: 'blob:fan-edit-2',
          },
        },
        onPreviewPlay: () => undefined,
        onPlayFull: () => undefined,
      }),
    );

    expect(removeEventListenerSpy).toHaveBeenCalledWith('loadedmetadata', expect.any(Function));
    expect(pauseSpy.mock.calls.length).toBeGreaterThanOrEqual(1);
    expect(playSpy).not.toHaveBeenCalled();

    view.unmount();
  });
});
