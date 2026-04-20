export interface PreviewWindowInput {
  beatGridMs: number[];
  durationMs: number;
}

export interface PreviewRange {
  startMs: number;
  endMs: number;
}

export interface PreviewWindow extends PreviewRange {
  seed: string;
}

export function buildPreviewWindow(
  input: PreviewWindowInput,
  selection: PreviewRange,
): PreviewWindow {
  const beatsBefore = input.beatGridMs.filter((beat) => beat < selection.startMs);
  const prerollBeat =
    beatsBefore.length >= 2
      ? beatsBefore[beatsBefore.length - 2]
      : beatsBefore.length === 1
        ? beatsBefore[0]
        : 0;
  const startMs = Math.max(0, prerollBeat);
  const endMs = Math.min(input.durationMs, selection.endMs);

  return {
    startMs,
    endMs,
    seed: `${startMs}:${endMs}`,
  };
}
