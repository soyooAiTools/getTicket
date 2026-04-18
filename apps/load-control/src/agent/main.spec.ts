import type {
  NodeRunSummary,
  NodeTelemetrySample,
  PlannedNodeAssignment,
  ScenarioPhase,
} from '@ticketing/contracts';

import {
  readControlBaseUrl,
  readNodeRegistration,
  readRunId,
  bootstrap,
} from './main';
import type { AgentRunner, AgentRunnerRunHooks } from './agent-runner';
import type { ControlRunSnapshot, HttpControlClient } from './http-control.client';

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

  it('waits for RUNNING, streams telemetry, and submits the final summary', async () => {
    const phases: ScenarioPhase[] = [
      {
        id: 'phase-1',
        startsAtOffsetMs: 0,
        durationMs: 10,
        queryConcurrency: 1,
        queuePollingConcurrency: 0,
        inventoryLockConcurrency: 0,
        orderSubmissionConcurrency: 0,
      },
    ];
    const assignment: PlannedNodeAssignment = {
      runId: 'run-docs',
      nodeId: 'node-docs',
      region: 'ap-southeast-1',
      role: 'EDGE',
      mode: 'PREPROD',
      targetBaseUrl: 'https://target.example.com',
      networkProfile: {
        id: 'profile-docs',
        label: 'Docs profile',
        baseLatencyMs: 22,
        jitterMs: 6,
        packetLossRatio: 0.02,
      },
      requestTemplates: {
        query: { method: 'GET', path: '/catalog', timeoutMs: 500 },
        queue: { method: 'POST', path: '/queue', timeoutMs: 500 },
        inventoryLock: {
          method: 'POST',
          path: '/inventory/lock',
          timeoutMs: 500,
        },
        orderSubmit: {
          method: 'POST',
          path: '/orders',
          timeoutMs: 500,
        },
      },
      phases,
      tags: { team: 'growth' },
    };
    const summary: NodeRunSummary = {
      runId: 'run-docs',
      nodeId: 'node-docs',
      region: 'ap-southeast-1',
      role: 'EDGE',
      mode: 'PREPROD',
      averageRttMs: 22,
      startupSkewMs: 0,
      phaseSummaries: [
        {
          phaseId: 'phase-1',
          requestCount: 1,
          successCount: 1,
          averageLatencyMs: 22,
        },
      ],
    };
    const telemetrySample: NodeTelemetrySample = {
      runId: 'run-docs',
      nodeId: 'node-docs',
      phaseId: 'phase-1',
      status: 'BUSY',
      qps: 1.5,
      errorRate: 0,
      p95LatencyMs: 22,
      activeWorkers: 1,
      recordedAt: '2026-04-18T00:00:00.000Z',
    };
    const runs: ControlRunSnapshot[] = [
      {
        definition: {
          id: 'run-docs',
          mode: 'PREPROD',
          targetBaseUrl: 'https://target.example.com',
          inventoryPoolId: 'inventory-pool',
          maxGlobalQps: 20,
          maxNodeConcurrency: 5,
          tags: { team: 'growth' },
          requestTemplates: assignment.requestTemplates,
          phases,
        },
        status: 'PLANNED',
        assignments: [],
        summaries: [],
      },
      {
        definition: {
          id: 'run-docs',
          mode: 'PREPROD',
          targetBaseUrl: 'https://target.example.com',
          inventoryPoolId: 'inventory-pool',
          maxGlobalQps: 20,
          maxNodeConcurrency: 5,
          tags: { team: 'growth' },
          requestTemplates: assignment.requestTemplates,
          phases,
        },
        status: 'RUNNING',
        assignments: [assignment],
        summaries: [],
      },
      {
        definition: {
          id: 'run-docs',
          mode: 'PREPROD',
          targetBaseUrl: 'https://target.example.com',
          inventoryPoolId: 'inventory-pool',
          maxGlobalQps: 20,
          maxNodeConcurrency: 5,
          tags: { team: 'growth' },
          requestTemplates: assignment.requestTemplates,
          phases,
        },
        status: 'RUNNING',
        assignments: [assignment],
        summaries: [],
      },
      {
        definition: {
          id: 'run-docs',
          mode: 'PREPROD',
          targetBaseUrl: 'https://target.example.com',
          inventoryPoolId: 'inventory-pool',
          maxGlobalQps: 20,
          maxNodeConcurrency: 5,
          tags: { team: 'growth' },
          requestTemplates: assignment.requestTemplates,
          phases,
        },
        status: 'STOPPED',
        assignments: [assignment],
        summaries: [],
      },
    ];
    const telemetrySamples: NodeTelemetrySample[] = [];
    const submittedSummaries: NodeRunSummary[] = [];

    const controlClient: Pick<
      HttpControlClient,
      'registerNode' | 'getRun' | 'postTelemetry' | 'submitSummary'
    > = {
      async registerNode(node) {
        return node;
      },
      async getRun() {
        return runs.shift() ?? runs[0];
      },
      async postTelemetry(runId, sample) {
        expect(runId).toBe('run-docs');
        telemetrySamples.push(sample);
        return sample;
      },
      async submitSummary(runId, value) {
        expect(runId).toBe('run-docs');
        submittedSummaries.push(value);
        return value;
      },
    };

    const runner: Pick<AgentRunner, 'runAssignment'> = {
      async runAssignment(assignmentArg, hooks: AgentRunnerRunHooks) {
        expect(assignmentArg.nodeId).toBe('node-docs');
        await hooks.onTelemetry?.(telemetrySample);
        expect(await hooks.shouldStop?.()).toBe(false);
        expect(await hooks.shouldStop?.()).toBe(true);
        return summary;
      },
    };

    await bootstrap(
      {
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
      },
      {
        controlClient: controlClient as HttpControlClient,
        runner: runner as AgentRunner,
        sleep: async () => undefined,
        statusPollIntervalMs: 0,
      },
    );

    expect(telemetrySamples).toEqual([telemetrySample]);
    expect(submittedSummaries).toEqual([summary]);
  });
});
