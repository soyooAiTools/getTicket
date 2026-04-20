import type {
  ControlRunRecord,
  NodePool,
  ScenarioTemplate,
} from '../../../../../packages/contracts/src';

import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { OverviewPageView } from './index';

describe('OverviewPageView', () => {
  it('surfaces seeded Chinese labels and recent ticket-task summaries', () => {
    const runs: ControlRunRecord[] = [
      {
        id: 'run-prod-01',
        templateId: 'template-release-window',
        nodePoolId: 'pool-control-01',
        mode: 'PREPROD',
        targetBaseUrl: 'https://preprod.example.com',
        status: 'RUNNING',
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
        createdAt: '2026-04-18T01:00:00.000Z',
        updatedAt: '2026-04-18T01:05:00.000Z',
      },
      {
        id: 'run-prod-00',
        templateId: 'template-smoke',
        nodePoolId: 'pool-observe-01',
        mode: 'OBSERVE_ONLY',
        targetBaseUrl: 'https://observe.example.com',
        status: 'COMPLETED',
        tags: {
          team: 'platform',
        },
        createdAt: '2026-04-18T00:00:00.000Z',
        updatedAt: '2026-04-18T00:40:00.000Z',
      },
    ];
    const nodePools: NodePool[] = [
      {
        id: 'pool-control-01',
        name: '香港核心节点池',
        region: 'hk',
        role: 'CONTROL',
        maxNodes: 3,
        nodeIds: ['node-01', 'node-02'],
      },
    ];
    const templates: ScenarioTemplate[] = [
      {
        id: 'template-release-window',
        name: '预发开售窗口演练',
        description: '用于完整开售链路的预发演练模板。',
        definition: {
          mode: 'PREPROD',
          targetBaseUrl: 'https://preprod.example.com',
          inventoryPoolId: 'inventory-main',
          maxGlobalQps: 300,
          maxNodeConcurrency: 48,
          tags: {
            profile: 'release',
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
        },
      },
    ];

    const html = renderToStaticMarkup(
      <MemoryRouter>
        <OverviewPageView
          error={undefined}
          loading={false}
          nodePools={nodePools}
          runs={runs}
          templates={templates}
        />
      </MemoryRouter>,
    );

    expect(html).toContain('作战总览');
    expect(html).toContain('香港核心节点池');
    expect(html).toContain('预发开售窗口演练');
    expect(html).toContain('周杰伦上海站');
    expect(html).toContain('内场票');
  });
});
