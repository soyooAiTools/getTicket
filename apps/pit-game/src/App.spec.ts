// @vitest-environment jsdom

import { act, createElement, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from './App';

vi.mock('./components/MinorityThreatShell', () => ({
  MinorityThreatShell: () =>
    createElement(
      'section',
      { 'data-testid': 'minority-threat-shell' },
      '30-second playable slice',
      createElement('button', { type: 'button' }, 'Load Minority Threat.mp3'),
    ),
}));

vi.mock('./components/PrototypeWorkbench', () => ({
  PrototypeWorkbench: ({ onBack }: { active: boolean; onBack: () => void }) => {
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
        'Back to Slice',
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

  it('boots into the playable slice and keeps the lab as a secondary control', () => {
    const view = renderApp();
    const labShell = () =>
      view.container.querySelector('[data-testid="prototype-workbench-shell"]');
    const labNote = () => view.container.querySelector('[data-testid="lab-note-value"]');

    expect(view.container.textContent).toContain('30-second playable slice');
    expect(view.container.textContent).toContain('Load Minority Threat.mp3');
    expect(view.container.textContent).toContain('Authoring Lab');
    expect(labShell()).toBeNull();

    clickButton(view.container, 'Authoring Lab');

    expect(labShell()).not.toBeNull();
    expect(labShell()?.getAttribute('hidden')).toBeNull();
    expect(view.container.textContent).toContain('Lab Open');

    clickButton(view.container, 'Set lab note');
    expect(labNote()?.textContent).toBe('persist me');

    const workbench = view.container.querySelector('[data-testid="prototype-workbench"]');

    if (!workbench) {
      throw new Error('Could not find prototype workbench');
    }

    clickButton(workbench as HTMLElement, 'Back to Slice');

    expect(labShell()).not.toBeNull();
    expect(labShell()?.getAttribute('hidden')).toBe('');

    clickButton(view.container, 'Authoring Lab');

    expect(labNote()?.textContent).toBe('persist me');
    view.unmount();
  });
});
