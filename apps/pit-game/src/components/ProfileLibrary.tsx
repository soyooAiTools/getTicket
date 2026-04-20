import { useEffect, useState } from 'react';

import {
  loadSavedAuthoringProjects,
  type SavedAuthoringProjectRecord,
} from '../game/persistence/song-profile-storage';

interface ProfileLibraryProps {
  revision: number;
  onLoad(profile: SavedAuthoringProjectRecord): void;
  onRelink?(profile: SavedAuthoringProjectRecord): void;
}

export function ProfileLibrary({ revision, onLoad, onRelink }: ProfileLibraryProps) {
  const [records, setRecords] = useState<SavedAuthoringProjectRecord[]>([]);

  useEffect(() => {
    setRecords(loadSavedAuthoringProjects());
  }, [revision]);

  return (
    <section className='panel profile-library'>
      <header className='library-header'>
        <h2>Saved Authoring Projects</h2>
        <p>Reload your draft and overlay edits. Relink audio when you need local preview again.</p>
      </header>

      {records.length === 0 ? (
        <p className='library-empty'>No authoring projects saved yet.</p>
      ) : (
        <div className='library-list'>
          {records.map((record) => (
            <article key={record.id} className='library-card'>
              <div className='library-copy'>
                <strong>{record.name}</strong>
                <p>
                  {record.requiresAudioRelink
                    ? 'Audio relink required for waveform and loop preview.'
                    : 'Audio linked in this session.'}
                </p>
                <small>Saved {new Date(record.savedAt).toLocaleString()}</small>
              </div>
              <div className='library-actions'>
                <button type='button' className='form-control' onClick={() => onLoad(record)}>
                  Resume Edit
                </button>
                {record.requiresAudioRelink && onRelink ? (
                  <button type='button' className='form-control' onClick={() => onRelink(record)}>
                    Relink Audio
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
