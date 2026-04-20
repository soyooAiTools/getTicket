import { useEffect, useRef, useState } from 'react';

import { GameHud } from './components/GameHud';
import { authoredSongProfile } from './game/fixtures/authored-song-profile';
import { createRuntimeController } from './game/runtime/runtime-controller';

export function App() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<ReturnType<typeof createRuntimeController> | null>(null);

  if (!controllerRef.current) {
    controllerRef.current = createRuntimeController(authoredSongProfile);
  }

  const controller = controllerRef.current;
  const [session, setSession] = useState(() => controller.getSnapshot());

  useEffect(() => controller.subscribe(setSession), [controller]);

  useEffect(() => {
    if (!mountRef.current) {
      return;
    }

    let active = true;
    let cleanup: (() => void) | undefined;

    void import('./game/runtime/create-pit-game').then(({ createPitGame }) => {
      if (!active || !mountRef.current) {
        return;
      }

      const game = createPitGame(mountRef.current, controller);
      cleanup = () => game.destroy(true);
    });

    return () => {
      active = false;
      cleanup?.();
    };
  }, [controller]);

  return (
    <main className='runtime-shell'>
      <section className='panel stage-panel'>
        <header className='stage-copy'>
          <h1>Hardcore Pit Prototype</h1>
          <p>Workspace bootstrapped. Runtime modules land next.</p>
        </header>
        <div ref={mountRef} className='game-mount' />
      </section>
      <GameHud session={session} />
    </main>
  );
}
