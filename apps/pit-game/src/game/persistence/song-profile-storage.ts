import { validateSongProfile, type SectionKind, type SongProfile } from '../domain/song-profile';

export interface ReviewedProfileReviewState {
  sectionKinds: Record<number, SectionKind>;
  sectionChaos: Record<number, number>;
  reviewedSections: Record<number, true>;
}

export interface ReviewedProfileDraft {
  name: string;
  sourceTitle: string;
  profile: SongProfile;
  review: ReviewedProfileReviewState;
}

export interface ReviewedProfileRecord extends ReviewedProfileDraft {
  id: string;
  savedAt: string;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const storageKey = 'pit-game.reviewed-profiles.v1';
const validSectionKinds = new Set<SectionKind>([
  'gather',
  'push',
  'two-step',
  'side-to-side prep',
  'breakdown',
  'recovery',
]);

function isValidSectionKind(value: unknown): value is SectionKind {
  return validSectionKinds.has(value as SectionKind);
}

function getBrowserStorage(): StorageLike | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function resolveStorage(storage?: StorageLike | null): StorageLike | null {
  return storage ?? getBrowserStorage();
}

function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `reviewed-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isRecordLike(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toIndexKey(value: string): number | null {
  const key = Number(value);

  if (!Number.isInteger(key) || key < 0) {
    return null;
  }

  return key;
}

function clampChaos(value: number): number {
  return Math.max(0, Math.min(1, Number(value.toFixed(2))));
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function normalizeReviewState(value: unknown): ReviewedProfileReviewState | null {
  if (!isRecordLike(value)) {
    return null;
  }

  const rawSectionKinds = isRecordLike(value.sectionKinds) ? value.sectionKinds : {};
  const rawSectionChaos = isRecordLike(value.sectionChaos) ? value.sectionChaos : {};
  const rawReviewedSections = isRecordLike(value.reviewedSections) ? value.reviewedSections : {};
  const sectionKinds: Record<number, SectionKind> = {};
  const sectionChaos: Record<number, number> = {};
  const reviewedSections: Record<number, true> = {};

  for (const [key, sectionKind] of Object.entries(rawSectionKinds)) {
    const indexKey = toIndexKey(key);

    if (indexKey === null || !isValidSectionKind(sectionKind)) {
      continue;
    }

    sectionKinds[indexKey] = sectionKind;
  }

  for (const [key, chaos] of Object.entries(rawSectionChaos)) {
    const indexKey = toIndexKey(key);

    if (indexKey === null || typeof chaos !== 'number' || !Number.isFinite(chaos)) {
      continue;
    }

    sectionChaos[indexKey] = clampChaos(chaos);
  }

  for (const [key, reviewed] of Object.entries(rawReviewedSections)) {
    const indexKey = toIndexKey(key);

    if (indexKey === null || reviewed !== true) {
      continue;
    }

    reviewedSections[indexKey] = true;
  }

  return {
    sectionKinds,
    sectionChaos,
    reviewedSections,
  };
}

function normalizeProfile(value: unknown): SongProfile | null {
  if (!isRecordLike(value)) {
    return null;
  }

  const profile = value as Partial<SongProfile>;
  if (
    typeof profile.id !== 'string' ||
    typeof profile.title !== 'string' ||
    !isFiniteNumber(profile.durationMs) ||
    profile.durationMs <= 0 ||
    !isFiniteNumber(profile.bpm) ||
    profile.bpm <= 0 ||
    !Array.isArray(profile.sections) ||
    !Array.isArray(profile.beatGridMs) ||
    !Array.isArray(profile.impacts)
  ) {
    return null;
  }

  if (
    !profile.sections.every(
      (section) =>
        isRecordLike(section) &&
        isValidSectionKind(section.kind) &&
        isFiniteNumber(section.startMs) &&
        isFiniteNumber(section.endMs) &&
        isFiniteNumber(section.confidence) &&
        isFiniteNumber(section.chaos),
    )
  ) {
    return null;
  }

  if (!profile.beatGridMs.every((beatMs) => isFiniteNumber(beatMs))) {
    return null;
  }

  if (
    !profile.impacts.every(
      (impact) =>
        isRecordLike(impact) &&
        isFiniteNumber(impact.atMs) &&
        (impact.strength === 'accent' || impact.strength === 'drop'),
    )
  ) {
    return null;
  }

  try {
    const errors = validateSongProfile(profile as SongProfile);
    if (errors.length > 0) {
      return null;
    }
  } catch {
    return null;
  }

  return profile as SongProfile;
}

function normalizeRecord(value: unknown): ReviewedProfileRecord | null {
  if (!isRecordLike(value)) {
    return null;
  }

  const profile = normalizeProfile(value.profile);
  const review = normalizeReviewState(value.review);
  const id = typeof value.id === 'string' ? value.id : '';
  const name = typeof value.name === 'string' ? value.name : '';
  const sourceTitle = typeof value.sourceTitle === 'string' ? value.sourceTitle : '';
  const savedAt = typeof value.savedAt === 'string' ? value.savedAt : '';

  if (!profile || !review || !id || !name || !sourceTitle || !savedAt) {
    return null;
  }

  return {
    id,
    name,
    sourceTitle,
    profile,
    review,
    savedAt,
  };
}

function readReviewedProfileRecords(storage: StorageLike | null): ReviewedProfileRecord[] | null {
  if (!storage) {
    return [];
  }

  let raw: string | null;

  try {
    raw = storage.getItem(storageKey);
  } catch {
    return null;
  }

  if (!raw) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map(normalizeRecord).filter((record): record is ReviewedProfileRecord => record !== null);
  } catch {
    return null;
  }
}

function writeReviewedProfileRecords(storage: StorageLike | null, records: ReviewedProfileRecord[]): boolean {
  if (!storage) {
    return false;
  }

  try {
    storage.setItem(storageKey, JSON.stringify(records));
    return true;
  } catch {
    return false;
  }
}

export function loadReviewedProfiles(storage?: StorageLike | null): ReviewedProfileRecord[] {
  return (readReviewedProfileRecords(resolveStorage(storage)) ?? []).sort((left, right) =>
    right.savedAt.localeCompare(left.savedAt),
  );
}

export function saveReviewedProfile(
  draft: ReviewedProfileDraft,
  storage?: StorageLike | null,
): ReviewedProfileRecord | null {
  const resolvedStorage = resolveStorage(storage);
  const existingRecords = readReviewedProfileRecords(resolvedStorage);

  if (existingRecords === null) {
    return null;
  }

  const name = draft.name.trim() || draft.profile.title || draft.sourceTitle;
  const record: ReviewedProfileRecord = {
    ...draft,
    id: createId(),
    name,
    savedAt: new Date().toISOString(),
  };
  const next = [record, ...existingRecords];

  if (!writeReviewedProfileRecords(resolvedStorage, next)) {
    return null;
  }

  return record;
}

export function deleteReviewedProfile(id: string, storage?: StorageLike | null): boolean {
  const resolvedStorage = resolveStorage(storage);
  const current = readReviewedProfileRecords(resolvedStorage);

  if (current === null) {
    return false;
  }

  const next = current.filter((record) => record.id !== id);
  const removed = next.length !== current.length;

  if (removed) {
    return writeReviewedProfileRecords(resolvedStorage, next);
  }

  return false;
}
