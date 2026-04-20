import type { GameSession } from '../game/runtime/game-session';

interface GameHudProps {
  session: GameSession;
}

export function GameHud({ session }: GameHudProps) {
  const { feedback } = session;

  return (
    <aside className='hud panel'>
      <header className='hud-header'>
        <p className='hud-eyebrow'>Show readout</p>
        <h2>{session.profile.title}</h2>
        <p className='hud-summary'>{feedback.section.detail}</p>
      </header>

      <section className='hud-card hud-card--section'>
        <span className='hud-label'>Section</span>
        <strong>{feedback.section.label}</strong>
        <p>{feedback.section.detail}</p>
      </section>

      <section className='hud-grid'>
        <article className={`hud-card hud-card--danger hud-card--${feedback.danger.state}`}>
          <span className='hud-label'>Danger</span>
          <strong>{feedback.danger.label}</strong>
          <p>{feedback.danger.detail}</p>
        </article>

        <article className='hud-card'>
          <span className='hud-label'>Mission</span>
          <strong>{feedback.mission.label}</strong>
          <p>{feedback.mission.detail}</p>
        </article>
      </section>

      <section className='hud-card'>
        <span className='hud-label'>Action guidance</span>
        <strong>{feedback.action.label}</strong>
        <p>{feedback.action.detail}</p>
        <div className='hud-zone-pills' aria-label='Zone pressure summary'>
          {Object.entries(feedback.zones).map(([zone, zoneFeedback]) => (
            <span
              key={zone}
              className={`hud-zone-pill${zoneFeedback.isCurrentZone ? ' is-current' : ''}${zoneFeedback.isRecommendedZone ? ' is-recommended' : ''}`}
            >
              {zoneFeedback.label} {zoneFeedback.pressure}%
            </span>
          ))}
        </div>
      </section>

      <section className='hud-card'>
        <span className='hud-label'>Player condition</span>
        <strong>{feedback.player.condition}</strong>
        <p>{feedback.player.detail}</p>
        <div className='hud-stats'>
          <span>Stamina {Math.round(feedback.player.stamina)}</span>
          <span>Balance {Math.round(feedback.player.balance)}</span>
          <span>Respect {Math.round(feedback.player.respect)}</span>
        </div>
      </section>

      <p className='hud-status'>{session.failed ? 'Removed from pit' : 'Still standing'}</p>
    </aside>
  );
}
