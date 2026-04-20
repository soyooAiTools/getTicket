import type { GameSession } from '../game/runtime/game-session';

interface GameHudProps {
  session: GameSession;
}

export function GameHud({ session }: GameHudProps) {
  return (
    <aside className='hud panel'>
      <h2>{session.profile.title}</h2>
      <p>Section: {session.frame.section}</p>
      <p>Mission: {session.currentMission}</p>
      <p>Stamina: {session.player.stamina.toFixed(0)}</p>
      <p>Balance: {session.player.balance.toFixed(0)}</p>
      <p>Respect: {session.player.respect.toFixed(0)}</p>
      <p>Status: {session.failed ? 'Removed from pit' : 'Still standing'}</p>
    </aside>
  );
}
