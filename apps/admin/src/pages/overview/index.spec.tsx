import type { ControlRunRecord, NodePool, ScenarioTemplate } from '../../../../../packages/contracts/src';

import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { OverviewPageView } from './index';

describe('OverviewPageView', () => {
  it('summarizes the catalog and recent run state for operators', () => {
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
        createdAt: '2026-04-18T01:00:00.000Z',
        updatedAt: '2026-04-18T01:05:00.000Z',
      },
      {
        id: 'run-prod-00',
        templateId: 'template-smoke',
        nodePoolId: 'pool-control-02',
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
        name: 'Control pool',
        region: 'ap-southeast-1',
        role: 'CONTROL',
        maxNodes: 3,
        nodeIds: ['node-01', 'node-02'],
      },
    ];
    const templates: ScenarioTemplate[] = [
      {
        id: 'template-release-window',
        name: 'Release window',
        description: 'Baseline release rehearsal.',
        definition: {
          mode: 'PREPROD',
          targetBaseUrl: 'https://preprod.example.com',
          inventoryPoolId: 'inventory-main',
          maxGlobalQps: 300,
          maxNodeConcurrency: 48,
          tags: {
            profile: 'release',
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

    expect(html).toContain('Operator overview');
    expect(html).toContain('Active runs');
    expect(html).toContain('Release window');
    expect(html).toContain('run-prod-01');
  });
});
