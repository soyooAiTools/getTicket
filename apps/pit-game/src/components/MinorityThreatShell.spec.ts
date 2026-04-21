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
        } | null,
      ) => void)
    | null = null;

  return {
    createObjectUrlCalls: [] as string[],
    currentAudio: null as HTMLAudioElement | null,
    destroyCalls: [] as boolean[],
    startSpy: vi.fn(),
    pauseSpy: vi.fn(),
    completeSpy: vi.fn(),
    playSpy: vi.fn(() => Promise.resolve()),
    resetSpy: vi.fn(),
    revokeObjectUrlCalls: [] as string[],
    registerSummaryListener(listener: typeof summaryListener) {
      summaryListener = listener;
    },
    setSummary(summary: {
      label: 'Survived' | 'Dropped';
      downCount: number;
      hitWindows: number;
    } | null) {
      summaryListener?.(summary);
    },
  };
});

vi.mock('../game/runtime/create-vertical-slice-game', () => ({
  createVerticalSliceGame: () => ({
    destroy(removeCanvas?: boolean) {
      shellFixtures.destroyCalls.push(Boolean(removeCanvas));
    },
  }),
}));

vi.mock('../game/runtime/vertical-slice-controller', () => ({
  createVerticalSliceController: () => {
    let summary: {
      label: 'Survived' | 'Dropped';
      downCount: number;
      hitWindows: number;
    } | null = null;
    let running = false;
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
      isRunning() {
        return running;
      },
      start() {
        running = true;
        shellFixtures.startSpy();
        listeners.forEach((listener) => listener({ summary }));
      },
      pause() {
        running = false;
        shellFixtures.pauseSpy();
        listeners.forEach((listener) => listener({ summary }));
      },
      complete() {
        running = false;
        shellFixtures.completeSpy();
        summary = {
          label: 'Survived',
          downCount: 0,
          hitWindows: 0,
        };
        listeners.forEach((listener) => listener({ summary }));
      },
      reset() {
        summary = null;
        running = false;
        shellFixtures.resetSpy();
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

async function renderShell() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(createElement(MinorityThreatShell));
    await Promise.resolve();
  });

  return {
    container,
    async unmount() {
      await act(async () => {
        root.unmount();
        await Promise.resolve();
      });
      container.remove();
    },
  };
}

function getFileInput(container: HTMLElement) {
  const input = container.querySelector('input[type="file"]');

  if (!(input instanceof HTMLInputElement)) {
    throw new Error('Could not find file input');
  }

  return input;
}

function getStartButton(container: HTMLElement) {
  const button = Array.from(container.querySelectorAll('button')).find(
    (candidate) => candidate.textContent === 'Start Slice',
  );

  if (!(button instanceof HTMLButtonElement)) {
    throw new Error('Could not find Start Slice button');
  }

  return button;
}

function selectFile(input: HTMLInputElement, file: File) {
  act(() => {
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [file],
    });
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

describe('MinorityThreatShell', () => {
  beforeEach(() => {
    shellFixtures.createObjectUrlCalls.length = 0;
    shellFixtures.currentAudio = null;
    shellFixtures.destroyCalls.length = 0;
    shellFixtures.startSpy.mockClear();
    shellFixtures.pauseSpy.mockClear();
    shellFixtures.completeSpy.mockClear();
    shellFixtures.playSpy.mockClear();
    shellFixtures.resetSpy.mockClear();
    shellFixtures.revokeObjectUrlCalls.length = 0;

    URL.createObjectURL = vi.fn((file: Blob) => {
      const nextUrl = `blob:${shellFixtures.createObjectUrlCalls.length + 1}`;
      shellFixtures.createObjectUrlCalls.push(
        file instanceof File ? file.name : 'blob',
      );
      return nextUrl;
    });
    URL.revokeObjectURL = vi.fn((url: string) => {
      shellFixtures.revokeObjectUrlCalls.push(url);
    });

    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation(
      ((tagName: string, options?: ElementCreationOptions) => {
        const element = originalCreateElement(tagName, options);

        if (tagName.toLowerCase() === 'audio') {
          const audio = element as HTMLAudioElement;
          audio.play = shellFixtures.playSpy as typeof audio.play;
          audio.pause = vi.fn(() => {
            audio.dispatchEvent(new Event('pause'));
          }) as typeof audio.pause;
          shellFixtures.currentAudio = audio;
        }

        return element;
      }) as typeof document.createElement,
    );

    (
      globalThis as typeof globalThis & {
        IS_REACT_ACT_ENVIRONMENT?: boolean;
      }
    ).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('renders the authored song instructions and filename', async () => {
    const view = await renderShell();

    expect(view.container.textContent).toContain(
      'Minority Unit - Minority Threat.mp3',
    );
    expect(view.container.textContent).toContain(
      'Load the exact song file to start the slice.',
    );
    expect(view.container.textContent).not.toContain('C:/Users/Nick/Desktop');

    await view.unmount();
  });

  it('keeps Start Slice disabled until the correct file is loaded and metadata is ready', async () => {
    const view = await renderShell();
    const input = getFileInput(view.container);
    const startButton = getStartButton(view.container);

    expect(startButton.disabled).toBe(true);

    selectFile(
      input,
      new File(['ok'], 'Minority Unit - Minority Threat.mp3', {
        type: 'audio/mpeg',
      }),
    );

    expect(shellFixtures.createObjectUrlCalls).toEqual([
      'Minority Unit - Minority Threat.mp3',
    ]);
    expect(startButton.disabled).toBe(true);

    act(() => {
      shellFixtures.currentAudio?.dispatchEvent(new Event('loadedmetadata'));
    });

    expect(startButton.disabled).toBe(false);

    await view.unmount();
  });

  it('shows the validation error for a wrong file and leaves start disabled', async () => {
    const view = await renderShell();
    const input = getFileInput(view.container);
    const startButton = getStartButton(view.container);

    selectFile(
      input,
      new File(['bad'], 'wrong-song.mp3', { type: 'audio/mpeg' }),
    );

    expect(view.container.textContent).toContain(
      'Load the exact song file: Minority Unit - Minority Threat.mp3',
    );
    expect(startButton.disabled).toBe(true);
    expect(shellFixtures.createObjectUrlCalls).toEqual([]);

    await view.unmount();
  });

  it('resets the controller and plays the audio after readiness when Start Slice is clicked', async () => {
    const view = await renderShell();
    const input = getFileInput(view.container);
    const startButton = getStartButton(view.container);

    selectFile(
      input,
      new File(['ok'], 'Minority Unit - Minority Threat.mp3', {
        type: 'audio/mpeg',
      }),
    );

    act(() => {
      startButton.click();
    });

    expect(shellFixtures.resetSpy).not.toHaveBeenCalled();
    expect(shellFixtures.playSpy).not.toHaveBeenCalled();
    expect(shellFixtures.startSpy).not.toHaveBeenCalled();

    act(() => {
      shellFixtures.currentAudio?.dispatchEvent(new Event('loadedmetadata'));
    });

    act(() => {
      startButton.click();
    });

    expect(shellFixtures.resetSpy).toHaveBeenCalledTimes(1);
    expect(shellFixtures.currentAudio?.currentTime).toBe(46);
    expect(shellFixtures.playSpy).toHaveBeenCalledTimes(1);

    act(() => {
      shellFixtures.currentAudio?.dispatchEvent(new Event('play'));
    });

    expect(shellFixtures.startSpy).toHaveBeenCalledTimes(1);

    shellFixtures.pauseSpy.mockClear();

    act(() => {
      shellFixtures.currentAudio?.dispatchEvent(new Event('pause'));
    });

    expect(shellFixtures.pauseSpy).toHaveBeenCalledTimes(1);

    await view.unmount();
  });

  it('keeps the runtime paused if audio playback fails to start', async () => {
    shellFixtures.playSpy.mockRejectedValueOnce(new Error('play blocked'));

    const view = await renderShell();
    const input = getFileInput(view.container);
    const startButton = getStartButton(view.container);

    selectFile(
      input,
      new File(['ok'], 'Minority Unit - Minority Threat.mp3', {
        type: 'audio/mpeg',
      }),
    );

    act(() => {
      shellFixtures.currentAudio?.dispatchEvent(new Event('loadedmetadata'));
    });

    act(() => {
      startButton.click();
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(shellFixtures.playSpy).toHaveBeenCalledTimes(1);
    expect(shellFixtures.startSpy).not.toHaveBeenCalled();

    await view.unmount();
  });

  it('completes the slice and pauses audio when playback reaches the authored end', async () => {
    const view = await renderShell();
    const input = getFileInput(view.container);
    const startButton = getStartButton(view.container);

    selectFile(
      input,
      new File(['ok'], 'Minority Unit - Minority Threat.mp3', {
        type: 'audio/mpeg',
      }),
    );

    act(() => {
      shellFixtures.currentAudio?.dispatchEvent(new Event('loadedmetadata'));
      startButton.click();
      shellFixtures.currentAudio?.dispatchEvent(new Event('play'));
    });

    expect(shellFixtures.startSpy).toHaveBeenCalledTimes(1);

    act(() => {
      if (shellFixtures.currentAudio) {
        shellFixtures.currentAudio.currentTime = 76;
        shellFixtures.currentAudio.dispatchEvent(new Event('timeupdate'));
      }
    });

    expect(shellFixtures.completeSpy).toHaveBeenCalledTimes(1);
    expect(shellFixtures.currentAudio?.pause).toHaveBeenCalledTimes(1);

    await view.unmount();
  });

  it('revokes the previous owned URL on replacement and the current URL on unmount', async () => {
    const view = await renderShell();
    const input = getFileInput(view.container);

    selectFile(
      input,
      new File(['one'], 'Minority Unit - Minority Threat.mp3', {
        type: 'audio/mpeg',
      }),
    );
    act(() => {
      shellFixtures.currentAudio?.dispatchEvent(new Event('loadedmetadata'));
    });

    selectFile(
      input,
      new File(['two'], 'Minority Unit - Minority Threat.mp3', {
        type: 'audio/mpeg',
      }),
    );

    expect(shellFixtures.revokeObjectUrlCalls).toContain('blob:1');

    await view.unmount();

    expect(shellFixtures.revokeObjectUrlCalls).toContain('blob:2');
  });

  it('subscribes to controller summary updates and formats the result line', async () => {
    const view = await renderShell();

    act(() => {
      shellFixtures.setSummary({
        label: 'Survived',
        downCount: 2,
        hitWindows: 7,
      });
    });

    expect(view.container.textContent).toContain('Survived | Down 2 | Hits 7');

    await view.unmount();
  });

  it('destroys the Phaser game with canvas removal on unmount', async () => {
    const view = await renderShell();

    await view.unmount();

    expect(shellFixtures.destroyCalls).toEqual([true]);
  });
});
