import type {
  LiveRunSnapshot,
  LoadTestRunDefinition,
  NodeRunSummary,
  PlannedNodeAssignment,
} from '../../../../../packages/contracts/src';

import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { RunDetailPageView } from './index';

describe('RunDetailPageView', () => {
  it('renders the ticket-task summary alongside assignments and live telemetry', () => {
    const definition: LoadTestRunDefinition = {
      id: 'run-live-01',
      mode: 'PREPROD',
      targetBaseUrl: 'https://preprod.example.com',
      inventoryPoolId: 'inventory-main',
      maxGlobalQps: 300,
      maxNodeConcurrency: 48,
      tags: {
        team: 'growth',
      },
      ticketTask: {
        event: {
          platform: '大麦',
          eventName: '周杰伦上海站',
          city: '上海',
          venue: '上海体育场',
          sessionLabel: '2026-05-01 19:30',
          saleStartsAt: '2026-04-25T12:00:00.000Z',
        },
        ticket: {
          tierLabel: '内场票',
          priceLabel: '980元',
          zoneLabel: 'A区',
          quantity: 2,
        },
        nodeStrategy: {
          poolId: 'pool-control-01',
          launchMode: 'SYNC_WITH_JITTER',
          preferredRegions: ['hk'],
          expectedNodeCount: 6,
        },
        executionStrategy: {
          objective: 'FULL_SUBMIT',
          prewarmSeconds: 30,
          workerLaunchIntervalMs: 1000,
          queuePollIntervalMs: 1500,
          lockRetryLimit: 3,
          orderSubmitLimit: 2,
        },
      },
      requestTemplates: {
        query: {
          method: 'GET',
          path: '/catalog',
          timeoutMs: 500,
        },
        queue: {
          method: 'POST',
          path: '/queue',
          timeoutMs: 500,
        },
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
      phases: [
        {
          id: 'warmup',
          startsAtOffsetMs: 0,
          durationMs: 30000,
          queryConcurrency: 4,
          queuePollingConcurrency: 2,
          inventoryLockConcurrency: 1,
          orderSubmissionConcurrency: 1,
        },
      ],
    };
    const assignments: PlannedNodeAssignment[] = [
      {
        runId: 'run-live-01',
        nodeId: 'node-01',
        region: 'ap-southeast-1',
        role: 'CONTROL',
        mode: 'PREPROD',
        targetBaseUrl: 'https://preprod.example.com',
        networkProfile: {
          id: 'steady',
          label: 'Steady',
          baseLatencyMs: 18,
          jitterMs: 4,
          packetLossRatio: 0.001,
        },
        requestTemplates: definition.requestTemplates,
        phases: definition.phases,
        tags: definition.tags,
      },
    ];
    const summaries: NodeRunSummary[] = [
      {
        runId: 'run-live-01',
        nodeId: 'node-01',
        region: 'ap-southeast-1',
        role: 'CONTROL',
        mode: 'PREPROD',
        averageRttMs: 22,
        startupSkewMs: 3,
        phaseSummaries: [
          {
            phaseId: 'warmup',
            requestCount: 120,
            successCount: 118,
            averageLatencyMs: 180,
          },
        ],
      },
    ];
    const liveSnapshot: LiveRunSnapshot = {
      runId: 'run-live-01',
      status: 'RUNNING',
      currentPhaseId: 'warmup',
      aggregateQps: 64,
      aggregateErrorRate: 0.02,
      aggregateP95LatencyMs: 290,
      activeNodeCount: 1,
      unhealthyNodeCount: 0,
      nodes: [
        {
          nodeId: 'node-01',
          region: 'ap-southeast-1',
          role: 'CONTROL',
          status: 'ONLINE',
          phaseId: 'warmup',
          qps: 64,
          errorRate: 0.02,
          p95LatencyMs: 290,
          activeWorkers: 8,
          recordedAt: '2026-04-18T02:00:00.000Z',
        },
      ],
      alerts: [],
      updatedAt: '2026-04-18T02:00:00.000Z',
    };

    const html = renderToStaticMarkup(
      <MemoryRouter>
        <RunDetailPageView
          error={undefined}
          liveSnapshot={liveSnapshot}
          loading={false}
          run={{
            assignments,
            definition,
            status: 'RUNNING',
            summaries,
          }}
          streamError={undefined}
          streamState='open'
        />
      </MemoryRouter>,
    );

    expect(html).toContain('任务作战台');
    expect(html).toContain('run-live-01');
    expect(html).toContain('周杰伦上海站');
    expect(html).toContain('内场票');
    expect(html).toContain('980元');
    expect(html).toContain('2张');
    expect(html).toContain('warmup');
    expect(html).toContain('node-01');
    expect(html).toContain('64');
  });
});
