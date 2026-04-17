import { ScenarioEngineService } from './scenario-engine.service';

describe('ScenarioEngineService', () => {
  const createRunDefinition = (overrides: Record<string, unknown> = {}) => ({
    id: 'run-01',
    mode: 'PREPROD' as const,
    targetBaseUrl: 'https://preprod.example.com',
    inventoryPoolId: 'inventory-main',
    maxGlobalQps: 400,
    maxNodeConcurrency: 149,
    tags: {
      team: 'growth',
      release: '2026-04-17',
    },
    requestTemplates: {
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
    },
    phases: [
      {
        id: 'ramp-01',
        startsAtOffsetMs: 0,
        durationMs: 30000,
        queryConcurrency: 100,
        queuePollingConcurrency: 50,
        inventoryLockConcurrency: 24,
        orderSubmissionConcurrency: 8,
      },
    ],
    ...overrides,
  });

  const createNode = (
    id: string,
    maxConcurrency: number,
    overrides: Record<string, unknown> = {},
  ) => ({
    id,
    region: `${id}-region`,
    role: 'EDGE' as const,
    networkProfile: {
      id: `${id}-net`,
      label: `${id}-profile`,
      baseLatencyMs: 25,
      jitterMs: 5,
      packetLossRatio: 0.01,
    },
    maxConcurrency,
    ...overrides,
  });

  const phaseTotal = (phase: {
    queryConcurrency: number;
    queuePollingConcurrency: number;
    inventoryLockConcurrency: number;
    orderSubmissionConcurrency: number;
  }) =>
    phase.queryConcurrency +
    phase.queuePollingConcurrency +
    phase.inventoryLockConcurrency +
    phase.orderSubmissionConcurrency;

  const aggregatePools = (
    phases: Array<{
      queryConcurrency: number;
      queuePollingConcurrency: number;
      inventoryLockConcurrency: number;
      orderSubmissionConcurrency: number;
    }>,
  ) =>
    phases.reduce(
      (totals, phase) => ({
        queryConcurrency: totals.queryConcurrency + phase.queryConcurrency,
        queuePollingConcurrency:
          totals.queuePollingConcurrency + phase.queuePollingConcurrency,
        inventoryLockConcurrency:
          totals.inventoryLockConcurrency + phase.inventoryLockConcurrency,
        orderSubmissionConcurrency:
          totals.orderSubmissionConcurrency + phase.orderSubmissionConcurrency,
      }),
      {
        queryConcurrency: 0,
        queuePollingConcurrency: 0,
        inventoryLockConcurrency: 0,
        orderSubmissionConcurrency: 0,
      },
    );

  it('plans one assignment per registered node and distributes each phase from a global budget', () => {
    const service = new ScenarioEngineService();

    const runDefinition = createRunDefinition();
    const nodes = [
      createNode('node-a', 200, {
        region: 'ap-southeast-1',
        role: 'ANCHOR' as const,
      }),
      createNode('node-b', 60, {
        region: 'ap-southeast-2',
      }),
    ];

    const assignments = service.planRun(runDefinition, nodes);

    expect(assignments).toHaveLength(2);
    expect(assignments[0]).toMatchObject({
      runId: 'run-01',
      nodeId: 'node-a',
      region: 'ap-southeast-1',
      role: 'ANCHOR',
      mode: 'PREPROD',
      targetBaseUrl: 'https://preprod.example.com',
      networkProfile: nodes[0].networkProfile,
      requestTemplates: runDefinition.requestTemplates,
      tags: runDefinition.tags,
    });
    expect(assignments[0].phases[0]).toMatchObject({
      id: 'ramp-01',
      queryConcurrency: 71,
      queuePollingConcurrency: 36,
      inventoryLockConcurrency: 17,
      orderSubmissionConcurrency: 6,
    });
    expect(assignments[1].phases[0]).toMatchObject({
      id: 'ramp-01',
      queryConcurrency: 29,
      queuePollingConcurrency: 14,
      inventoryLockConcurrency: 7,
      orderSubmissionConcurrency: 2,
    });
    expect(
      phaseTotal(assignments[0].phases[0]) + phaseTotal(assignments[1].phases[0]),
    ).toBe(182);
  });

  it('does not assign more aggregate concurrency than maxGlobalQps for a phase', () => {
    const service = new ScenarioEngineService();

    const runDefinition = createRunDefinition({
      maxGlobalQps: 90,
      maxNodeConcurrency: 200,
      phases: [
        {
          id: 'steady-01',
          startsAtOffsetMs: 0,
          durationMs: 45000,
          queryConcurrency: 60,
          queuePollingConcurrency: 60,
          inventoryLockConcurrency: 30,
          orderSubmissionConcurrency: 10,
        },
      ],
    });
    const nodes = [
      createNode('node-a', 80),
      createNode('node-b', 80),
      createNode('node-c', 80),
    ];

    const assignments = service.planRun(runDefinition, nodes);
    const totalAssigned = assignments.reduce(
      (sum, assignment) => sum + phaseTotal(assignment.phases[0]),
      0,
    );

    expect(assignments).toHaveLength(3);
    expect(totalAssigned).toBe(90);
    expect(totalAssigned).toBeLessThanOrEqual(runDefinition.maxGlobalQps);
    expect(assignments.map((assignment) => phaseTotal(assignment.phases[0]))).toEqual([
      30,
      30,
      30,
    ]);
  });

  it('distributes a multi-node phase deterministically from node caps and pool ratios', () => {
    const service = new ScenarioEngineService();

    const runDefinition = createRunDefinition({
      maxGlobalQps: 11,
      maxNodeConcurrency: 20,
      phases: [
        {
          id: 'burst-01',
          startsAtOffsetMs: 1000,
          durationMs: 15000,
          queryConcurrency: 8,
          queuePollingConcurrency: 5,
          inventoryLockConcurrency: 4,
          orderSubmissionConcurrency: 3,
        },
      ],
    });
    const nodes = [
      createNode('node-a', 7),
      createNode('node-b', 5),
      createNode('node-c', 4),
    ];

    const assignments = service.planRun(runDefinition, nodes);

    expect(assignments.map((assignment) => phaseTotal(assignment.phases[0]))).toEqual([
      5,
      3,
      3,
    ]);
    expect(assignments[0].phases[0]).toMatchObject({
      id: 'burst-01',
      queryConcurrency: 2,
      queuePollingConcurrency: 1,
      inventoryLockConcurrency: 1,
      orderSubmissionConcurrency: 1,
    });
    expect(assignments[1].phases[0]).toMatchObject({
      id: 'burst-01',
      queryConcurrency: 1,
      queuePollingConcurrency: 1,
      inventoryLockConcurrency: 1,
      orderSubmissionConcurrency: 0,
    });
    expect(assignments[2].phases[0]).toMatchObject({
      id: 'burst-01',
      queryConcurrency: 1,
      queuePollingConcurrency: 1,
      inventoryLockConcurrency: 0,
      orderSubmissionConcurrency: 1,
    });
    expect(aggregatePools(assignments.map((assignment) => assignment.phases[0]))).toEqual({
      queryConcurrency: 4,
      queuePollingConcurrency: 3,
      inventoryLockConcurrency: 2,
      orderSubmissionConcurrency: 2,
    });
  });

  it('keeps tiny global pool splits from drifting across nodes', () => {
    const service = new ScenarioEngineService();

    const runDefinition = createRunDefinition({
      maxGlobalQps: 2,
      maxNodeConcurrency: 1,
      phases: [
        {
          id: 'tiny-01',
          startsAtOffsetMs: 0,
          durationMs: 10000,
          queryConcurrency: 1,
          queuePollingConcurrency: 1,
          inventoryLockConcurrency: 0,
          orderSubmissionConcurrency: 0,
        },
      ],
    });
    const nodes = [createNode('node-a', 1), createNode('node-b', 1)];

    const assignments = service.planRun(runDefinition, nodes);

    expect(assignments.map((assignment) => phaseTotal(assignment.phases[0]))).toEqual([1, 1]);
    expect(assignments[0].phases[0]).toMatchObject({
      id: 'tiny-01',
      queryConcurrency: 1,
      queuePollingConcurrency: 0,
      inventoryLockConcurrency: 0,
      orderSubmissionConcurrency: 0,
    });
    expect(assignments[1].phases[0]).toMatchObject({
      id: 'tiny-01',
      queryConcurrency: 0,
      queuePollingConcurrency: 1,
      inventoryLockConcurrency: 0,
      orderSubmissionConcurrency: 0,
    });
    expect(aggregatePools(assignments.map((assignment) => assignment.phases[0]))).toEqual({
      queryConcurrency: 1,
      queuePollingConcurrency: 1,
      inventoryLockConcurrency: 0,
      orderSubmissionConcurrency: 0,
    });
  });
});
