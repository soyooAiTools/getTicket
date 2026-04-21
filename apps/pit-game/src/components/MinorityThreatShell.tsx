import { useEffect, useRef, useState } from 'react';

import { minorityThreatVerticalSlice } from '../game/fixtures/minority-threat-vertical-slice';
import { createVerticalSliceController } from '../game/runtime/vertical-slice-controller';
import {
  buildSliceAudioElement,
  validateMinorityThreatFile,
} from '../game/runtime/vertical-slice-audio';
import { MinorityThreatRunOverlay } from './MinorityThreatRunOverlay';

export function MinorityThreatShell() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCleanupRef = useRef<(() => void) | null>(null);
  const ownedUrlRef = useRef<string | null>(null);
  const controllerRef = useRef(
    createVerticalSliceController(minorityThreatVerticalSlice),
  );
  const controller = controllerRef.current;
  const [runResult, setRunResult] = useState<{
    label: 'Survived' | 'Dropped';
    downCount: number;
    hitWindows: number;
  } | null>(controller.getSnapshot().summary);
  const [isRunning, setIsRunning] = useState(controller.isRunning());
  const [loadedFileName, setLoadedFileName] = useState<string | null>(null);
  const [isAudioReady, setIsAudioReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const releaseAudio = (revokeObjectUrl: boolean) => {
    audioCleanupRef.current?.();
    audioCleanupRef.current = null;
    audioRef.current?.pause();
    audioRef.current = null;
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
      setRunResult(nextSession.summary);
      setIsRunning(controller.isRunning());
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

    const sliceEndSeconds = Number(audio.dataset.sliceEndSeconds ?? '0');

    const handlePlay = () => {
      controller.start();
    };

    const handlePause = () => controller.pause();

    const handleTimeUpdate = () => {
      if (audio.currentTime < sliceEndSeconds) {
        return;
      }

      controller.complete();
      setRunResult(controller.getSnapshot().summary);
      audio.pause();
    };

    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('timeupdate', handleTimeUpdate);

    return () => {
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [controller, loadedFileName, isAudioReady]);

  useEffect(() => {
    return () => {
      releaseAudio(true);
    };
  }, []);

  const startSlice = async () => {
    if (!audioRef.current || !isAudioReady) {
      return;
    }

    controller.reset();
    setRunResult(null);
    setError(null);
    audioRef.current.pause();
    audioRef.current.currentTime =
      minorityThreatVerticalSlice.audio.segmentStartMs / 1_000;

    try {
      await audioRef.current.play();
    } catch {
      controller.pause();
      setError('Could not start audio playback. Click Start Slice again.');
    }
  };

  return (
    <section className='minority-shell'>
      <div className='minority-shell__stage'>
        <div ref={mountRef} className='minority-shell__mount' />
        <MinorityThreatRunOverlay
          fileName={minorityThreatVerticalSlice.audio.fileName}
          loadedFileName={loadedFileName}
          canStart={
            loadedFileName === minorityThreatVerticalSlice.audio.fileName && isAudioReady
          }
          isRunning={isRunning}
          result={runResult}
          onLoadSong={() => fileInputRef.current?.click()}
          onStart={startSlice}
          onRestart={startSlice}
        />
        {error ? <p className='minority-shell__error'>{error}</p> : null}
      </div>
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
            nextAudio.removeEventListener('loadedmetadata', handleLoadedMetadata);
          };
          ownedUrlRef.current = objectUrl;
          audioRef.current = nextAudio;
          setRunResult(null);
          setIsAudioReady(nextAudio.readyState >= 1);
          setLoadedFileName(file.name);
          setError(null);
          event.currentTarget.value = '';
        }}
      />
    </section>
  );
}
