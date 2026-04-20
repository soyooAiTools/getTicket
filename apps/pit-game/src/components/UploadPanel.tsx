import { useState } from 'react';

import { buildAnalysisDraft } from '../game/analysis/draft-song-profile';
import { decodeAudioFile } from '../game/analysis/decode-audio-file';
import type { AnalysisDraft } from '../game/domain/analysis-draft';
import { validateSongProfile } from '../game/domain/song-profile';

interface UploadPanelProps {
  onDraftReady(draft: AnalysisDraft, audioSource: { name: string; objectUrl: string }): void;
}

export function UploadPanel({ onDraftReady }: UploadPanelProps) {
  const [status, setStatus] = useState('No upload yet');

  return (
    <section className='panel upload-panel'>
      <h2>Upload Song</h2>
      <p>Upload a local track to draft a reviewable profile in the browser.</p>
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
              const draft = buildAnalysisDraft(analysis);
              const [validationError] = validateSongProfile(draft.profile);

              if (validationError) {
                throw new Error(validationError);
              }

              onDraftReady(draft, {
                name: file.name,
                objectUrl: URL.createObjectURL(file),
              });
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
