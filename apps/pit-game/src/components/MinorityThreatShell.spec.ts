// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MinorityThreatShell } from './MinorityThreatShell';

const shellFixtures = vi.hoisted(() => {
  let summaryListener:
    | ((
        summary: {
          label: 'Survived' | 'Dropped';
          downCount: number;
          hitWindows: number;
        },
      ) => void)
    | null = null;

  return {
    destroyCalls: 0,
    gameFactoryCalls: [] as Array<{
      container: HTMLElement;
      controller: object;
    }>,
    registerSummaryListener(listener: typeof summaryListener) {
      summaryListener = listener;
    },
    setSummary(summary: {
      label: 'Survived' | 'Dropped';
      downCount: number;
      hitWindows: number;
    }) {
      summaryListener?.(summary);
    },
  };
});

vi.mock('../game/runtime/create-vertical-slice-game', () => ({
  createVerticalSliceGame: (container: HTMLElement, controller: object) => {
    shellFixtures.gameFactoryCalls.push({ container, controller });

    return {
      destroy() {
        shellFixtures.destroyCalls += 1;
      },
    };
  },
}));

vi.mock('../game/runtime/vertical-slice-controller', () => ({
  createVerticalSliceController: () => {
    let summary: {
      label: 'Survived' | 'Dropped';
      downCount: number;
      hitWindows: number;
    } | null = null;
    const listeners = new Set<
      (session: {
        summary: {
          label: 'Survived' | 'Dropped';
          downCount: number;
          hitWindows: number;
        } | null;
      }) => void
    >();

    shellFixtures.registerSummaryListener((nextSummary) => {
      summary = nextSummary;
      listeners.forEach((listener) => listener({ summary }));
    });

    return {
      getSnapshot() {
        return { summary };
      },
      reset() {
        summary = null;
        listeners.forEach((listener) => listener({ summary }));
      },
      step() {
        return undefined;
      },
      subscribe(listener: (session: { summary: typeof summary }) => void) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    };
  },
}));

function renderShell() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(createElement(MinorityThreatShell));
  });

  return {
    container,
    unmount() {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

describe('MinorityThreatShell', () => {
  beforeEach(() => {
    shellFixtures.destroyCalls = 0;
    shellFixtures.gameFactoryCalls.length = 0;
    (
      globalThis as typeof globalThis & {
        IS_REACT_ACT_ENVIRONMENT?: boolean;
      }
    ).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders the authored song instructions and local path', () => {
    const view = renderShell();

    expect(view.container.textContent).toContain(
      'Minority Unit - Minority Threat.mp3',
    );
    expect(view.container.textContent).toContain(
      'C:/Users/Nick/Desktop/Minority Unit - Minority Threat.mp3',
    );
    expect(view.container.textContent).toContain(
      'Load the song file to start the slice.',
    );

    view.unmount();
  });

  it('subscribes to controller summary updates and formats the result line', () => {
    const view = renderShell();

    act(() => {
      shellFixtures.setSummary({
        label: 'Survived',
        downCount: 2,
        hitWindows: 7,
      });
    });

    expect(view.container.textContent).toContain('Survived | Down 2 | Hits 7');

    view.unmount();
  });
});
