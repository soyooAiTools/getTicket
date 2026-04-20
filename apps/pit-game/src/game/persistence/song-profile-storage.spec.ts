import { describe, expect, it } from 'vitest';

import { authoredSongProfile } from '../fixtures/authored-song-profile';
import {
  deleteReviewedProfile,
  loadReviewedProfiles,
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

describe('song profile storage', () => {
  it('round-trips a reviewed profile through save, load, and delete', () => {
    const storage = createMemoryStorage();
    const draft = {
      name: 'Weekend Chain',
      sourceTitle: authoredSongProfile.title,
      profile: {
        ...authoredSongProfile,
        title: 'Weekend Chain',
      },
      review: {
        sectionKinds: { 2: 'two-step' as const },
        sectionChaos: { 2: 0.84 },
        reviewedSections: { 2: true as const },
      },
    };

    const saved = saveReviewedProfile(draft, storage);
    const loaded = loadReviewedProfiles(storage);

    expect(saved).not.toBeNull();
    if (!saved) {
      throw new Error('expected reviewed profile to save');
    }
    expect(saved.id).toBeTruthy();
    expect(saved.savedAt).toBeTruthy();
    expect(loaded).toHaveLength(1);
    expect(loaded[0]).toMatchObject({
      id: saved.id,
      name: 'Weekend Chain',
      sourceTitle: authoredSongProfile.title,
      profile: {
        title: 'Weekend Chain',
      },
      review: {
        sectionKinds: { 2: 'two-step' },
        sectionChaos: { 2: 0.84 },
        reviewedSections: { 2: true },
      },
    });

    expect(deleteReviewedProfile(saved.id, storage)).toBe(true);
    expect(loadReviewedProfiles(storage)).toEqual([]);
  });

  it('sanitizes malformed review overrides from storage before exposing saved profiles', () => {
    const storage = createMemoryStorage();
    storage.setItem(
      'pit-game.reviewed-profiles.v1',
      JSON.stringify([
        {
          id: 'saved-1',
          name: 'Weekend Chain',
          sourceTitle: authoredSongProfile.title,
          savedAt: '2026-04-20T00:00:00.000Z',
          profile: authoredSongProfile,
          review: {
            sectionKinds: { 0: 'gather', 1: 'invalid-kind' },
            sectionChaos: { 0: 0.62, 1: 'loud', 2: 2.4 },
            reviewedSections: { 0: true, 1: 'yes' },
          },
        },
      ]),
    );

    expect(loadReviewedProfiles(storage)).toEqual([
      expect.objectContaining({
        id: 'saved-1',
        review: {
          sectionKinds: { 0: 'gather' },
          sectionChaos: { 0: 0.62, 2: 1 },
          reviewedSections: { 0: true },
        },
      }),
    ]);
  });

  it('drops saved records whose profile sections contain unsupported kinds', () => {
    const storage = createMemoryStorage();
    storage.setItem(
      'pit-game.reviewed-profiles.v1',
      JSON.stringify([
        {
          id: 'saved-1',
          name: 'Weekend Chain',
          sourceTitle: authoredSongProfile.title,
          savedAt: '2026-04-20T00:00:00.000Z',
          profile: {
            ...authoredSongProfile,
            sections: authoredSongProfile.sections.map((section, index) =>
              index === 1 ? { ...section, kind: 'bad-kind' } : section,
            ),
          },
          review: {
            sectionKinds: {},
            sectionChaos: {},
            reviewedSections: {},
          },
        },
      ]),
    );

    expect(loadReviewedProfiles(storage)).toEqual([]);
  });

  it('drops saved records whose profile timing fields are malformed', () => {
    const storage = createMemoryStorage();
    storage.setItem(
      'pit-game.reviewed-profiles.v1',
      JSON.stringify([
        {
          id: 'saved-1',
          name: 'Weekend Chain',
          sourceTitle: authoredSongProfile.title,
          savedAt: '2026-04-20T00:00:00.000Z',
          profile: {
            ...authoredSongProfile,
            durationMs: 'bad-duration',
            sections: authoredSongProfile.sections.map((section, index) =>
              index === 0 ? { ...section, startMs: 'bad-start' } : section,
            ),
          },
          review: {
            sectionKinds: {},
            sectionChaos: {},
            reviewedSections: {},
          },
        },
      ]),
    );

    expect(loadReviewedProfiles(storage)).toEqual([]);
  });

  it('returns a failure signal when storage writes are unavailable', () => {
    const storage: StorageLike = {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota exceeded');
      },
      removeItem: () => undefined,
    };

    expect(
      saveReviewedProfile(
        {
          name: 'Weekend Chain',
          sourceTitle: authoredSongProfile.title,
          profile: authoredSongProfile,
          review: {
            sectionKinds: {},
            sectionChaos: {},
            reviewedSections: {},
          },
        },
        storage,
      ),
    ).toBeNull();
  });

  it('returns false when delete cannot write back to storage', () => {
    let raw = JSON.stringify([
      {
        id: 'saved-1',
        name: 'Weekend Chain',
        sourceTitle: authoredSongProfile.title,
        savedAt: '2026-04-20T00:00:00.000Z',
        profile: authoredSongProfile,
        review: {
          sectionKinds: {},
          sectionChaos: {},
          reviewedSections: {},
        },
      },
    ]);

    const storage: StorageLike = {
      getItem: () => raw,
      setItem: () => {
        throw new Error('quota exceeded');
      },
      removeItem: () => undefined,
    };

    expect(deleteReviewedProfile('saved-1', storage)).toBe(false);
    expect(JSON.parse(raw)).toHaveLength(1);
  });

  it('treats storage read failures as an empty library instead of throwing', () => {
    const storage: StorageLike = {
      getItem: () => {
        throw new Error('storage blocked');
      },
      setItem: () => undefined,
      removeItem: () => undefined,
    };

    expect(loadReviewedProfiles(storage)).toEqual([]);
  });

  it('fails closed when save cannot read the current library state', () => {
    const storage: StorageLike = {
      getItem: () => {
        throw new Error('storage blocked');
      },
      setItem: () => undefined,
      removeItem: () => undefined,
    };

    expect(
      saveReviewedProfile(
        {
          name: 'Weekend Chain',
          sourceTitle: authoredSongProfile.title,
          profile: authoredSongProfile,
          review: {
            sectionKinds: {},
            sectionChaos: {},
            reviewedSections: {},
          },
        },
        storage,
      ),
    ).toBeNull();
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

    expect(loadReviewedProfiles(storage)).toEqual([]);
    expect(
      saveReviewedProfile(
        {
          name: 'Weekend Chain',
          sourceTitle: authoredSongProfile.title,
          profile: authoredSongProfile,
          review: {
            sectionKinds: {},
            sectionChaos: {},
            reviewedSections: {},
          },
        },
        storage,
      ),
    ).toBeNull();
    expect(writes).toEqual([]);
  });
});
