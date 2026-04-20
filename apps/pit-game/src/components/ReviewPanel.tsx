import type { SectionKind, SongProfile } from '../game/domain/song-profile';
import {
  acceptSectionReview,
  addImpactMarker,
  applySectionOverride,
  buildPlayableProfile,
  getLowConfidenceSections,
  mergeSectionForward,
  moveSectionBoundary,
  setReviewName,
  setImpactStrength,
  selectImpact,
  selectSection,
  setSectionChaos,
  splitSectionAtBeat,
  type ReviewSession,
} from '../game/review/review-session';
import { PreviewPanel } from './PreviewPanel';
import { TimelineEditor } from './TimelineEditor';

interface ReviewPanelProps {
  session: ReviewSession | null;
  onChange(next: ReviewSession): void;
  onSave(session: ReviewSession): void;
  saveMessage?: string | null;
  onPreviewPlay(profile: SongProfile, previewWindow: { startMs: number; endMs: number }): void;
  onPlay(profile: SongProfile): void;
  onRelinkAudio?(): void;
}

const sectionKinds: SectionKind[] = [
  'gather',
  'push',
  'two-step',
  'side-to-side prep',
  'breakdown',
  'recovery',
];

const impactStrengths = ['accent', 'drop', 'hit', 'stop'] as const;

function findPreviousBeat(beatGridMs: number[], atMs: number): number | null {
  for (let index = beatGridMs.length - 1; index >= 0; index -= 1) {
    const beat = beatGridMs[index];
    if (beat < atMs) {
      return beat;
    }
  }

  return null;
}

function findNextBeat(beatGridMs: number[], atMs: number): number | null {
  for (const beat of beatGridMs) {
    if (beat > atMs) {
      return beat;
    }
  }

  return null;
}

function findSplitBeat(
  beatGridMs: number[],
  section: ReviewSession['overlay']['sections'][number],
): number | null {
  const inside = beatGridMs.filter((beat) => beat > section.startMs && beat < section.endMs);

  if (inside.length === 0) {
    return null;
  }

  return inside[Math.floor(inside.length / 2)] ?? null;
}

function formatTime(ms: number): string {
  return `${(ms / 1_000).toFixed(2)}s`;
}

export function ReviewPanel({
  session,
  onChange,
  onSave,
  saveMessage,
  onPreviewPlay,
  onPlay,
  onRelinkAudio,
}: ReviewPanelProps) {
  if (!session) {
    return null;
  }

  const lowConfidence = getLowConfidenceSections(session);
  const selectedSection =
    session.selection?.kind === 'section'
      ? session.overlay.sections[session.selection.index] ?? null
      : null;
  const selectedImpact =
    session.selection?.kind === 'impact'
      ? session.overlay.impacts[session.selection.index] ?? null
      : null;
  const selectedSectionIndex = session.selection?.kind === 'section' ? session.selection.index : null;
  const selectedImpactIndex = session.selection?.kind === 'impact' ? session.selection.index : null;
  const previousStartBeat =
    selectedSection && selectedSectionIndex !== null
      ? findPreviousBeat(session.draft.profile.beatGridMs, selectedSection.startMs)
      : null;
  const nextStartBeat =
    selectedSection && selectedSectionIndex !== null
      ? findNextBeat(session.draft.profile.beatGridMs, selectedSection.startMs)
      : null;
  const previousEndBeat =
    selectedSection && selectedSectionIndex !== null
      ? findPreviousBeat(session.draft.profile.beatGridMs, selectedSection.endMs)
      : null;
  const nextEndBeat =
    selectedSection && selectedSectionIndex !== null
      ? findNextBeat(session.draft.profile.beatGridMs, selectedSection.endMs)
      : null;
  const splitBeat = selectedSection ? findSplitBeat(session.draft.profile.beatGridMs, selectedSection) : null;
  const mergeableSection =
    selectedSection && selectedSectionIndex !== null
      ? session.overlay.sections[selectedSectionIndex + 1]?.kind === selectedSection.kind
      : false;
  const impactAnchorMs = selectedSection
    ? Math.round((selectedSection.startMs + selectedSection.endMs) / 2)
    : selectedImpact?.atMs ?? null;

  return (
    <section className='panel review-panel-shell'>
      <div className='review-panel-header'>
        <div>
          <h2>Review Pass</h2>
          <p className='review-source'>Source: {session.draft.title}</p>
        </div>
        <label className='review-name'>
          <span>Reviewed profile name</span>
          <input
            className='form-control'
            value={session.name}
            onChange={(event) => onChange(setReviewName(session, event.target.value))}
            placeholder={session.draft.title}
          />
        </label>
      </div>
      {saveMessage ? <p className='review-status'>{saveMessage}</p> : null}
      {lowConfidence.length > 0 ? (
        <p className='review-status'>
          {lowConfidence.length} low-confidence section{lowConfidence.length === 1 ? '' : 's'} still need a pass.
        </p>
      ) : null}
      <div className='review-panel-grid'>
        <TimelineEditor
          session={session}
          onSelectSection={(index) => onChange(selectSection(session, index))}
          onSelectImpact={(index) => onChange(selectImpact(session, index))}
        />
        <div className='review-sidebar'>
          <section className='panel review-inspector'>
            <h3>Selection</h3>
            {selectedSection ? (
              <div className='review-selection-copy'>
                <strong>{selectedSection.kind}</strong>
                <p>
                  {formatTime(selectedSection.startMs)} - {formatTime(selectedSection.endMs)} | Confidence{' '}
                  {Math.round(selectedSection.confidence * 100)}%
                </p>
                <div className='review-actions'>
                  <select
                    className='form-control'
                    value={selectedSection.kind}
                    onChange={(event) =>
                      onChange(
                        applySectionOverride(session, session.selection?.kind === 'section' ? session.selection.index : -1, event.target.value as SectionKind),
                      )
                    }
                  >
                    {sectionKinds.map((kind) => (
                      <option key={kind} value={kind}>
                        {kind}
                      </option>
                    ))}
                  </select>
                  <label className='review-range'>
                    <span>Chaos {Math.round(selectedSection.chaos * 100)}%</span>
                    <input
                      type='range'
                      min='0'
                      max='100'
                      step='1'
                      value={Math.round(selectedSection.chaos * 100)}
                      onChange={(event) =>
                        onChange(
                          setSectionChaos(
                            session,
                            session.selection?.kind === 'section' ? session.selection.index : -1,
                            Number(event.target.value) / 100,
                          ),
                        )
                      }
                    />
                  </label>
                  <button
                    type='button'
                    className='form-control'
                    onClick={() =>
                      onChange(
                        acceptSectionReview(
                          session,
                          session.selection?.kind === 'section' ? session.selection.index : -1,
                        ),
                      )
                    }
                  >
                    Accept Current Label
                  </button>
                  <div className='review-authoring-controls'>
                    <button
                      type='button'
                      className='form-control'
                      disabled={selectedSectionIndex === null || previousStartBeat === null}
                      onClick={() => {
                        if (selectedSectionIndex === null || previousStartBeat === null) {
                          return;
                        }

                        onChange(moveSectionBoundary(session, selectedSectionIndex, 'start', previousStartBeat));
                      }}
                    >
                      Move start earlier
                    </button>
                    <button
                      type='button'
                      className='form-control'
                      disabled={selectedSectionIndex === null || nextStartBeat === null}
                      onClick={() => {
                        if (selectedSectionIndex === null || nextStartBeat === null) {
                          return;
                        }

                        onChange(moveSectionBoundary(session, selectedSectionIndex, 'start', nextStartBeat));
                      }}
                    >
                      Move start later
                    </button>
                    <button
                      type='button'
                      className='form-control'
                      disabled={selectedSectionIndex === null || previousEndBeat === null}
                      onClick={() => {
                        if (selectedSectionIndex === null || previousEndBeat === null) {
                          return;
                        }

                        onChange(moveSectionBoundary(session, selectedSectionIndex, 'end', previousEndBeat));
                      }}
                    >
                      Move end earlier
                    </button>
                    <button
                      type='button'
                      className='form-control'
                      disabled={selectedSectionIndex === null || nextEndBeat === null}
                      onClick={() => {
                        if (selectedSectionIndex === null || nextEndBeat === null) {
                          return;
                        }

                        onChange(moveSectionBoundary(session, selectedSectionIndex, 'end', nextEndBeat));
                      }}
                    >
                      Move end later
                    </button>
                    <button
                      type='button'
                      className='form-control'
                      disabled={selectedSectionIndex === null || splitBeat === null}
                      onClick={() => {
                        if (selectedSectionIndex === null || splitBeat === null) {
                          return;
                        }

                        onChange(splitSectionAtBeat(session, selectedSectionIndex, splitBeat));
                      }}
                    >
                      Split section
                    </button>
                    <button
                      type='button'
                      className='form-control'
                      disabled={selectedSectionIndex === null || !mergeableSection}
                      onClick={() => {
                        if (selectedSectionIndex === null || !mergeableSection) {
                          return;
                        }

                        onChange(mergeSectionForward(session, selectedSectionIndex));
                      }}
                    >
                      Merge forward
                    </button>
                  </div>
                  <div className='review-impact-controls'>
                    {impactStrengths.map((strength) => (
                      <button
                        key={strength}
                        type='button'
                        className='form-control'
                        disabled={impactAnchorMs === null}
                        onClick={() => {
                          if (impactAnchorMs === null) {
                            return;
                          }

                          onChange(addImpactMarker(session, { atMs: impactAnchorMs, strength }));
                        }}
                      >
                        Add {strength} impact
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : selectedImpact ? (
              <div className='review-selection-copy'>
                <strong>{selectedImpact.strength}</strong>
                <p>{formatTime(selectedImpact.atMs)} impact marker</p>
                <p>Preview this moment to validate whether it still lines up with the authored loop.</p>
                <label className='review-range'>
                  <span>Impact type</span>
                  <select
                    className='form-control'
                    value={selectedImpact.strength}
                    onChange={(event) => {
                      if (selectedImpactIndex === null) {
                        return;
                      }

                      onChange(setImpactStrength(session, selectedImpactIndex, event.target.value as typeof impactStrengths[number]));
                    }}
                  >
                    {impactStrengths.map((strength) => (
                      <option key={strength} value={strength}>
                        {strength}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ) : (
              <p className='review-status'>
                Select a section or impact from the timeline to inspect it here.
              </p>
            )}
          </section>
          <PreviewPanel
            session={session}
            onPreviewPlay={() => {
              if (!session.loopRange) {
                return;
              }

              onPreviewPlay(buildPlayableProfile(session), {
                startMs: session.loopRange.startMs,
                endMs: session.loopRange.endMs,
              });
            }}
            onPlayFull={() => onPlay(buildPlayableProfile(session))}
            onRelinkAudio={onRelinkAudio}
          />
        </div>
      </div>
      <div className='review-footer'>
        <button type='button' className='form-control' onClick={() => onSave(session)}>
          Save reviewed profile
        </button>
        <button type='button' className='form-control' onClick={() => onPlay(buildPlayableProfile(session))}>
          Play reviewed profile
        </button>
      </div>
    </section>
  );
}
