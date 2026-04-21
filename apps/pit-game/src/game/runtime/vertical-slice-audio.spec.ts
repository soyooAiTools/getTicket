// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';

import {
  buildSliceAudioElement,
  validateMinorityThreatFile,
} from './vertical-slice-audio';

describe('validateMinorityThreatFile', () => {
  it('accepts the exact minority threat mp3 file name', () => {
    expect(
      validateMinorityThreatFile(
        new File(['x'], 'Minority Unit - Minority Threat.mp3'),
      ),
    ).toBeNull();
  });

  it('rejects any other file name', () => {
    expect(validateMinorityThreatFile(new File(['x'], 'wrong-song.mp3'))).toBe(
      'Load the exact song file: Minority Unit - Minority Threat.mp3',
    );
  });
});

describe('buildSliceAudioElement', () => {
  it('creates an audio element primed to the authored slice start', () => {
    const audio = buildSliceAudioElement(
      { segmentStartMs: 46_000, segmentEndMs: 76_000 },
      'blob:minority-threat',
    );

    expect(audio).toBeInstanceOf(HTMLAudioElement);
    expect(audio.src).toContain('blob:minority-threat');
    expect(audio.preload).toBe('auto');
    expect(audio.currentTime).toBe(46);
  });
});
