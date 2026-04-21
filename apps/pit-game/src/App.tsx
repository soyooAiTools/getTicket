import { useState } from 'react';

import { MinorityThreatShell } from './components/MinorityThreatShell';
import { PrototypeWorkbench } from './components/PrototypeWorkbench';

type AppMode = 'slice' | 'lab';

export function App() {
  const [mode, setMode] = useState<AppMode>('slice');
  const [labMounted, setLabMounted] = useState(false);

  return (
    <main className='app-shell app-shell--game'>
      <button
        type='button'
        className='app-shell__lab-link'
        onClick={() => {
          setLabMounted(true);
          setMode((current) => (current === 'lab' ? 'slice' : 'lab'));
        }}
      >
        {mode === 'slice' ? 'Authoring Lab' : 'Back to Slice'}
      </button>

      {mode === 'slice' ? <MinorityThreatShell /> : null}
      {labMounted ? (
        <section data-testid='prototype-workbench-shell' hidden={mode !== 'lab'}>
          <PrototypeWorkbench active={mode === 'lab'} onBack={() => setMode('slice')} />
        </section>
      ) : null}
    </main>
  );
}
