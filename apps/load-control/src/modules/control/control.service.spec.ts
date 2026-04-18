import { ControlService } from './control.service';

describe('ControlService', () => {
  const nodeRegistration = {
    id: 'node-01',
    region: 'ap-southeast-1',
    role: 'CONTROL' as const,
    networkProfile: {
      id: 'net-1',
      label: 'steady',
      baseLatencyMs: 25,
      jitterMs: 5,
      packetLossRatio: 0.01,
    },
    maxConcurrency: 12,
  };

  const runDefinition = {
    id: 'run-01',
    mode: 'PREPROD' as const,
    targetBaseUrl: 'https://preprod.example.com',
    inventoryPoolId: 'inventory-main',
    maxGlobalQps: 200,
    maxNodeConcurrency: 16,
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
        id: 'warmup',
        startsAtOffsetMs: 0,
        durationMs: 30000,
        queryConcurrency: 4,
        queuePollingConcurrency: 2,
        inventoryLockConcurrency: 2,
        orderSubmissionConcurrency: 1,
      },
    ],
  };

  const multiPhaseRunDefinition = {
    ...runDefinition,
    id: 'run-02',
    phases: [
      {
        id: 'warmup',
        startsAtOffsetMs: 0,
        durationMs: 30000,
        queryConcurrency: 4,
        queuePollingConcurrency: 2,
        inventoryLockConcurrency: 2,
        orderSubmissionConcurrency: 1,
      },
      {
        id: 'steady',
        startsAtOffsetMs: 30000,
        durationMs: 45000,
        queryConcurrency: 6,
        queuePollingConcurrency: 3,
        inventoryLockConcurrency: 2,
        orderSubmissionConcurrency: 2,
      },
    ],
  };

  const makeSummary = (overrides?: Partial<{
    runId: string;
    nodeId: string;
    region: string;
    role: 'ANCHOR' | 'EDGE' | 'CONTROL';
    mode: 'PREPROD';
    phaseIds: string[];
  }>) => ({
    runId: overrides?.runId ?? 'run-01',
    nodeId: overrides?.nodeId ?? 'node-01',
    region: overrides?.region ?? 'ap-southeast-1',
    role: overrides?.role ?? 'CONTROL',
    mode: overrides?.mode ?? 'PREPROD',
    averageRttMs: 28,
    startupSkewMs: 0,
    phaseSummaries: (overrides?.phaseIds ?? ['warmup']).map((phaseId) => ({
      phaseId,
      requestCount: 9,
      successCount: 9,
      averageLatencyMs: 18,
    })),
  });

  it('registerNode stores and returns a node registration', () => {
    const service = new ControlService();

    expect(service.registerNode(nodeRegistration)).toEqual(nodeRegistration);
    expect(service.listNodes()).toEqual([nodeRegistration]);
  });

  it('createRun stores a draft run snapshot', async () => {
    const service = new ControlService();

    await expect(service.createRun(runDefinition)).resolves.toEqual({
      definition: runDefinition,
      status: 'DRAFT',
      assignments: [],
      summaries: [],
    });
  });

  it('getRun throws for a missing run', async () => {
    const service = new ControlService();

    await expect(service.getRun('missing-run')).rejects.toThrow(
      'Unknown run: missing-run',
    );
  });

  it('reconstructs a persisted run when the in-memory map is empty', async () => {
    const persistedDefinition = {
      ...runDefinition,
      id: 'run-persisted',
    };
    const controlRepository = {
      getRun: jest.fn().mockResolvedValue({
        id: 'run-persisted',
        templateId: 'template-preprod-01',
        nodePoolId: 'pool-hk-anchor',
        mode: 'PREPROD',
        targetBaseUrl: 'https://preprod.example.com',
        status: 'DRAFT',
        tags: {
          team: 'growth',
        },
        createdAt: '2026-04-17T00:00:00.000Z',
        updatedAt: '2026-04-17T00:00:00.000Z',
        definition: persistedDefinition,
      }),
    };
    const service = new ControlService(
      undefined,
      undefined,
      controlRepository as never,
    );

    await expect(service.getRun('run-persisted')).resolves.toEqual({
      definition: persistedDefinition,
      status: 'DRAFT',
      assignments: [],
      summaries: [],
    });
    expect(controlRepository.getRun).toHaveBeenCalledWith('run-persisted');
  });

  it('keeps a planned run open until every assigned node has reported', async () => {
    const service = new ControlService();
    const secondNode = {
      ...nodeRegistration,
      id: 'node-02',
      region: 'ap-southeast-2',
    };

    service.registerNode(nodeRegistration);
    service.registerNode(secondNode);
    await service.createRun(runDefinition);
    await service.planRun(runDefinition.id);

    await expect(service.recordSummary('run-01', makeSummary())).resolves.toMatchObject({
      status: 'PLANNED',
    });

    await expect(
      service.recordSummary(
        'run-01',
        makeSummary({
          nodeId: 'node-02',
          region: 'ap-southeast-2',
        }),
      ),
    ).resolves.toMatchObject({
      status: 'COMPLETED',
    });
  });

  it('rejects summaries from nodes that are not assigned to the run', async () => {
    const service = new ControlService();

    service.registerNode(nodeRegistration);
    await service.createRun(runDefinition);
    await service.planRun(runDefinition.id);

    await expect(
      service.recordSummary(
        'run-01',
        makeSummary({
          nodeId: 'node-missing',
        }),
      ),
    ).rejects.toThrow('Node node-missing is not assigned to run run-01.');
  });

  it('rejects summaries that omit assigned phases and keeps the run open until a matching summary arrives', async () => {
    const service = new ControlService();
    const secondNode = {
      ...nodeRegistration,
      id: 'node-02',
      region: 'ap-southeast-2',
    };

    service.registerNode(nodeRegistration);
    service.registerNode(secondNode);
    await service.createRun(multiPhaseRunDefinition);
    await service.planRun(multiPhaseRunDefinition.id);

    await expect(
      service.recordSummary(
        'run-02',
        makeSummary({
          runId: 'run-02',
          phaseIds: ['warmup', 'steady'],
        }),
      ),
    ).resolves.toMatchObject({
      status: 'PLANNED',
    });

    await expect(
      service.recordSummary(
        'run-02',
        makeSummary({
          runId: 'run-02',
          nodeId: 'node-02',
          region: 'ap-southeast-2',
          phaseIds: ['warmup'],
        }),
      ),
    ).rejects.toThrow(
      'Summary for node node-02 must match assigned phases [steady, warmup]. Missing [steady].',
    );

    await expect(service.getRun('run-02')).resolves.toMatchObject({
      status: 'PLANNED',
      summaries: [
        {
          nodeId: 'node-01',
          phaseSummaries: [{ phaseId: 'warmup' }, { phaseId: 'steady' }],
        },
      ],
    });

    await expect(
      service.recordSummary(
        'run-02',
        makeSummary({
          runId: 'run-02',
          nodeId: 'node-02',
          region: 'ap-southeast-2',
          phaseIds: ['warmup', 'steady'],
        }),
      ),
    ).resolves.toMatchObject({
      status: 'COMPLETED',
    });
  });

  it('rejects summaries that include unexpected phases for the assigned node', async () => {
    const service = new ControlService();

    service.registerNode(nodeRegistration);
    await service.createRun(multiPhaseRunDefinition);
    await service.planRun(multiPhaseRunDefinition.id);

    await expect(
      service.recordSummary(
        'run-02',
        makeSummary({
          runId: 'run-02',
          phaseIds: ['warmup', 'steady', 'cooldown'],
        }),
      ),
    ).rejects.toThrow(
      'Summary for node node-01 must match assigned phases [steady, warmup]. Unexpected [cooldown].',
    );
  });
});
