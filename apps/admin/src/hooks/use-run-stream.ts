import type { LiveRunSnapshot } from '../../../../packages/contracts/src';

import { useEffect, useState } from 'react';

import { buildRunStreamUrl } from '../services/load-control';

export type RunStreamState = 'idle' | 'connecting' | 'open' | 'error';

export function useRunStream(runId: string | undefined) {
  const [snapshot, setSnapshot] = useState<LiveRunSnapshot>();
  const [error, setError] = useState<string>();
  const [state, setState] = useState<RunStreamState>('idle');

  useEffect(() => {
    if (!runId || typeof window === 'undefined' || !('EventSource' in window)) {
      setState('idle');
      return undefined;
    }

    setState('connecting');
    setError(undefined);

    const source = new window.EventSource(buildRunStreamUrl(runId));

    source.onopen = () => {
      setState('open');
      setError(undefined);
    };

    source.onmessage = (event) => {
      try {
        setSnapshot(JSON.parse(event.data) as LiveRunSnapshot);
        setState('open');
        setError(undefined);
      } catch {
        setState('error');
        setError('收到无法解析的实时遥测事件。');
      }
    };

    source.onerror = () => {
      setState('error');
      setError('实时遥测连接已断开。');
    };

    return () => {
      source.close();
    };
  }, [runId]);

  return {
    snapshot,
    error,
    state,
  };
}
