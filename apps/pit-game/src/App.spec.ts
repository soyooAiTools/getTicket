// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SongProfile } from './game/domain/song-profile';
import { createReviewSession } from './game/review/review-session';
import { App } from './App';

const appFixtures = vi.hoisted(() => {
  const sampleProfile: SongProfile = {
    id: 'sample-profile',
    title: 'Sample Profile',
    durationMs: 18_000,
    bpm: 170,
    beatGridMs: [0, 4_500, 9_000, 13_500, 18_000],
    sections: [
      { kind: 'gather', startMs: 0, endMs: 9_000, confidence: 1, chaos: 0.2 },
      { kind: 'push', startMs: 9_000, endMs: 18_000, confidence: 1, chaos: 0.6 },
    ],
    impacts: [{ atMs: 9_000, strength: 'accent' }],
  };
  const uploadedDraft = {
    id: 'upload-draft',
    sourceTitle: 'Upload Draft',
    profile: {
      id: 'upload-draft',
      title: 'Upload Draft',
      durationMs: 16_000,
      bpm: 160,
      beatGridMs: [0, 4_125, 8_000, 12_000, 16_000],
      sections: [
        { kind: 'push', startMs: 0, endMs: 8_000, confidence: 0.8, chaos: 0.52 },
        { kind: 'breakdown', startMs: 8_000, endMs: 12_000, confidence: 0.82, chaos: 0.88 },
        { kind: 'recovery', startMs: 12_000, endMs: 16_000, confidence: 0.9, chaos: 0.2 },
      ],
      impacts: [{ atMs: 8_000, strength: 'drop' }],
    },
    sectionSuggestions: [],
    impactCandidates: [],
    warnings: [],
  };
  const savedDraft = {
    id: 'saved-draft',
    sourceTitle: 'Saved Draft',
    profile: sampleProfile,
    sectionSuggestions: [],
    impactCandidates: [],
    warnings: [],
  };

  interface RuntimeSnapshot {
    profile: SongProfile;
    elapsedMs: number;
    frame: { section: string; missionPool: string[] };
    crowd: object;
    player: object;
    currentMission: string;
    failed: boolean;
    completed: boolean;
    result: null;
    stats: {
      downEvents: number;
      liftCount: number;
      missionAlignedMs: number;
      recommendedZoneMs: number;
      rhythmMatchMs: number;
      rhythmOpportunityMs: number;
    };
    feedback: {
      action: {
        recommendedZone: string;
      };
    };
  }

  const snapshot: RuntimeSnapshot = {
    profile: sampleProfile,
    elapsedMs: 0,
    frame: { section: 'gather', missionPool: ['survive-window'] },
    crowd: {},
    player: {},
    currentMission: 'survive-window',
    failed: false,
    completed: false,
    result: null,
    stats: {
      downEvents: 0,
      liftCount: 0,
      missionAlignedMs: 0,
      recommendedZoneMs: 0,
      rhythmMatchMs: 0,
      rhythmOpportunityMs: 0,
    },
    feedback: {
      action: {
        recommendedZone: 'center',
      },
    },
  };

  return {
    sampleProfile,
    uploadedDraft,
    savedDraft,
    controllerState: {
      snapshot,
      listeners: new Set<(session: RuntimeSnapshot) => void>(),
      resetCalls: [] as Array<{ profile: SongProfile; elapsedMs: number; previewEndMs: number | null }>,
      uploadCount: 0,
    },
  };
});

function nextUploadAudioSource() {
  appFixtures.controllerState.uploadCount += 1;
  return {
    name: `upload-${appFixtures.controllerState.uploadCount}.mp3`,
    objectUrl: `blob:upload-${appFixtures.controllerState.uploadCount}`,
  };
}

vi.mock('./components/ResultsPanel', () => ({
  ResultsPanel: () => null,
}));

vi.mock('./components/GameHud', () => ({
  GameHud: () => null,
}));

vi.mock('./components/UploadPanel', () => ({
  UploadPanel: ({ onDraftReady }: { onDraftReady: (draft: typeof appFixtures.uploadedDraft, audioSource: { name: string; objectUrl: string }) => void }) =>
    createElement(
      'button',
      {
        type: 'button' as const,
        onClick: () => onDraftReady(appFixtures.uploadedDraft, nextUploadAudioSource()),
      },
      'Upload Draft',
    ),
}));

vi.mock('./components/ReviewPanel', () => ({
  ReviewPanel: ({
    session,
    onPreviewPlay,
    onPlay,
  }: {
    session: ReturnType<typeof createReviewSession> | null;
    onPreviewPlay: (profile: SongProfile, previewWindow: { startMs: number; endMs: number }) => void;
    onPlay: (profile: SongProfile) => void;
  }) =>
    session
      ? createElement(
          'section',
          { 'data-testid': 'review-shell' },
          createElement('p', null, session.audioSource ? `audio:${session.audioSource.name}` : 'audio:none'),
          createElement(
            'button',
            {
              type: 'button' as const,
              onClick: () => onPreviewPlay(session.draft.profile, { startMs: 4_125, endMs: 12_000 }),
            },
            'Preview From Review',
          ),
          createElement(
            'button',
            {
              type: 'button' as const,
              onClick: () => onPlay(session.draft.profile),
            },
            'Play Full From Review',
          ),
        )
      : null,
}));

vi.mock('./components/ProfileLibrary', () => ({
  ProfileLibrary: ({
    onLoad,
  }: {
    onLoad: (record: {
      id: string;
      name: string;
      sourceTitle: string;
      savedAt: string;
      draft: typeof appFixtures.savedDraft;
      overlay: ReturnType<typeof createReviewSession>['overlay'];
      profile: SongProfile;
      requiresAudioRelink: boolean;
      review: { sectionKinds: Record<number, never>; sectionChaos: Record<number, never>; reviewedSections: Record<number, never> };
    }) => void;
  }) =>
    createElement(
      'button',
      {
        type: 'button' as const,
        onClick: () =>
          onLoad({
            id: 'saved-project',
            name: 'Saved Project',
            sourceTitle: appFixtures.savedDraft.sourceTitle,
            savedAt: '2026-04-20T00:00:00.000Z',
            draft: appFixtures.savedDraft,
            overlay: createReviewSession(appFixtures.savedDraft).overlay,
            profile: appFixtures.savedDraft.profile,
            requiresAudioRelink: true,
            review: { sectionKinds: {}, sectionChaos: {}, reviewedSections: {} },
          }),
      },
      'Load Saved Project',
    ),
}));

vi.mock('./game/fixtures/profile-library', () => ({
  sampleProfileLibrary: [
    {
      id: 'sample',
      name: 'Fixture Sample',
      description: 'fixture',
      profile: appFixtures.sampleProfile,
    },
  ],
}));

vi.mock('./game/fixtures/authored-song-profile', () => ({
  authoredSongProfile: appFixtures.sampleProfile,
}));

vi.mock('./game/persistence/song-profile-storage', () => ({
  hydrateSavedAuthoringProject: (record: { draft: typeof appFixtures.savedDraft }) => createReviewSession(record.draft),
  saveAuthoringProject: () => null,
}));

vi.mock('./game/runtime/runtime-controller', () => ({
  createRuntimeController: () => ({
    subscribe(listener: (session: typeof appFixtures.controllerState.snapshot) => void) {
      appFixtures.controllerState.listeners.add(listener);
      return () => appFixtures.controllerState.listeners.delete(listener);
    },
    getSnapshot() {
      return appFixtures.controllerState.snapshot;
    },
    step() {
      return undefined;
    },
    reset(profile: SongProfile, elapsedMs = 0, previewEndMs: number | null = null) {
      appFixtures.controllerState.resetCalls.push({ profile, elapsedMs, previewEndMs: previewEndMs ?? null });
      appFixtures.controllerState.snapshot = {
        ...appFixtures.controllerState.snapshot,
        profile,
        elapsedMs: typeof elapsedMs === 'number' ? elapsedMs : 0,
      };
      appFixtures.controllerState.listeners.forEach((listener) => listener(appFixtures.controllerState.snapshot));
    },
  }),
}));

vi.mock('./game/runtime/create-pit-game', () => ({
  createPitGame: () => ({
    destroy() {
      return undefined;
    },
  }),
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

describe('App review shell flows', () => {
  let revokeObjectUrlSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    appFixtures.controllerState.snapshot = {
      ...appFixtures.controllerState.snapshot,
      profile: appFixtures.sampleProfile,
      elapsedMs: 0,
      result: null,
    };
    appFixtures.controllerState.listeners.clear();
    appFixtures.controllerState.resetCalls = [];
    appFixtures.controllerState.uploadCount = 0;
    revokeObjectUrlSpy = vi.fn();
    URL.revokeObjectURL = revokeObjectUrlSpy;
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('signals that the live pit simulation is already running on first load', () => {
    const view = renderApp();

    expect(view.container.textContent).toContain('Simulation live');
    expect(view.container.textContent).toContain('HUD is already updating from the default authored profile.');
    expect(view.container.textContent).not.toContain('Runtime modules land next.');

    view.unmount();
  });

  it('keeps the review shell reachable after preview and full play launched from review mode', () => {
    const view = renderApp();

    clickButton(view.container, 'Upload Draft');
    expect(view.container.querySelector('[data-testid="review-shell"]')).not.toBeNull();

    clickButton(view.container, 'Preview From Review');
    expect(view.container.querySelector('[data-testid="review-shell"]')).not.toBeNull();
    expect(appFixtures.controllerState.resetCalls[0]).toMatchObject({
      profile: appFixtures.uploadedDraft.profile,
      elapsedMs: 4_125,
      previewEndMs: 12_000,
    });

    clickButton(view.container, 'Play Full From Review');
    expect(view.container.querySelector('[data-testid="review-shell"]')).not.toBeNull();
    expect(appFixtures.controllerState.resetCalls[1]).toMatchObject({
      profile: appFixtures.uploadedDraft.profile,
      elapsedMs: 0,
    });

    view.unmount();
  });

  it('revokes the owned audio url when switching from uploaded audio to a sample profile without audio', () => {
    const view = renderApp();

    clickButton(view.container, 'Upload Draft');
    clickButton(view.container, 'Load Sample');

    expect(revokeObjectUrlSpy).toHaveBeenCalledWith('blob:upload-1');
    expect(view.container.textContent).toContain('audio:none');

    view.unmount();
  });

  it('revokes the owned audio url when loading a saved project without local audio', () => {
    const view = renderApp();

    clickButton(view.container, 'Upload Draft');
    clickButton(view.container, 'Load Saved Project');

    expect(revokeObjectUrlSpy).toHaveBeenCalledWith('blob:upload-1');
    expect(view.container.textContent).toContain('audio:none');

    view.unmount();
  });
});
