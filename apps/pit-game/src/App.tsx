import { startTransition, useEffect, useRef, useState } from 'react';

import { GameHud } from './components/GameHud';
import { authoredSongProfile } from './game/fixtures/authored-song-profile';
import type { GameSession } from './game/runtime/game-session';
import { createRuntimeController } from './game/runtime/runtime-controller';

export function App() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<ReturnType<typeof createRuntimeController> | null>(null);
  const latestSessionRef = useRef<GameSession | null>(null);
  const flushTimeoutRef = useRef<number | null>(null);

  if (!controllerRef.current) {
    controllerRef.current = createRuntimeController(authoredSongProfile);
  }

  const controller = controllerRef.current;
  const [session, setSession] = useState(() => controller.getSnapshot());

  useEffect(() => {
    latestSessionRef.current = controller.getSnapshot();

    const flushSnapshot = () => {
      flushTimeoutRef.current = null;

      if (!latestSessionRef.current) {
        return;
      }

      const nextSession = latestSessionRef.current;
      startTransition(() => {
        setSession(nextSession);
      });
    };

    const unsubscribe = controller.subscribe((nextSession) => {
      latestSessionRef.current = nextSession;

      if (flushTimeoutRef.current !== null) {
        return;
      }

      flushTimeoutRef.current = window.setTimeout(flushSnapshot, 100);
    });

    return () => {
      unsubscribe();

      if (flushTimeoutRef.current !== null) {
        window.clearTimeout(flushTimeoutRef.current);
        flushTimeoutRef.current = null;
      }
    };
  }, [controller]);

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
