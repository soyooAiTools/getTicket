import type { RunRating } from '../game/domain/run-rating';

interface ResultsPanelProps {
  profileTitle: string;
  result: RunRating | null;
  onRestart(): void;
}

const axisOrder = [
  ['survival', 'Survival'],
  ['rhythm', 'Rhythm'],
  ['presence', 'Presence'],
  ['respect', 'Respect'],
] as const;

export function ResultsPanel({ profileTitle, result, onRestart }: ResultsPanelProps) {
  if (!result) {
    return null;
  }

  return (
    <section className='panel results-panel'>
      <header className='results-header'>
        <p className='results-eyebrow'>Set result</p>
        <h2>{profileTitle}</h2>
        <strong className='results-label'>{result.label}</strong>
        <p className='results-summary'>{result.summary}</p>
      </header>

      <div className='results-grid'>
        {axisOrder.map(([axis, label]) => {
          const value = result.axes[axis];

          return (
            <article key={axis} className='results-axis'>
              <span className='results-axis-label'>{label}</span>
              <strong>{value.score}</strong>
              <p>{value.label}</p>
              <small>{value.detail}</small>
            </article>
          );
        })}
      </div>

      <div className='results-footer'>
        <p className='results-status'>{result.completed ? 'Completed' : 'Removed from pit'}</p>
        <button type='button' className='form-control' onClick={onRestart}>
          Restart current profile
        </button>
      </div>
    </section>
  );
}
