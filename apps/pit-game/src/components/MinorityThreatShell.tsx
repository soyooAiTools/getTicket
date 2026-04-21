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
  const audioCleanupRef = useRef<(() => void) | null>(null);
  const sliceEndHandledRef = useRef(false);
  const ownedUrlRef = useRef<string | null>(null);
  const controllerRef = useRef(
    createVerticalSliceController(minorityThreatVerticalSlice),
  );
  const controller = controllerRef.current;
  const [loadedFileName, setLoadedFileName] = useState<string | null>(null);
  const [isAudioReady, setIsAudioReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summaryText, setSummaryText] = useState<string | null>(() => {
    const summary = controller.getSnapshot().summary;
    return summary ? formatSummary(summary) : null;
  });

  const releaseAudio = (revokeObjectUrl: boolean) => {
    audioCleanupRef.current?.();
    audioCleanupRef.current = null;
    audioRef.current?.pause();
    audioRef.current = null;
    sliceEndHandledRef.current = false;
    setIsAudioReady(false);

    if (revokeObjectUrl && ownedUrlRef.current) {
      URL.revokeObjectURL(ownedUrlRef.current);
      ownedUrlRef.current = null;
      return;
    }

    if (!revokeObjectUrl) {
      ownedUrlRef.current = null;
    }
  };

  useEffect(() => {
    return controller.subscribe((nextSession) => {
      setSummaryText(
        nextSession.summary ? formatSummary(nextSession.summary) : null,
      );
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
          game.destroy(true);
        };
      },
    );

    return () => {
      active = false;
      cleanup?.();
    };
  }, [controller]);

  useEffect(() => {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    const sliceEndSeconds = minorityThreatVerticalSlice.audio.segmentEndMs / 1_000;

    const handlePlay = () => {
      sliceEndHandledRef.current = false;
      controller.start();
    };

    const handlePause = () => {
      if (!sliceEndHandledRef.current) {
        controller.pause();
      }
    };

    const handleEnded = () => {
      if (sliceEndHandledRef.current) {
        return;
      }

      sliceEndHandledRef.current = true;
      controller.complete();
    };

    const handleTimeUpdate = () => {
      if (sliceEndHandledRef.current || audio.currentTime < sliceEndSeconds) {
        return;
      }

      sliceEndHandledRef.current = true;
      controller.complete();
      audio.pause();
    };

    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('timeupdate', handleTimeUpdate);

    return () => {
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [controller, loadedFileName, isAudioReady]);

  useEffect(() => {
    return () => {
      releaseAudio(true);
    };
  }, []);

  return (
    <section className='minority-shell'>
      <div className='minority-shell__copy'>
        <p className='minority-shell__eyebrow'>Vertical Slice</p>
        <h1>Minority Threat Vertical Slice</h1>
        <p>30 seconds of authored pit violence.</p>
        <p>Load the exact song file to start the slice.</p>
        <p>{minorityThreatVerticalSlice.audio.fileName}</p>
        {loadedFileName ? <p>Loaded: {loadedFileName}</p> : null}
        {error ? <p className='minority-shell__error'>{error}</p> : null}
        {summaryText ? <p className='minority-shell__summary'>{summaryText}</p> : null}
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
          disabled={
            loadedFileName !== minorityThreatVerticalSlice.audio.fileName ||
            !isAudioReady
          }
          onClick={() => {
            if (
              !audioRef.current ||
              loadedFileName !== minorityThreatVerticalSlice.audio.fileName ||
              !isAudioReady
            ) {
              return;
            }

            controller.reset();
            audioRef.current.pause();
            audioRef.current.currentTime =
              minorityThreatVerticalSlice.audio.segmentStartMs / 1_000;
            void audioRef.current.play().catch(() => {
              controller.pause();
            });
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
              releaseAudio(true);
              setLoadedFileName(null);
              setError(validationError);
              event.currentTarget.value = '';
              return;
            }

            releaseAudio(true);

            const objectUrl = URL.createObjectURL(file);
            const nextAudio = buildSliceAudioElement(
              minorityThreatVerticalSlice.audio,
              objectUrl,
            );
            const handleLoadedMetadata = () => {
              if (audioRef.current !== nextAudio) {
                return;
              }

              setIsAudioReady(true);
            };

            nextAudio.addEventListener('loadedmetadata', handleLoadedMetadata);

            audioCleanupRef.current = () => {
              nextAudio.removeEventListener(
                'loadedmetadata',
                handleLoadedMetadata,
              );
            };
            ownedUrlRef.current = objectUrl;
            audioRef.current = nextAudio;
            setIsAudioReady(nextAudio.readyState >= 1);
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
