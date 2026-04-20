import type { NodePool, ScenarioTemplate, TicketTask } from '@ticketing/contracts';

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

function createTicketTask(
  overrides: Partial<TicketTask> = {},
): TicketTask {
  return {
    event: {
      platform: '大麦',
      eventName: '周杰伦嘉年华世界巡回演唱会',
      city: '上海',
      venue: '上海体育场',
      sessionLabel: '2026-05-01 19:30',
      saleStartsAt: '2026-04-25T12:00:00.000Z',
      ...overrides.event,
    },
    ticket: {
      tierLabel: '内场票',
      priceLabel: '980元',
      zoneLabel: 'A区',
      quantity: 2,
      ...overrides.ticket,
    },
    nodeStrategy: {
      poolId: 'pool-control-01',
      launchMode: 'SYNC_WITH_JITTER',
      preferredRegions: ['hk'],
      expectedNodeCount: 6,
      ...overrides.nodeStrategy,
    },
    executionStrategy: {
      objective: 'FULL_SUBMIT',
      prewarmSeconds: 30,
      workerLaunchIntervalMs: 1000,
      queuePollIntervalMs: 1500,
      lockRetryLimit: 3,
      orderSubmitLimit: 2,
      ...overrides.executionStrategy,
    },
  };
}

export const DEFAULT_NODE_POOLS: readonly NodePool[] = [
  {
    id: 'pool-control-01',
    name: '香港核心节点池',
    region: 'hk',
    role: 'CONTROL',
    maxNodes: 3,
    nodeIds: ['node-control-seed-01'],
  },
  {
    id: 'pool-observe-01',
    name: '香港观测节点池',
    region: 'hk',
    role: 'CONTROL',
    maxNodes: 2,
    nodeIds: ['node-observe-seed-01'],
  },
] as const;

export const DEFAULT_SCENARIO_TEMPLATES: readonly ScenarioTemplate[] = [
  {
    id: 'template-preprod-01',
    name: '预发开售窗口演练',
    description: '用于完整开售链路的预发演练模板。',
    definition: {
      mode: 'PREPROD',
      targetBaseUrl: 'https://preprod.example.com',
      inventoryPoolId: 'inventory-main',
      maxGlobalQps: 200,
      maxNodeConcurrency: 16,
      tags: {
        profile: 'preprod-release-window',
      },
      ticketTask: createTicketTask(),
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
    name: '只观测冒烟演练',
    description: '适合低风险链路观察和可用性冒烟验证。',
    definition: {
      mode: 'OBSERVE_ONLY',
      targetBaseUrl: 'https://preprod.example.com',
      maxGlobalQps: 120,
      maxNodeConcurrency: 16,
      tags: {
        profile: 'observe-only-smoke',
      },
      ticketTask: createTicketTask({
        nodeStrategy: {
          poolId: 'pool-observe-01',
          launchMode: 'STAGGERED',
          preferredRegions: ['hk'],
          expectedNodeCount: 2,
        },
        executionStrategy: {
          objective: 'QUEUE_ENTRY',
          prewarmSeconds: 20,
          workerLaunchIntervalMs: 1200,
          queuePollIntervalMs: 1800,
          lockRetryLimit: 0,
          orderSubmitLimit: 0,
        },
      }),
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
  {
    id: 'template-peak-lock-01',
    name: '开售瞬时锁票演练',
    description: '聚焦热点库存争抢和锁票阶段的瞬时冲击。',
    definition: {
      mode: 'PREPROD',
      targetBaseUrl: 'https://preprod.example.com',
      inventoryPoolId: 'inventory-main',
      maxGlobalQps: 260,
      maxNodeConcurrency: 24,
      tags: {
        profile: 'peak-lock-rehearsal',
      },
      ticketTask: createTicketTask({
        ticket: {
          tierLabel: '看台票',
          priceLabel: '580元',
          zoneLabel: '看台上层',
          quantity: 2,
        },
        executionStrategy: {
          objective: 'LOCK_ONLY',
          prewarmSeconds: 25,
          workerLaunchIntervalMs: 800,
          queuePollIntervalMs: 1200,
          lockRetryLimit: 4,
          orderSubmitLimit: 0,
        },
      }),
      requestTemplates: defaultRequestTemplates,
      phases: [
        {
          id: 'warmup',
          startsAtOffsetMs: 0,
          durationMs: 15000,
          queryConcurrency: 4,
          queuePollingConcurrency: 2,
          inventoryLockConcurrency: 0,
          orderSubmissionConcurrency: 0,
        },
        {
          id: 'peak-lock',
          startsAtOffsetMs: 15000,
          durationMs: 20000,
          queryConcurrency: 10,
          queuePollingConcurrency: 6,
          inventoryLockConcurrency: 8,
          orderSubmissionConcurrency: 0,
        },
      ],
    },
  },
] as const;
