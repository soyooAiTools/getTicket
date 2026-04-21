import { useState } from 'react';

import { MinorityThreatShell } from './components/MinorityThreatShell';
import { PrototypeWorkbench } from './components/PrototypeWorkbench';

type AppMode = 'slice' | 'lab';

export function App() {
  const [mode, setMode] = useState<AppMode>('slice');
  const [labMounted, setLabMounted] = useState(false);

  const openLab = () => {
    setLabMounted(true);
    setMode('lab');
  };

  return (
    <main className='app-shell'>
      <header className='mode-bar panel'>
        <div className='mode-bar__copy'>
          <p className='mode-bar__eyebrow'>Minority Threat</p>
          <h1>Fixed-song slice</h1>
          <p>
            The Minority Threat vertical slice is the default entry. The upload and review prototype stays
            available as an authoring lab.
          </p>
        </div>
        <div className='mode-bar__actions'>
          {mode === 'slice' ? (
            <button type='button' className='form-control' onClick={openLab}>
              Open authoring lab
            </button>
          ) : (
            <button type='button' className='form-control' onClick={() => setMode('slice')}>
              Return to slice
            </button>
          )}
        </div>
      </header>

      <div className='app-shell__workspace'>
        {mode === 'slice' ? (
          <section className='app-shell__panel app-shell__panel--slice'>
            <MinorityThreatShell />
          </section>
        ) : null}
        {labMounted ? (
          <section className='app-shell__panel app-shell__panel--lab' hidden={mode !== 'lab'}>
            <PrototypeWorkbench active={mode === 'lab'} onBack={() => setMode('slice')} />
          </section>
        ) : null}
      </div>
    </main>
  );
}
