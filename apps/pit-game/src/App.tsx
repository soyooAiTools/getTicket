import { startTransition, useEffect, useRef, useState } from 'react';

import { ResultsPanel } from './components/ResultsPanel';
import { GameHud } from './components/GameHud';
import { ReviewPanel } from './components/ReviewPanel';
import { UploadPanel } from './components/UploadPanel';
import { authoredSongProfile } from './game/fixtures/authored-song-profile';
import type { GameSession } from './game/runtime/game-session';
import { createReviewSession, type ReviewSession } from './game/review/review-session';
import { createRuntimeController } from './game/runtime/runtime-controller';

type AppMode = 'authored' | 'reviewing' | 'uploaded';

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
  const [mode, setMode] = useState<AppMode>('authored');
  const [reviewSession, setReviewSession] = useState<ReviewSession | null>(null);

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
    <main className={`runtime-shell${session.result ? ' has-result' : ''}`}>
      <div className='control-column'>
        <UploadPanel
          onDraftReady={(draftProfile) => {
            setReviewSession(createReviewSession(draftProfile));
            setMode('reviewing');
          }}
        />
        <ResultsPanel
          profileTitle={session.profile.title}
          result={session.result}
          onRestart={() => {
            controller.reset(session.profile);
            latestSessionRef.current = controller.getSnapshot();
            startTransition(() => {
              setSession(controller.getSnapshot());
            });
          }}
        />
        <ReviewPanel
          session={mode === 'reviewing' ? reviewSession : null}
          onChange={setReviewSession}
          onPlay={(profile) => {
            controller.reset(profile);
            latestSessionRef.current = controller.getSnapshot();
            startTransition(() => {
              setSession(controller.getSnapshot());
            });
            setMode('uploaded');
          }}
        />
        <section className='panel stage-panel'>
          <header className='stage-copy'>
            <h1>Hardcore Pit Prototype</h1>
            <p>Workspace bootstrapped. Runtime modules land next.</p>
            <p>Upload a local track to draft a playable profile in the browser.</p>
            <p>Controls: hold A/S/D/F/E for actions, use arrow keys to target edge, center, front, or side.</p>
          </header>
          <div ref={mountRef} className='game-mount' />
        </section>
      </div>
      <GameHud session={session} />
    </main>
  );
}
