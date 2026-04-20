import type { SectionKind, SongProfile } from '../game/domain/song-profile';
import {
  acceptSectionReview,
  applySectionOverride,
  buildPlayableProfile,
  getLowConfidenceSections,
  type ReviewSession,
} from '../game/review/review-session';

interface ReviewPanelProps {
  session: ReviewSession | null;
  onChange(next: ReviewSession): void;
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

export function ReviewPanel({ session, onChange, onPlay }: ReviewPanelProps) {
  if (!session) {
    return null;
  }

  const lowConfidence = getLowConfidenceSections(session);

  return (
    <section className='panel'>
      <h2>Review Pass</h2>
      {lowConfidence.map(({ section, index }) => (
        <label key={`${section.startMs}-${section.endMs}`} className='review-row'>
          <span>
            {section.startMs}ms - {section.endMs}ms
          </span>
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
            <button
              type='button'
              className='form-control'
              onClick={() => onChange(acceptSectionReview(session, index))}
            >
              Accept Current Label
            </button>
          </div>
        </label>
      ))}
      <button
        type='button'
        className='form-control'
        onClick={() => onPlay(buildPlayableProfile(session))}
      >
        Play Reviewed Profile
      </button>
    </section>
  );
}
