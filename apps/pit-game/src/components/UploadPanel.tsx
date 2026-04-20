import { useState } from 'react';

import { buildValidatedDraftSongProfile } from '../game/analysis/draft-song-profile';
import { decodeAudioFile } from '../game/analysis/decode-audio-file';
import type { SongProfile } from '../game/domain/song-profile';

interface UploadPanelProps {
  onDraftReady(profile: SongProfile): void;
}

export function UploadPanel({ onDraftReady }: UploadPanelProps) {
  const [status, setStatus] = useState('No upload yet');

  return (
    <section className='panel'>
      <h2>Upload Song</h2>
      <input
        type='file'
        accept='.mp3,.wav,.ogg'
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) {
            return;
          }

          const input = event.currentTarget;

          void (async () => {
            try {
              setStatus(`Analyzing ${file.name}...`);
              const analysis = await decodeAudioFile(file);
              onDraftReady(buildValidatedDraftSongProfile(analysis));
              setStatus(`Draft ready for ${analysis.title}`);
            } catch (error) {
              const message =
                error instanceof Error ? error.message : 'Unable to analyze this audio file.';
              setStatus(message);
            } finally {
              input.value = '';
            }
          })();
        }}
      />
      <p>{status}</p>
    </section>
  );
}
