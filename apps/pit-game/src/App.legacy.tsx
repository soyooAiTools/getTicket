import { startTransition, useEffect, useRef, useState } from 'react';

import { ResultsPanel } from './components/ResultsPanel';
import { GameHud } from './components/GameHud';
import { ProfileLibrary } from './components/ProfileLibrary';
import { ReviewPanel } from './components/ReviewPanel';
import { UploadPanel } from './components/UploadPanel';
import { authoredSongProfile } from './game/fixtures/authored-song-profile';
import { sampleProfileLibrary } from './game/fixtures/profile-library';
import {
  hydrateSavedAuthoringProject,
  saveAuthoringProject,
  type SavedAuthoringProjectRecord,
} from './game/persistence/song-profile-storage';
import type { SongProfile } from './game/domain/song-profile';
import type { GameSession } from './game/runtime/game-session';
import { createReviewSession, type ReviewSession } from './game/review/review-session';
import { createRuntimeController } from './game/runtime/runtime-controller';

type AppMode = 'authored' | 'reviewing' | 'playing';

interface LegacyPrototypeAppProps {
  active: boolean;
}

export function LegacyPrototypeApp({ active }: LegacyPrototypeAppProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<ReturnType<typeof createRuntimeController> | null>(null);
  const latestSessionRef = useRef<GameSession | null>(null);
  const flushTimeoutRef = useRef<number | null>(null);
  const relinkInputRef = useRef<HTMLInputElement | null>(null);
  const pendingRelinkRecordRef = useRef<SavedAuthoringProjectRecord | null>(null);
  const ownedAudioUrlRef = useRef<string | null>(null);

  if (!controllerRef.current) {
    controllerRef.current = createRuntimeController(authoredSongProfile);
  }

  const controller = controllerRef.current;
  const [session, setSession] = useState(() => controller.getSnapshot());
  const [mode, setMode] = useState<AppMode>('authored');
  const [reviewSession, setReviewSession] = useState<ReviewSession | null>(null);
  const [libraryRevision, setLibraryRevision] = useState(0);
  const [reviewSaveMessage, setReviewSaveMessage] = useState<string | null>(null);

  const applyRuntimeProfile = (profile: SongProfile, elapsedMs = 0, previewEndMs: number | null = null) => {
    controller.reset(profile, elapsedMs, previewEndMs);
    const nextSession = controller.getSnapshot();
    latestSessionRef.current = nextSession;
    startTransition(() => {
      setSession(nextSession);
    });
  };

  const replaceOwnedAudioUrl = (nextUrl: string | null) => {
    if (ownedAudioUrlRef.current && ownedAudioUrlRef.current !== nextUrl) {
      URL.revokeObjectURL(ownedAudioUrlRef.current);
    }

    ownedAudioUrlRef.current = nextUrl;
  };

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
    return () => {
      if (ownedAudioUrlRef.current) {
        URL.revokeObjectURL(ownedAudioUrlRef.current);
        ownedAudioUrlRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!active || !mountRef.current) {
      return;
    }

    let isMounted = true;
    let cleanup: (() => void) | undefined;

    void import('./game/runtime/create-pit-game').then(({ createPitGame }) => {
      if (!isMounted || !mountRef.current) {
        return;
      }

      const game = createPitGame(mountRef.current, controller);
      cleanup = () => game.destroy(true);
    });

    return () => {
      isMounted = false;
      cleanup?.();
    };
  }, [active, controller]);

  return (
    <div className={`runtime-shell${session.result ? ' has-result' : ''}`}>
      <div className='control-column'>
        <UploadPanel
          onDraftReady={(draft, audioSource) => {
            replaceOwnedAudioUrl(audioSource.objectUrl);
            setReviewSession(createReviewSession(draft, audioSource));
            setReviewSaveMessage(null);
            setMode('reviewing');
          }}
        />
        <input
          ref={relinkInputRef}
          type='file'
          accept='.mp3,.wav,.ogg'
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            const record = pendingRelinkRecordRef.current;
            const input = event.currentTarget;

            if (!file) {
              input.value = '';
              return;
            }

            const objectUrl = URL.createObjectURL(file);
            replaceOwnedAudioUrl(objectUrl);
            pendingRelinkRecordRef.current = null;

            if (record) {
              applyRuntimeProfile(record.profile);
              setReviewSession(
                hydrateSavedAuthoringProject(record, {
                  name: file.name,
                  objectUrl,
                }),
              );
              setReviewSaveMessage(`Relinked audio for ${record.name}.`);
            } else {
              setReviewSession((current) =>
                current
                  ? {
                      ...current,
                      audioSource: {
                        name: file.name,
                        objectUrl,
                      },
                    }
                  : current,
              );
              setReviewSaveMessage(`Linked local preview audio from ${file.name}.`);
            }

            setMode('reviewing');
            input.value = '';
          }}
        />
        <section className='panel profile-library'>
          <header className='library-header'>
            <h2>Built-in Sample Profiles</h2>
            <p>Load a curated profile without uploading audio first.</p>
          </header>
          <div className='library-list'>
            {sampleProfileLibrary.map((sample) => (
              <article key={sample.id} className='library-card'>
                <div className='library-copy'>
                  <strong>{sample.name}</strong>
                  <p>{sample.description}</p>
                  <small>
                    {sample.profile.durationMs / 1_000}s | {sample.profile.bpm} BPM
                  </small>
                </div>
                <div className='library-actions'>
                  <button
                    type='button'
                    className='form-control'
                    onClick={() => {
                      replaceOwnedAudioUrl(null);
                      applyRuntimeProfile(sample.profile);
                      setReviewSession(createReviewSession(sample.profile, sample.name));
                      setReviewSaveMessage(`Loaded built-in sample ${sample.name}.`);
                      setMode('reviewing');
                    }}
                  >
                    Load Sample
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
        <ResultsPanel
          profileTitle={session.profile.title}
          result={session.result}
          onRestart={() => {
            applyRuntimeProfile(session.profile);
          }}
        />
        <ReviewPanel
          session={mode === 'reviewing' ? reviewSession : null}
          onChange={setReviewSession}
          saveMessage={reviewSaveMessage}
          onSave={(session) => {
            const savedProject = saveAuthoringProject(session);

            if (savedProject) {
              setLibraryRevision((value) => value + 1);
              setReviewSaveMessage(`Saved ${savedProject.name} locally.`);
              return;
            }

            setReviewSaveMessage('Could not save this authoring project in local storage.');
          }}
          onPreviewPlay={(profile, previewWindow) => {
            applyRuntimeProfile(profile, previewWindow.startMs, previewWindow.endMs);
            setReviewSaveMessage(null);
            setMode('reviewing');
          }}
          onPlay={(profile) => {
            applyRuntimeProfile(profile);
            setReviewSaveMessage(null);
            setMode('reviewing');
          }}
          onRelinkAudio={() => {
            pendingRelinkRecordRef.current = null;
            relinkInputRef.current?.click();
          }}
        />
        <ProfileLibrary
          revision={libraryRevision}
          onLoad={(record) => {
            replaceOwnedAudioUrl(null);
            applyRuntimeProfile(record.profile);
            setReviewSession(hydrateSavedAuthoringProject(record));
            setReviewSaveMessage(
              record.requiresAudioRelink
                ? `Loaded ${record.name} from local storage. Relink the original song file to restore local preview audio.`
                : `Loaded ${record.name} from local storage.`,
            );
            setMode('reviewing');
          }}
          onRelink={(record) => {
            pendingRelinkRecordRef.current = record;
            relinkInputRef.current?.click();
          }}
        />
        <section className='panel stage-panel'>
          <header className='stage-copy'>
            <h1>Hardcore Pit Prototype</h1>
            <p className='stage-live-copy'>Simulation live</p>
            <p>HUD is already updating from the default authored profile.</p>
            <p>Upload a local track or load a built-in sample profile to draft a playable profile in the browser.</p>
            <p>Controls: hold A/S/D/F/E for actions, use arrow keys to target edge, center, front, or side.</p>
          </header>
          <div className='game-mount-shell'>
            <div className='game-mount-overlay'>
              <span className='game-mount-pill'>Live pit</span>
              <p>Load a sample or upload a track, then steer the room with the keyboard while the HUD reacts in real time.</p>
            </div>
            <div ref={mountRef} className='game-mount' />
          </div>
        </section>
      </div>
      <GameHud session={session} />
    </div>
  );
}
