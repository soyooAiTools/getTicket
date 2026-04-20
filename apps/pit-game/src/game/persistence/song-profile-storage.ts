import { createAnalysisDraft, type AnalysisDraft } from '../domain/analysis-draft';
import {
  validateSongProfile,
  type ImpactStrength,
  type SectionKind,
  type SongProfile,
} from '../domain/song-profile';
import {
  buildPlayableProfile,
  createReviewSession,
  deriveReviewStateFromOverlay,
  type ReviewSession,
} from '../review/review-session';

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

export interface SavedAuthoringProjectRecord {
  id: string;
  name: string;
  sourceTitle: string;
  savedAt: string;
  draft: AnalysisDraft;
  overlay: ReviewSession['overlay'];
  profile: ReviewSession['draft']['profile'];
  requiresAudioRelink: boolean;
  review: ReviewedProfileReviewState;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const storageKey = 'pit-game.authoring-projects.v2';
const legacyStorageKey = 'pit-game.reviewed-profiles.v1';
const validSectionKinds = new Set<SectionKind>([
  'gather',
  'push',
  'two-step',
  'side-to-side prep',
  'breakdown',
  'recovery',
]);
const validImpactStrengths = new Set<ImpactStrength>(['accent', 'drop', 'hit', 'stop']);

function isValidSectionKind(value: unknown): value is SectionKind {
  return validSectionKinds.has(value as SectionKind);
}

function isValidImpactStrength(value: unknown): value is ImpactStrength {
  return validImpactStrengths.has(value as ImpactStrength);
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

  return `authoring-${Date.now()}-${Math.random().toString(16).slice(2)}`;
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

function normalizeStringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
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

    if (indexKey === null || !isFiniteNumber(chaos)) {
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
        isValidImpactStrength(impact.strength),
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

function normalizeAnalysisDraft(value: unknown): AnalysisDraft | null {
  if (!isRecordLike(value)) {
    return null;
  }

  const profile = normalizeProfile(value.profile);

  if (!profile || typeof value.id !== 'string' || typeof value.sourceTitle !== 'string') {
    return null;
  }

  const sectionSuggestions = Array.isArray(value.sectionSuggestions)
    ? value.sectionSuggestions
        .filter((suggestion): suggestion is AnalysisDraft['sectionSuggestions'][number] => {
          return (
            isRecordLike(suggestion) &&
            isFiniteNumber(suggestion.index) &&
            suggestion.index >= 0 &&
            isFiniteNumber(suggestion.confidence) &&
            Array.isArray(suggestion.reasons) &&
            suggestion.reasons.every((reason) => typeof reason === 'string')
          );
        })
        .map((suggestion) => ({
          index: suggestion.index,
          confidence: suggestion.confidence,
          reasons: [...suggestion.reasons],
        }))
    : [];

  const impactCandidates = Array.isArray(value.impactCandidates)
    ? value.impactCandidates
        .filter((candidate): candidate is AnalysisDraft['impactCandidates'][number] => {
          return (
            isRecordLike(candidate) &&
            isFiniteNumber(candidate.atMs) &&
            isValidImpactStrength(candidate.strength) &&
            isFiniteNumber(candidate.confidence) &&
            Array.isArray(candidate.reasons) &&
            candidate.reasons.every((reason) => typeof reason === 'string')
          );
        })
        .map((candidate) => ({
          atMs: candidate.atMs,
          strength: candidate.strength,
          confidence: candidate.confidence,
          reasons: [...candidate.reasons],
        }))
    : [];

  return createAnalysisDraft({
    id: value.id,
    sourceTitle: value.sourceTitle,
    profile,
    sectionSuggestions,
    impactCandidates,
    warnings: normalizeStringList(value.warnings),
  });
}

function normalizeOverlay(
  value: unknown,
  draft: AnalysisDraft,
): ReviewSession['overlay'] | null {
  if (!isRecordLike(value) || !Array.isArray(value.sections) || !Array.isArray(value.impacts)) {
    return null;
  }

  const sections = value.sections
    .filter((section): section is ReviewSession['overlay']['sections'][number] => {
      return (
        isRecordLike(section) &&
        isValidSectionKind(section.kind) &&
        isFiniteNumber(section.startMs) &&
        isFiniteNumber(section.endMs) &&
        isFiniteNumber(section.confidence) &&
        isFiniteNumber(section.chaos) &&
        (section.reviewState === 'suggested' ||
          section.reviewState === 'accepted' ||
          section.reviewState === 'modified' ||
          section.reviewState === 'user-added') &&
        (section.sourceIndex === null || (isFiniteNumber(section.sourceIndex) && section.sourceIndex >= 0))
      );
    })
    .map((section) => ({
      kind: section.kind,
      startMs: section.startMs,
      endMs: section.endMs,
      confidence: section.confidence,
      chaos: section.chaos,
      reviewState: section.reviewState,
      sourceIndex: section.sourceIndex,
    }));

  const impacts = value.impacts
    .filter((impact): impact is ReviewSession['overlay']['impacts'][number] => {
      return (
        isRecordLike(impact) &&
        isFiniteNumber(impact.atMs) &&
        isValidImpactStrength(impact.strength) &&
        (impact.reviewState === 'suggested' ||
          impact.reviewState === 'accepted' ||
          impact.reviewState === 'modified' ||
          impact.reviewState === 'user-added') &&
        (impact.source === 'profile' || impact.source === 'candidate' || impact.source === 'user')
      );
    })
    .map((impact) => ({
      atMs: impact.atMs,
      strength: impact.strength,
      reviewState: impact.reviewState,
      source: impact.source,
    }));

  if (sections.length !== value.sections.length || impacts.length !== value.impacts.length) {
    return null;
  }

  const session = {
    draft,
    overlay: { sections, impacts },
  };
  const profile = buildPlayableProfile({
    ...createReviewSession(draft),
    overlay: session.overlay,
  });

  if (validateSongProfile(profile).length > 0) {
    return null;
  }

  return session.overlay;
}

function normalizeSavedAuthoringProject(value: unknown): SavedAuthoringProjectRecord | null {
  if (!isRecordLike(value)) {
    return null;
  }

  const draft = normalizeAnalysisDraft(value.draft);

  if (
    !draft ||
    typeof value.id !== 'string' ||
    typeof value.name !== 'string' ||
    typeof value.sourceTitle !== 'string' ||
    typeof value.savedAt !== 'string'
  ) {
    return null;
  }

  const overlay = normalizeOverlay(value.overlay, draft);
  const profile = normalizeProfile(value.profile);

  if (!overlay || !profile) {
    return null;
  }

  const review = deriveReviewStateFromOverlay(draft, overlay);

  return {
    id: value.id,
    name: value.name,
    sourceTitle: value.sourceTitle,
    savedAt: value.savedAt,
    draft,
    overlay,
    profile,
    requiresAudioRelink: value.requiresAudioRelink !== false,
    review,
  };
}

function normalizeLegacyReviewedProfile(value: unknown): ReviewedProfileRecord | null {
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

function readArrayFromStorage(storage: StorageLike | null, key: string): unknown[] | null {
  if (!storage) {
    return [];
  }

  let raw: string | null;

  try {
    raw = storage.getItem(key);
  } catch {
    return null;
  }

  if (!raw) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return null;
  }
}

function writeSavedAuthoringProjects(
  storage: StorageLike | null,
  records: SavedAuthoringProjectRecord[],
): boolean {
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

function migrateLegacyRecord(record: ReviewedProfileRecord): SavedAuthoringProjectRecord {
  const draft = createAnalysisDraft({
    id: record.profile.id,
    sourceTitle: record.sourceTitle,
    profile: record.profile,
    sectionSuggestions: [],
    impactCandidates: [],
    warnings: [],
  });
  const session = createReviewSession(record.profile, record.name, record.review);

  return {
    id: record.id,
    name: record.name,
    sourceTitle: record.sourceTitle,
    savedAt: record.savedAt,
    draft,
    overlay: session.overlay,
    profile: record.profile,
    requiresAudioRelink: true,
    review: record.review,
  };
}

function readLegacyReviewedProfiles(storage: StorageLike | null): ReviewedProfileRecord[] | null {
  const parsed = readArrayFromStorage(storage, legacyStorageKey);

  if (parsed === null) {
    return null;
  }

  return parsed
    .map(normalizeLegacyReviewedProfile)
    .filter((record): record is ReviewedProfileRecord => record !== null);
}

function readSavedAuthoringProjects(storage: StorageLike | null): SavedAuthoringProjectRecord[] | null {
  const parsed = readArrayFromStorage(storage, storageKey);

  if (parsed === null) {
    return null;
  }

  if (parsed.length > 0) {
    return parsed
      .map(normalizeSavedAuthoringProject)
      .filter((record): record is SavedAuthoringProjectRecord => record !== null);
  }

  const legacy = readLegacyReviewedProfiles(storage);

  if (legacy === null) {
    return null;
  }

  const migrated = legacy.map(migrateLegacyRecord);

  if (migrated.length === 0) {
    return migrated;
  }

  if (!writeSavedAuthoringProjects(storage, migrated)) {
    return null;
  }

  return migrated;
}

export function loadSavedAuthoringProjects(storage?: StorageLike | null): SavedAuthoringProjectRecord[] {
  return (readSavedAuthoringProjects(resolveStorage(storage)) ?? []).sort((left, right) =>
    right.savedAt.localeCompare(left.savedAt),
  );
}

export function saveAuthoringProject(
  session: ReviewSession,
  storage?: StorageLike | null,
): SavedAuthoringProjectRecord | null {
  const resolvedStorage = resolveStorage(storage);
  const existing = readSavedAuthoringProjects(resolvedStorage);

  if (existing === null) {
    return null;
  }

  const record: SavedAuthoringProjectRecord = {
    id: createId(),
    name: session.name.trim() || session.draft.profile.title,
    sourceTitle: session.draft.sourceTitle,
    savedAt: new Date().toISOString(),
    draft: session.draft,
    overlay: {
      sections: session.overlay.sections.map((section) => ({ ...section })),
      impacts: session.overlay.impacts.map((impact) => ({ ...impact })),
    },
    profile: buildPlayableProfile(session),
    requiresAudioRelink: true,
    review: deriveReviewStateFromOverlay(session.draft, session.overlay),
  };

  if (!writeSavedAuthoringProjects(resolvedStorage, [record, ...existing])) {
    return null;
  }

  return record;
}

export function hydrateSavedAuthoringProject(
  record: SavedAuthoringProjectRecord,
  audioSource: ReviewSession['audioSource'] = null,
): ReviewSession {
  return {
    ...createReviewSession(record.draft, audioSource ?? undefined),
    name: record.name,
    overlay: {
      sections: record.overlay.sections.map((section) => ({ ...section })),
      impacts: record.overlay.impacts.map((impact) => ({ ...impact })),
    },
    overrides: deriveReviewStateFromOverlay(record.draft, record.overlay),
    audioSource,
  };
}

export function loadReviewedProfiles(storage?: StorageLike | null): ReviewedProfileRecord[] {
  return loadSavedAuthoringProjects(storage).map((record) => ({
    id: record.id,
    name: record.name,
    sourceTitle: record.sourceTitle,
    savedAt: record.savedAt,
    profile: record.profile,
    review: record.review,
  }));
}

export function saveReviewedProfile(
  draft: ReviewedProfileDraft,
  storage?: StorageLike | null,
): ReviewedProfileRecord | null {
  const session = createReviewSession(draft.profile, draft.name, draft.review);
  const saved = saveAuthoringProject(
    {
      ...session,
      draft: {
        ...session.draft,
        sourceTitle: draft.sourceTitle,
      },
      name: draft.name.trim() || draft.profile.title || draft.sourceTitle,
    },
    storage,
  );

  if (!saved) {
    return null;
  }

  return {
    id: saved.id,
    name: saved.name,
    sourceTitle: saved.sourceTitle,
    savedAt: saved.savedAt,
    profile: saved.profile,
    review: saved.review,
  };
}

export function deleteReviewedProfile(id: string, storage?: StorageLike | null): boolean {
  const resolvedStorage = resolveStorage(storage);
  const current = readSavedAuthoringProjects(resolvedStorage);

  if (current === null) {
    return false;
  }

  const next = current.filter((record) => record.id !== id);

  if (next.length === current.length) {
    return false;
  }

  return writeSavedAuthoringProjects(resolvedStorage, next);
}
