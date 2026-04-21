// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from './App';
import { useState } from 'react';

vi.mock('./components/MinorityThreatShell', () => ({
  MinorityThreatShell: () =>
    createElement('section', { 'data-testid': 'minority-threat-shell' }, 'Minority Threat Slice'),
}));

vi.mock('./components/PrototypeWorkbench', () => ({
  PrototypeWorkbench: ({ onBack }: { onBack: () => void }) => {
    const [note, setNote] = useState('');

    return createElement(
      'section',
      { 'data-testid': 'prototype-workbench' },
      createElement(
        'button',
        {
          type: 'button' as const,
          onClick: () => setNote('persist me'),
        },
        'Set lab note',
      ),
      createElement(
        'button',
        {
          type: 'button' as const,
          onClick: onBack,
        },
        'Back to slice',
      ),
      createElement('p', { 'data-testid': 'lab-note-value' }, note),
    );
  },
}));

function renderApp() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(createElement(App));
  });

  return {
    container,
    root,
    unmount() {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

function clickButton(container: HTMLElement, label: string) {
  const button = Array.from(container.querySelectorAll('button')).find(
    (candidate) => candidate.textContent === label,
  );

  if (!button) {
    throw new Error(`Could not find button ${label}`);
  }

  act(() => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

describe('App mode switching', () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('shows the Minority Threat slice by default and opens the authoring lab on demand', () => {
    const view = renderApp();
    const sliceShell = () => view.container.querySelector('.app-shell__panel--slice');
    const labShell = () => view.container.querySelector('.app-shell__panel--lab');
    const labNote = () => view.container.querySelector('[data-testid="lab-note-value"]');

    expect(sliceShell()).not.toBeNull();
    expect(labShell()).toBeNull();

    clickButton(view.container, 'Open authoring lab');

    expect(sliceShell()).toBeNull();
    expect(labShell()).not.toBeNull();
    expect(labShell()?.getAttribute('hidden')).toBeNull();

    clickButton(view.container, 'Set lab note');
    expect(labNote()?.textContent).toBe('persist me');

    clickButton(view.container, 'Back to slice');

    expect(sliceShell()).not.toBeNull();
    expect(labShell()).not.toBeNull();
    expect(labShell()?.getAttribute('hidden')).toBe('');

    clickButton(view.container, 'Open authoring lab');

    expect(labNote()?.textContent).toBe('persist me');
    view.unmount();
  });
});
