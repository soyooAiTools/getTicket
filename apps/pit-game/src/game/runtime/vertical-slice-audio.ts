import type { VerticalSliceAudioSource } from '../domain/vertical-slice';

const MINORITY_THREAT_FILE_NAME = 'Minority Unit - Minority Threat.mp3';

export function validateMinorityThreatFile(file: File): string | null {
  if (file.name === MINORITY_THREAT_FILE_NAME) {
    return null;
  }

  return `Load the exact song file: ${MINORITY_THREAT_FILE_NAME}`;
}

export function buildSliceAudioElement(
  source: Pick<VerticalSliceAudioSource, 'segmentStartMs'>,
  objectUrl: string,
): HTMLAudioElement {
  const audio = new Audio(objectUrl);
  audio.preload = 'auto';
  audio.currentTime = source.segmentStartMs / 1_000;
  return audio;
}
