import type { NodePool, ScenarioTemplate } from '@ticketing/contracts';

const defaultRequestTemplates = {
  query: {
    method: 'GET' as const,
    path: '/catalog',
    timeoutMs: 500,
  },
  queue: {
    method: 'POST' as const,
    path: '/queue',
    timeoutMs: 500,
  },
  inventoryLock: {
    method: 'POST' as const,
    path: '/inventory/lock',
    timeoutMs: 500,
  },
  orderSubmit: {
    method: 'POST' as const,
    path: '/orders',
    timeoutMs: 500,
  },
};

export const DEFAULT_NODE_POOLS: readonly NodePool[] = [
  {
    id: 'pool-control-01',
    name: 'Control pool',
    region: 'ap-southeast-1',
    role: 'CONTROL',
    maxNodes: 3,
    nodeIds: ['node-control-seed-01'],
  },
  {
    id: 'pool-observe-01',
    name: 'Observe pool',
    region: 'ap-southeast-1',
    role: 'CONTROL',
    maxNodes: 2,
    nodeIds: ['node-observe-seed-01'],
  },
] as const;

export const DEFAULT_SCENARIO_TEMPLATES: readonly ScenarioTemplate[] = [
  {
    id: 'template-preprod-01',
    name: 'Preprod release window',
    description: 'Baseline pre-production release window profile.',
    definition: {
      mode: 'PREPROD',
      targetBaseUrl: 'https://preprod.example.com',
      inventoryPoolId: 'inventory-main',
      maxGlobalQps: 200,
      maxNodeConcurrency: 16,
      tags: {
        profile: 'preprod-release-window',
      },
      requestTemplates: defaultRequestTemplates,
      phases: [
        {
          id: 'warmup',
          startsAtOffsetMs: 0,
          durationMs: 30000,
          queryConcurrency: 4,
          queuePollingConcurrency: 2,
          inventoryLockConcurrency: 0,
          orderSubmissionConcurrency: 0,
        },
      ],
    },
  },
  {
    id: 'template-observe-01',
    name: 'Observe-only smoke',
    description: 'Low-risk observe-only smoke validation.',
    definition: {
      mode: 'OBSERVE_ONLY',
      targetBaseUrl: 'https://preprod.example.com',
      maxGlobalQps: 120,
      maxNodeConcurrency: 16,
      tags: {
        profile: 'observe-only-smoke',
      },
      requestTemplates: defaultRequestTemplates,
      phases: [
        {
          id: 'observe',
          startsAtOffsetMs: 0,
          durationMs: 30000,
          queryConcurrency: 4,
          queuePollingConcurrency: 2,
          inventoryLockConcurrency: 0,
          orderSubmissionConcurrency: 0,
        },
      ],
    },
  },
] as const;
