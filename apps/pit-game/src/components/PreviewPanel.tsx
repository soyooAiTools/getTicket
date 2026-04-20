import { useEffect, useRef } from 'react';

import type { ReviewSession } from '../game/review/review-session';

interface PreviewPanelProps {
  session: ReviewSession;
  onPreviewPlay(): void;
  onPlayFull(): void;
  onRelinkAudio?(): void;
}

function formatTime(ms: number): string {
  return `${(ms / 1_000).toFixed(2)}s`;
}

export function PreviewPanel({
  session,
  onPreviewPlay,
  onPlayFull,
  onRelinkAudio,
}: PreviewPanelProps) {
  const loopRange = session.loopRange;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const stopTimerRef = useRef<number | null>(null);
  const pendingLoadedMetadataHandlerRef = useRef<(() => void) | null>(null);

  const stopPreviewPlayback = () => {
    if (stopTimerRef.current !== null) {
      window.clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }

    const audio = audioRef.current;

    if (audio && pendingLoadedMetadataHandlerRef.current) {
      audio.removeEventListener('loadedmetadata', pendingLoadedMetadataHandlerRef.current);
      pendingLoadedMetadataHandlerRef.current = null;
    }

    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
  };

  useEffect(() => {
    return stopPreviewPlayback;
  }, [session.audioSource?.objectUrl, session.loopRange?.seed]);

  const previewAudioWindow = () => {
    if (!session.audioSource || !loopRange || !audioRef.current) {
      return;
    }

    const audio = audioRef.current;
    const startSeconds = loopRange.startMs / 1_000;
    const durationMs = Math.max(0, loopRange.endMs - loopRange.startMs);

    stopPreviewPlayback();

    const playWindow = () => {
      audio.currentTime = startSeconds;
      void audio.play();
      stopTimerRef.current = window.setTimeout(() => {
        audio.pause();
        audio.currentTime = startSeconds;
        stopTimerRef.current = null;
      }, durationMs);
    };

    if (audio.readyState >= 1) {
      playWindow();
      return;
    }

    const handleLoadedMetadata = () => {
      pendingLoadedMetadataHandlerRef.current = null;
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      playWindow();
    };

    pendingLoadedMetadataHandlerRef.current = handleLoadedMetadata;
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.load();
  };

  return (
    <section className='panel preview-panel'>
      <h3>Preview</h3>
      <div className='preview-panel-copy'>
        <span className='preview-label'>Loop</span>
        {loopRange ? (
          <strong>
            {formatTime(loopRange.startMs)} - {formatTime(loopRange.endMs)}
          </strong>
        ) : (
          <strong>Select a section or impact to set the loop window.</strong>
        )}
        <p>
          Preview play resets the runtime from the current loop start. Full play always starts from
          the top.
        </p>
      </div>
      <div className='preview-actions'>
        <button
          type='button'
          className='form-control'
          disabled={!loopRange}
          onClick={onPreviewPlay}
        >
          Play loop preview
        </button>
        <button type='button' className='form-control' onClick={onPlayFull}>
          Play full profile
        </button>
        <button
          type='button'
          className='form-control'
          disabled={!loopRange || !session.audioSource}
          onClick={previewAudioWindow}
        >
          Preview audio window
        </button>
      </div>
      {session.audioSource ? (
        <div className='preview-audio-player'>
          <p className='preview-audio-status'>Linked local audio: {session.audioSource.name}</p>
          <audio
            ref={audioRef}
            controls
            preload='metadata'
            src={session.audioSource.objectUrl}
          />
        </div>
      ) : (
        <div className='preview-audio-warning'>
          <p>Relink the original song file to restore local preview audio for this draft.</p>
          {onRelinkAudio ? (
            <button type='button' className='form-control' onClick={onRelinkAudio}>
              Relink audio
            </button>
          ) : null}
        </div>
      )}
    </section>
  );
}
