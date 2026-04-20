import type { SectionKind, SongProfile } from '../game/domain/song-profile';
import {
  acceptSectionReview,
  applySectionOverride,
  buildPlayableProfile,
  getLowConfidenceSections,
  setReviewName,
  setSectionChaos,
  type ReviewSession,
} from '../game/review/review-session';

interface ReviewPanelProps {
  session: ReviewSession | null;
  onChange(next: ReviewSession): void;
  onSave(session: ReviewSession): void;
  saveMessage?: string | null;
  onPlay(profile: SongProfile): void;
}

const sectionKinds: SectionKind[] = [
  'gather',
  'push',
  'two-step',
  'side-to-side prep',
  'breakdown',
  'recovery',
];

export function ReviewPanel({ session, onChange, onSave, saveMessage, onPlay }: ReviewPanelProps) {
  if (!session) {
    return null;
  }

  const lowConfidence = getLowConfidenceSections(session);

  return (
    <section className='panel'>
      <h2>Review Pass</h2>
      <label className='review-name'>
        <span>Reviewed profile name</span>
        <input
          className='form-control'
          value={session.name}
          onChange={(event) => onChange(setReviewName(session, event.target.value))}
          placeholder={session.draft.title}
        />
      </label>
      <p className='review-source'>Source: {session.draft.title}</p>
      {saveMessage ? <p className='review-status'>{saveMessage}</p> : null}
      {lowConfidence.map(({ section, index }) => (
        <article key={`${section.startMs}-${section.endMs}`} className='review-row'>
          <div className='review-row-copy'>
            <strong>
              {section.startMs}ms - {section.endMs}ms
            </strong>
            <p>Confidence {Math.round(section.confidence * 100)}%</p>
          </div>
          <div className='review-actions'>
            <select
              className='form-control'
              value={session.overrides.sectionKinds[index] ?? section.kind}
              onChange={(event) =>
                onChange(applySectionOverride(session, index, event.target.value as SectionKind))
              }
            >
              {sectionKinds.map((kind) => (
                <option key={kind} value={kind}>
                  {kind}
                </option>
              ))}
            </select>
            <label className='review-range'>
              <span>Chaos {Math.round((session.overrides.sectionChaos[index] ?? section.chaos) * 100)}%</span>
              <input
                type='range'
                min='0'
                max='100'
                step='1'
                value={Math.round((session.overrides.sectionChaos[index] ?? section.chaos) * 100)}
                onChange={(event) =>
                  onChange(setSectionChaos(session, index, Number(event.target.value) / 100))
                }
              />
            </label>
            <button
              type='button'
              className='form-control'
              onClick={() => onChange(acceptSectionReview(session, index))}
            >
              Accept Current Label
            </button>
          </div>
        </article>
      ))}
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
