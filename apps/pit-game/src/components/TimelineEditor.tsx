import type { ReviewSession } from '../game/review/review-session';

interface TimelineEditorProps {
  session: ReviewSession;
  onSelectSection(index: number): void;
  onSelectImpact(index: number): void;
}

function toPercent(value: number, total: number): string {
  if (total <= 0) {
    return '0%';
  }

  return `${Math.max(0, Math.min(100, (value / total) * 100)).toFixed(2)}%`;
}

function formatTime(ms: number): string {
  return `${(ms / 1_000).toFixed(2)}s`;
}

export function TimelineEditor({ session, onSelectSection, onSelectImpact }: TimelineEditorProps) {
  const durationMs = Math.max(1, session.draft.profile.durationMs);

  return (
    <section className='panel timeline-editor'>
      <div className='timeline-header'>
        <div>
          <h3>Timeline</h3>
          <p>Select a section or impact to focus the inspector and preview loop.</p>
        </div>
        <strong>{formatTime(session.draft.profile.durationMs)}</strong>
      </div>
      <div className='timeline-lane-group'>
        <div className='timeline-lane-copy'>
          <span className='timeline-lane-label'>Sections</span>
          <small>{session.overlay.sections.length} authored regions</small>
        </div>
        <div className='timeline-sections' aria-label='Sections'>
          {session.overlay.sections.map((section, index) => {
            const isSelected =
              session.selection?.kind === 'section' && session.selection.index === index;

            return (
              <button
                key={`${section.startMs}-${section.endMs}-${index}`}
                type='button'
                className={`timeline-section-chip${isSelected ? ' is-selected' : ''}`}
                style={{
                  left: toPercent(section.startMs, durationMs),
                  width: toPercent(section.endMs - section.startMs, durationMs),
                }}
                onClick={() => onSelectSection(index)}
              >
                <span>{section.kind}</span>
                <small>
                  {formatTime(section.startMs)} - {formatTime(section.endMs)}
                </small>
              </button>
            );
          })}
        </div>
      </div>
      <div className='timeline-lane-group'>
        <div className='timeline-lane-copy'>
          <span className='timeline-lane-label'>Impacts</span>
          <small>{session.overlay.impacts.length} markers</small>
        </div>
        <div className='timeline-impacts' aria-label='Impacts'>
          {session.overlay.impacts.map((impact, index) => {
            const isSelected =
              session.selection?.kind === 'impact' && session.selection.index === index;

            return (
              <button
                key={`${impact.atMs}-${impact.strength}-${index}`}
                type='button'
                className={`timeline-impact-chip${isSelected ? ' is-selected' : ''}`}
                style={{ left: toPercent(impact.atMs, durationMs) }}
                onClick={() => onSelectImpact(index)}
                aria-label={`${impact.strength} at ${formatTime(impact.atMs)}`}
              >
                <span>{impact.strength}</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
