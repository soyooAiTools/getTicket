import { analyze } from 'web-audio-beat-detector';

import type { AnalysisInput } from './draft-song-profile';

type AudioContextConstructor = new () => AudioContext;

function getAudioContextConstructor(): AudioContextConstructor {
  const globalAudio = globalThis as typeof globalThis & {
    webkitAudioContext?: AudioContextConstructor;
  };
  const context = globalAudio.AudioContext ?? globalAudio.webkitAudioContext;

  if (!context) {
    throw new Error('Audio analysis is only available in a browser with AudioContext support.');
  }

  return context;
}

export async function decodeAudioFile(file: File): Promise<AnalysisInput> {
  const AudioContextClass = getAudioContextConstructor();
  const context = new AudioContextClass();

  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = await context.decodeAudioData(arrayBuffer.slice(0));
    const channel =
      buffer.numberOfChannels > 0 ? buffer.getChannelData(0) : new Float32Array();
    const windowSize = 2_048;
    const energyFrames: Array<{ atMs: number; rms: number }> = [];

    for (let index = 0; index < channel.length; index += windowSize) {
      const slice = channel.subarray(index, index + windowSize);
      const rms = Math.sqrt(
        slice.reduce((sum, sample) => sum + sample * sample, 0) / Math.max(1, slice.length),
      );

      energyFrames.push({
        atMs: Math.round((index / buffer.sampleRate) * 1_000),
        rms,
      });
    }

    const bpm = Math.max(1, Math.round(await analyze(buffer)));
    const beatMs = 60_000 / bpm;

    return {
      title: file.name.replace(/\.[^.]+$/, ''),
      durationMs: Math.round(buffer.duration * 1_000),
      bpm,
      beatGridMs: Array.from(
        { length: Math.floor((buffer.duration * 1_000) / beatMs) },
        (_, beat) => Math.round(beat * beatMs),
      ),
      energyFrames,
      impactMoments: energyFrames
        .filter((frame) => frame.rms > 0.6)
        .map((frame) => frame.atMs)
        .slice(-4),
    };
  } finally {
    void context.close();
  }
}
