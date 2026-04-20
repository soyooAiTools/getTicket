import { useEffect, useRef, useState } from 'react';

import { minorityThreatVerticalSlice } from '../game/fixtures/minority-threat-vertical-slice';
import { createVerticalSliceController } from '../game/runtime/vertical-slice-controller';
import {
  buildSliceAudioElement,
  validateMinorityThreatFile,
} from '../game/runtime/vertical-slice-audio';

function formatSummary(summary: {
  label: 'Survived' | 'Dropped';
  downCount: number;
  hitWindows: number;
}) {
  return `${summary.label} | Down ${summary.downCount} | Hits ${summary.hitWindows}`;
}

export function MinorityThreatShell() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ownedUrlRef = useRef<string | null>(null);
  const controllerRef = useRef(
    createVerticalSliceController(minorityThreatVerticalSlice),
  );
  const controller = controllerRef.current;
  const [session, setSession] = useState(() => controller.getSnapshot());
  const [loadedFileName, setLoadedFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return controller.subscribe((nextSession) => {
      setSession(nextSession);
    });
  }, [controller]);

  useEffect(() => {
    if (!mountRef.current) {
      return;
    }

    let active = true;
    let cleanup: (() => void) | undefined;

    void import('../game/runtime/create-vertical-slice-game').then(
      ({ createVerticalSliceGame }) => {
        if (!active || !mountRef.current) {
          return;
        }

        const game = createVerticalSliceGame(mountRef.current, controller);
        cleanup = () => {
          game.destroy();
        };
      },
    );

    return () => {
      active = false;
      cleanup?.();
    };
  }, [controller]);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();

      if (ownedUrlRef.current) {
        URL.revokeObjectURL(ownedUrlRef.current);
        ownedUrlRef.current = null;
      }
    };
  }, []);

  return (
    <section className='minority-shell'>
      <div className='minority-shell__copy'>
        <p className='minority-shell__eyebrow'>Vertical Slice</p>
        <h1>Minority Threat Vertical Slice</h1>
        <p>30 seconds of authored pit violence</p>
        <p>Load the song file to start the slice.</p>
        <p>{minorityThreatVerticalSlice.audio.fileName}</p>
        <p>{minorityThreatVerticalSlice.audio.localPath}</p>
        {loadedFileName ? <p>Loaded: {loadedFileName}</p> : null}
        {error ? <p className='minority-shell__error'>{error}</p> : null}
        {session.summary ? (
          <p className='minority-shell__summary'>
            {formatSummary(session.summary)}
          </p>
        ) : null}
      </div>

      <div className='minority-shell__actions'>
        <button
          type='button'
          className='form-control'
          onClick={() => {
            fileInputRef.current?.click();
          }}
        >
          Load Minority Threat.mp3
        </button>
        <button
          type='button'
          className='form-control'
          disabled={loadedFileName !== minorityThreatVerticalSlice.audio.fileName}
          onClick={() => {
            if (!audioRef.current) {
              return;
            }

            controller.reset();
            audioRef.current.pause();
            audioRef.current.currentTime =
              minorityThreatVerticalSlice.audio.segmentStartMs / 1_000;
            void audioRef.current.play().catch(() => undefined);
          }}
        >
          Start Slice
        </button>
        <input
          ref={fileInputRef}
          type='file'
          accept='.mp3,.wav,.ogg'
          hidden
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];

            if (!file) {
              event.currentTarget.value = '';
              return;
            }

            const validationError = validateMinorityThreatFile(file);

            if (validationError) {
              audioRef.current?.pause();

              if (ownedUrlRef.current) {
                URL.revokeObjectURL(ownedUrlRef.current);
                ownedUrlRef.current = null;
              }

              audioRef.current = null;
              setLoadedFileName(null);
              setError(validationError);
              event.currentTarget.value = '';
              return;
            }

            audioRef.current?.pause();

            if (ownedUrlRef.current) {
              URL.revokeObjectURL(ownedUrlRef.current);
            }

            const objectUrl = URL.createObjectURL(file);
            ownedUrlRef.current = objectUrl;
            audioRef.current = buildSliceAudioElement(
              minorityThreatVerticalSlice.audio,
              objectUrl,
            );
            setLoadedFileName(file.name);
            setError(null);
            event.currentTarget.value = '';
          }}
        />
      </div>

      <div ref={mountRef} className='minority-shell__mount' />
    </section>
  );
}
