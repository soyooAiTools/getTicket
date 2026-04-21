import { useState } from 'react';

import { MinorityThreatShell } from './components/MinorityThreatShell';
import { PrototypeWorkbench } from './components/PrototypeWorkbench';

type AppMode = 'slice' | 'lab';

export function App() {
  const [mode, setMode] = useState<AppMode>('slice');
  const [labMounted, setLabMounted] = useState(false);

  return (
    <main className='app-shell app-shell--game'>
      {mode === 'slice' ? (
        <button
          type='button'
          className='app-shell__lab-link'
          onClick={() => {
            setLabMounted(true);
            setMode('lab');
          }}
        >
          Authoring Lab
        </button>
      ) : (
        <button type='button' className='app-shell__lab-link' disabled>
          Lab Open
        </button>
      )}

      {mode === 'slice' ? <MinorityThreatShell /> : null}
      {labMounted ? (
        <section data-testid='prototype-workbench-shell' hidden={mode !== 'lab'}>
          <PrototypeWorkbench active={mode === 'lab'} onBack={() => setMode('slice')} />
        </section>
      ) : null}
    </main>
  );
}
