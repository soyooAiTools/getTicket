import { readControlBaseUrl, readNodeRegistration, readRunId } from './main';

describe('synthetic agent bootstrap env contract', () => {
  it('reads the documented LOAD_CONTROL_* and NODE_* variables', () => {
    const env = {
      LOAD_CONTROL_BASE_URL: 'https://control.example.com/control',
      LOAD_CONTROL_RUN_ID: 'run-docs',
      NODE_ID: 'node-docs',
      NODE_REGION: 'ap-southeast-1',
      NODE_ROLE: 'EDGE',
      NODE_PROFILE_ID: 'profile-docs',
      NODE_PROFILE_LABEL: 'Docs profile',
      NODE_BASE_LATENCY_MS: '22',
      NODE_JITTER_MS: '6',
      NODE_PACKET_LOSS_RATIO: '0.02',
      NODE_MAX_CONCURRENCY: '48',
    };

    expect(readControlBaseUrl(env)).toBe(
      'https://control.example.com/control',
    );
    expect(readRunId(env)).toBe('run-docs');
    expect(readNodeRegistration(env)).toEqual({
      id: 'node-docs',
      region: 'ap-southeast-1',
      role: 'EDGE',
      networkProfile: {
        id: 'profile-docs',
        label: 'Docs profile',
        baseLatencyMs: 22,
        jitterMs: 6,
        packetLossRatio: 0.02,
      },
      maxConcurrency: 48,
    });
  });

  it('keeps legacy variables working as a fallback', () => {
    const env = {
      LOAD_CONTROL_URL: 'https://legacy.example.com/control',
      LOAD_AGENT_RUN_ID: 'run-legacy',
      LOAD_AGENT_NODE_ID: 'node-legacy',
      LOAD_AGENT_REGION: 'us-west-2',
      LOAD_AGENT_ROLE: 'CONTROL',
      LOAD_AGENT_NETWORK_PROFILE_ID: 'profile-legacy',
      LOAD_AGENT_NETWORK_PROFILE_LABEL: 'Legacy profile',
      LOAD_AGENT_BASE_LATENCY_MS: '40',
      LOAD_AGENT_JITTER_MS: '8',
      LOAD_AGENT_PACKET_LOSS_RATIO: '0.05',
      LOAD_AGENT_MAX_CONCURRENCY: '12',
    };

    expect(readControlBaseUrl(env)).toBe(
      'https://legacy.example.com/control',
    );
    expect(readRunId(env)).toBe('run-legacy');
    expect(readNodeRegistration(env)).toEqual({
      id: 'node-legacy',
      region: 'us-west-2',
      role: 'CONTROL',
      networkProfile: {
        id: 'profile-legacy',
        label: 'Legacy profile',
        baseLatencyMs: 40,
        jitterMs: 8,
        packetLossRatio: 0.05,
      },
      maxConcurrency: 12,
    });
  });
});
