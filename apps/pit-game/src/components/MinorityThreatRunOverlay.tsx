interface MinorityThreatRunOverlayProps {
  fileName: string;
  loadedFileName: string | null;
  canStart: boolean;
  isRunning: boolean;
  result: {
    label: 'Survived' | 'Dropped';
    downCount: number;
    hitWindows: number;
  } | null;
  onLoadSong(): void;
  onStart(): void;
  onRestart(): void;
}

export function MinorityThreatRunOverlay({
  fileName,
  loadedFileName,
  canStart,
  isRunning,
  result,
  onLoadSong,
  onStart,
  onRestart,
}: MinorityThreatRunOverlayProps) {
  if (result) {
    return (
      <section className='slice-overlay slice-overlay--result'>
        <p className='slice-overlay__eyebrow'>Run Complete</p>
        <h2>{result.label}</h2>
        <p>Downs: {result.downCount}</p>
        <p>Hit windows: {result.hitWindows}</p>
        <button type='button' className='form-control' onClick={onRestart}>
          Replay Slice
        </button>
      </section>
    );
  }

  return (
    <section className='slice-overlay'>
      <p className='slice-overlay__eyebrow'>Minority Threat</p>
      <h1>30-second playable slice</h1>
      <p>Dirty livehouse pressure. Shoulder camera. One authored breakdown run.</p>
      <p className='slice-overlay__file'>{fileName}</p>
      {loadedFileName ? <p className='slice-overlay__loaded'>Loaded: {loadedFileName}</p> : null}
      <div className='slice-overlay__actions'>
        <button type='button' className='form-control' onClick={onLoadSong}>
          Load Minority Threat.mp3
        </button>
        <button
          type='button'
          className='form-control'
          disabled={!canStart || isRunning}
          onClick={onStart}
        >
          {isRunning ? 'Running...' : 'Start Slice'}
        </button>
      </div>
    </section>
  );
}
