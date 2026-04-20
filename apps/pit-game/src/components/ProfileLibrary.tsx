import { useEffect, useState } from 'react';

import {
  deleteReviewedProfile,
  loadReviewedProfiles,
  type ReviewedProfileRecord,
} from '../game/persistence/song-profile-storage';

interface ProfileLibraryProps {
  revision: number;
  onLoad(profile: ReviewedProfileRecord): void;
}

export function ProfileLibrary({ revision, onLoad }: ProfileLibraryProps) {
  const [profiles, setProfiles] = useState<ReviewedProfileRecord[]>([]);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    setProfiles(loadReviewedProfiles());
    setStatus(null);
  }, [revision]);

  return (
    <section className='panel profile-library'>
      <header className='library-header'>
        <h2>Saved Reviewed Profiles</h2>
        <p>Load a reviewed profile without re-uploading the track.</p>
      </header>
      {status ? <p className='library-status'>{status}</p> : null}

      {profiles.length === 0 ? (
        <p className='library-empty'>No reviewed profiles saved yet.</p>
      ) : (
        <div className='library-list'>
          {profiles.map((profile) => (
            <article key={profile.id} className='library-card'>
              <div className='library-copy'>
                <strong>{profile.name}</strong>
                <p>{profile.sourceTitle}</p>
                <small>Saved {new Date(profile.savedAt).toLocaleString()}</small>
              </div>
              <div className='library-actions'>
                <button type='button' className='form-control' onClick={() => onLoad(profile)}>
                  Load
                </button>
                <button
                  type='button'
                  className='form-control'
                  onClick={() => {
                    if (deleteReviewedProfile(profile.id)) {
                      setProfiles((current) => current.filter((entry) => entry.id !== profile.id));
                      setStatus(`Deleted ${profile.name}.`);
                    } else {
                      setStatus('Could not delete this saved profile from local storage.');
                    }
                  }}
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
