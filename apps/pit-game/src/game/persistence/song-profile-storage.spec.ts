import { describe, expect, it } from 'vitest';

import { createAnalysisDraft } from '../domain/analysis-draft';
import { createReviewSession } from '../review/review-session';
import {
  deleteReviewedProfile,
  hydrateSavedAuthoringProject,
  loadReviewedProfiles,
  loadSavedAuthoringProjects,
  saveAuthoringProject,
  saveReviewedProfile,
  type StorageLike,
} from './song-profile-storage';

function createMemoryStorage(): StorageLike {
  const values = new Map<string, string>();

  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}

const draftFixture = createAnalysisDraft({
  id: 'fan-edit',
  sourceTitle: 'Fan Edit',
  profile: {
    id: 'fan-edit',
    title: 'Fan Edit',
    durationMs: 16_000,
    bpm: 160,
    beatGridMs: [
      0, 375, 750, 1_125, 1_500, 1_875, 2_250, 2_625, 3_000, 3_375, 3_750, 4_125, 7_875, 8_000,
      11_250, 12_000, 13_125, 16_000,
    ],
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

describe('saved authoring projects', () => {
  it('persists draft plus overlay and requires audio relink on reload', () => {
    const storage = createMemoryStorage();
    const session = createReviewSession(draftFixture, { name: 'demo.mp3', objectUrl: 'blob:demo' });

    const record = saveAuthoringProject(session, storage);

    expect(record?.draft.sourceTitle).toBe('Fan Edit');
    expect(record?.overlay.sections).toHaveLength(3);
    expect(loadSavedAuthoringProjects(storage)[0]?.requiresAudioRelink).toBe(true);
  });

  it('hydrates a saved authoring project into an editable session with relinked audio', () => {
    const storage = createMemoryStorage();
    const saved = saveAuthoringProject(createReviewSession(draftFixture), storage);

    expect(saved).not.toBeNull();
    if (!saved) {
      throw new Error('expected authoring project to save');
    }

    const hydrated = hydrateSavedAuthoringProject(saved, { name: 'demo.mp3', objectUrl: 'blob:demo' });

    expect(hydrated.name).toBe(saved.name);
    expect(hydrated.overlay).toEqual(saved.overlay);
    expect(hydrated.overrides).toEqual(saved.review);
    expect(hydrated.audioSource).toEqual({ name: 'demo.mp3', objectUrl: 'blob:demo' });
  });

  it('hydrates v1 reviewed profiles into editable v2 projects', () => {
    const storage = createMemoryStorage();

    storage.setItem(
      'pit-game.reviewed-profiles.v1',
      JSON.stringify([
        {
          id: 'legacy',
          name: 'Legacy',
          sourceTitle: 'Legacy',
          savedAt: '2026-04-20T00:00:00.000Z',
          profile: draftFixture.profile,
          review: { sectionKinds: {}, sectionChaos: {}, reviewedSections: {} },
        },
      ]),
    );

    expect(loadSavedAuthoringProjects(storage)[0]?.profile.title).toBe('Fan Edit');
    expect(loadSavedAuthoringProjects(storage)[0]?.draft.sourceTitle).toBe('Legacy');
  });

  it('writes migrated legacy v1 records through into v2 storage on first load', () => {
    const storage = createMemoryStorage();

    storage.setItem(
      'pit-game.reviewed-profiles.v1',
      JSON.stringify([
        {
          id: 'legacy',
          name: 'Legacy',
          sourceTitle: 'Legacy',
          savedAt: '2026-04-20T00:00:00.000Z',
          profile: draftFixture.profile,
          review: { sectionKinds: {}, sectionChaos: {}, reviewedSections: {} },
        },
      ]),
    );

    const loaded = loadSavedAuthoringProjects(storage);
    const migratedRaw = storage.getItem('pit-game.authoring-projects.v2');

    expect(loaded).toHaveLength(1);
    expect(migratedRaw).not.toBeNull();
    expect(JSON.parse(migratedRaw ?? '[]')).toEqual([
      expect.objectContaining({
        id: 'legacy',
        sourceTitle: 'Legacy',
        requiresAudioRelink: true,
      }),
    ]);
  });

  it('keeps the reviewed-profile compatibility facade working through v2 storage', () => {
    const storage = createMemoryStorage();

    const saved = saveReviewedProfile(
      {
        name: 'Weekend Chain',
        sourceTitle: draftFixture.sourceTitle,
        profile: draftFixture.profile,
        review: {
          sectionKinds: { 1: 'push' },
          sectionChaos: { 1: 0.84 },
          reviewedSections: { 1: true },
        },
      },
      storage,
    );

    expect(saved?.name).toBe('Weekend Chain');
    expect(loadReviewedProfiles(storage)[0]?.review.sectionChaos).toEqual({ 1: 0.84 });
    expect(deleteReviewedProfile(saved?.id ?? '', storage)).toBe(true);
    expect(loadSavedAuthoringProjects(storage)).toEqual([]);
  });

  it('returns a failure signal when storage writes are unavailable', () => {
    const storage: StorageLike = {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota exceeded');
      },
      removeItem: () => undefined,
    };

    expect(saveAuthoringProject(createReviewSession(draftFixture), storage)).toBeNull();
  });

  it('treats storage read failures as an empty library instead of throwing', () => {
    const storage: StorageLike = {
      getItem: () => {
        throw new Error('storage blocked');
      },
      setItem: () => undefined,
      removeItem: () => undefined,
    };

    expect(loadSavedAuthoringProjects(storage)).toEqual([]);
  });

  it('fails closed when save cannot read the current library state', () => {
    const storage: StorageLike = {
      getItem: () => {
        throw new Error('storage blocked');
      },
      setItem: () => undefined,
      removeItem: () => undefined,
    };

    expect(saveAuthoringProject(createReviewSession(draftFixture), storage)).toBeNull();
  });

  it('treats malformed stored JSON as unloadable for save paths', () => {
    const writes: string[] = [];
    const storage: StorageLike = {
      getItem: () => '{not-json',
      setItem: (key, value) => {
        writes.push(`${key}:${value}`);
      },
      removeItem: () => undefined,
    };

    expect(loadSavedAuthoringProjects(storage)).toEqual([]);
    expect(saveAuthoringProject(createReviewSession(draftFixture), storage)).toBeNull();
    expect(writes).toEqual([]);
  });
});
