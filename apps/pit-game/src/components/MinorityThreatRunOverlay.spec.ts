// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { MinorityThreatRunOverlay } from './MinorityThreatRunOverlay';

function renderOverlay(
  props: Partial<React.ComponentProps<typeof MinorityThreatRunOverlay>> = {},
) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  const defaultProps: React.ComponentProps<typeof MinorityThreatRunOverlay> = {
    fileName: 'Minority Unit - Minority Threat.mp3',
    loadedFileName: null,
    canStart: false,
    isRunning: false,
    result: null,
    onLoadSong: () => undefined,
    onStart: () => undefined,
    onRestart: () => undefined,
  };

  act(() => {
    root.render(createElement(MinorityThreatRunOverlay, { ...defaultProps, ...props }));
  });

  return {
    container,
    unmount() {
      act(() => root.unmount());
      container.remove();
    },
  };
}

describe('MinorityThreatRunOverlay', () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('shows a game-first idle state without any local filesystem path', () => {
    const view = renderOverlay();

    expect(view.container.textContent).toContain('Minority Threat');
    expect(view.container.textContent).toContain('30-second playable slice');
    expect(view.container.textContent).toContain('Replay Slice');
    expect(view.container.textContent).toContain('Load Minority Threat.mp3');
    expect(view.container.textContent).not.toContain('C:/Users/Nick/Desktop');

    view.unmount();
  });

  it('switches to a replay-focused result state after the run ends', () => {
    const view = renderOverlay({
      result: { label: 'Survived', downCount: 1, hitWindows: 6 },
    });

    expect(view.container.textContent).toContain('Survived');
    expect(view.container.textContent).toContain('Replay Slice');

    view.unmount();
  });

  it('keeps start gated until the slice is ready and disables it while running', () => {
    const idle = renderOverlay({
      canStart: false,
      isRunning: false,
    });

    const idleStartButton = Array.from(idle.container.querySelectorAll('button')).find(
      (candidate) => candidate.textContent === 'Start Slice',
    );

    if (!(idleStartButton instanceof HTMLButtonElement)) {
      throw new Error('Could not find idle Start Slice button');
    }

    expect(idleStartButton.disabled).toBe(true);
    expect(idle.container.textContent).not.toContain('Running...');
    idle.unmount();

    const running = renderOverlay({
      canStart: true,
      isRunning: true,
    });

    expect(running.container.textContent).toContain('Running...');

    const runningStartButton = Array.from(running.container.querySelectorAll('button')).find(
      (candidate) => candidate.textContent === 'Running...',
    );

    if (!(runningStartButton instanceof HTMLButtonElement)) {
      throw new Error('Could not find running button');
    }

    expect(runningStartButton.disabled).toBe(true);
    running.unmount();
  });
});
