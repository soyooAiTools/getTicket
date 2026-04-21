import { LegacyPrototypeApp } from '../App.legacy';

interface PrototypeWorkbenchProps {
  active: boolean;
  onBack(): void;
}

export function PrototypeWorkbench({ active, onBack }: PrototypeWorkbenchProps) {
  return (
    <section className='prototype-workbench'>
      <header className='mode-bar panel mode-bar--lab'>
        <div className='mode-bar__copy'>
          <p className='mode-bar__eyebrow'>Authoring Lab</p>
          <h1>Upload and review prototype</h1>
          <p>Use this lab to upload tracks, review generated drafts, and keep the older workflow available.</p>
        </div>
        <div className='mode-bar__actions'>
          <button type='button' className='form-control' onClick={onBack}>
            Back to slice
          </button>
        </div>
      </header>

      <div className='prototype-workbench__body'>
        <LegacyPrototypeApp active={active} />
      </div>
    </section>
  );
}
