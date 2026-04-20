import {
  type PlannedNodeAssignment,
  type ScenarioPhase,
} from '@ticketing/contracts';

import {
  AgentRunner,
  type AgentRunnerScheduler,
  type ProbeRequest,
  type TargetProbe,
} from './agent-runner';

const testWorkerLaunchIntervalMs = 1;

class FakeScheduler implements AgentRunnerScheduler {
  private currentTimeMs = 0;
  private sleepers: Array<{ wakeAtMs: number; resolve: () => void }> = [];

  now(): number {
    return this.currentTimeMs;
  }

  sleep(ms: number): Promise<void> {
    if (ms <= 0) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      this.sleepers.push({
        wakeAtMs: this.currentTimeMs + ms,
        resolve,
      });
    });
  }

  async advanceBy(ms: number): Promise<void> {
    await this.advanceTo(this.currentTimeMs + ms);
  }

  private async advanceTo(targetTimeMs: number): Promise<void> {
    let nextWakeAtMs = Math.min(
      ...this.sleepers.map((sleep) => sleep.wakeAtMs),
      Number.POSITIVE_INFINITY,
    );

    while (nextWakeAtMs <= targetTimeMs) {

      this.currentTimeMs = nextWakeAtMs;
      const ready = this.sleepers.filter(
        (sleep) => sleep.wakeAtMs === nextWakeAtMs,
      );
      this.sleepers = this.sleepers.filter(
        (sleep) => sleep.wakeAtMs !== nextWakeAtMs,
      );

      ready.forEach((sleep) => sleep.resolve());
      await flushMicrotasks();

      nextWakeAtMs = Math.min(
        ...this.sleepers.map((sleep) => sleep.wakeAtMs),
        Number.POSITIVE_INFINITY,
      );
    }

    this.currentTimeMs = targetTimeMs;
    await flushMicrotasks();
  }

  async runUntilSettled<T>(
    promise: Promise<T>,
    maxTicks = 100,
  ): Promise<T> {
    let settled = false;
    let value: T | undefined;
    let failure: unknown;

    promise.then(
      (result) => {
        settled = true;
        value = result;
      },
      (error) => {
        settled = true;
        failure = error;
      },
    );

    for (let tick = 0; tick < maxTicks && !settled; tick += 1) {
      await this.advanceBy(1);
    }

    if (!settled) {
      throw new Error('Timed out while waiting for fake-time work to settle.');
    }

    if (failure) {
      throw failure;
    }

    return value as T;
  }
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

function createAssignment(phases: ScenarioPhase[]): PlannedNodeAssignment {
  return {
    runId: 'run-01',
    nodeId: 'node-a',
    region: 'ap-southeast-1',
    role: 'ANCHOR',
    mode: 'PREPROD',
    targetBaseUrl: 'https://preprod.example.com',
    networkProfile: {
      id: 'net-1',
      label: 'steady',
      baseLatencyMs: 25,
      jitterMs: 5,
      packetLossRatio: 0.01,
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
    phases,
    tags: {
      team: 'growth',
    },
  };
}

function createRunner(
  probe: TargetProbe,
  scheduler: AgentRunnerScheduler,
  workerLaunchIntervalMs = testWorkerLaunchIntervalMs,
): AgentRunner {
  return new AgentRunner(probe, scheduler, { workerLaunchIntervalMs });
}

describe('AgentRunner', () => {
  it('aggregates repeated requests across the phase duration window', async () => {
    const scheduler = new FakeScheduler();
    let requestCount = 0;

    const probe: TargetProbe = {
      async execute() {
        requestCount += 1;
        await scheduler.sleep(1);

        return { success: true, latencyMs: 18 };
      },
    };
    const runner = createRunner(probe, scheduler);

    const summary = await scheduler.runUntilSettled(
      runner.runAssignment(
        createAssignment([
          {
            id: 'warmup',
            startsAtOffsetMs: 0,
            durationMs: 1,
            queryConcurrency: 3,
            queuePollingConcurrency: 2,
            inventoryLockConcurrency: 1,
            orderSubmissionConcurrency: 1,
          },
        ]),
      ),
    );

    expect(requestCount).toBe(7);
    expect(summary.phaseSummaries).toEqual([
      {
        phaseId: 'warmup',
        requestCount: 7,
        successCount: 7,
        averageLatencyMs: 18,
      },
    ]);
    expect(summary.averageRttMs).toBe(28);
  });

  it('waits for each phase start offset before starting its workers', async () => {
    const scheduler = new FakeScheduler();
    const phaseStartTimes = new Map<string, number[]>();

    const probe: TargetProbe = {
      async execute({ phase }: ProbeRequest) {
        phaseStartTimes.set(phase.id, [
          ...(phaseStartTimes.get(phase.id) ?? []),
          scheduler.now(),
        ]);
        await scheduler.sleep(5);

        return { success: true, latencyMs: 5 };
      },
    };
    const runner = createRunner(probe, scheduler);

    await scheduler.runUntilSettled(
      runner.runAssignment(
        createAssignment([
          {
            id: 'warmup',
            startsAtOffsetMs: 0,
            durationMs: 5,
            queryConcurrency: 1,
            queuePollingConcurrency: 0,
            inventoryLockConcurrency: 0,
            orderSubmissionConcurrency: 0,
          },
          {
            id: 'main',
            startsAtOffsetMs: 20,
            durationMs: 5,
            queryConcurrency: 1,
            queuePollingConcurrency: 0,
            inventoryLockConcurrency: 0,
            orderSubmissionConcurrency: 0,
          },
        ]),
      ),
    );

    expect(phaseStartTimes.get('warmup')).toEqual([0]);
    expect(phaseStartTimes.get('main')).toEqual([20]);
  });

  it('honors offsets from a shared assignment start time even when phases are unordered', async () => {
    const scheduler = new FakeScheduler();
    const phaseStartEvents: Array<{ phaseId: string; startedAtMs: number }> = [];

    const probe: TargetProbe = {
      async execute({ phase }: ProbeRequest) {
        phaseStartEvents.push({
          phaseId: phase.id,
          startedAtMs: scheduler.now(),
        });
        await scheduler.sleep(5);

        return { success: true, latencyMs: 5 };
      },
    };
    const runner = createRunner(probe, scheduler);

    await scheduler.runUntilSettled(
      runner.runAssignment(
        createAssignment([
          {
            id: 'late',
            startsAtOffsetMs: 20,
            durationMs: 5,
            queryConcurrency: 1,
            queuePollingConcurrency: 0,
            inventoryLockConcurrency: 0,
            orderSubmissionConcurrency: 0,
          },
          {
            id: 'early',
            startsAtOffsetMs: 0,
            durationMs: 5,
            queryConcurrency: 1,
            queuePollingConcurrency: 0,
            inventoryLockConcurrency: 0,
            orderSubmissionConcurrency: 0,
          },
        ]),
      ),
    );

    expect(phaseStartEvents).toEqual([
      { phaseId: 'early', startedAtMs: 0 },
      { phaseId: 'late', startedAtMs: 20 },
    ]);
  });

  it('repeats a single worker until the phase window closes', async () => {
    const scheduler = new FakeScheduler();
    const startTimes: number[] = [];

    const probe: TargetProbe = {
      async execute({ requestIndex }: ProbeRequest) {
        startTimes.push(scheduler.now());
        expect(requestIndex).toBe(0);
        await scheduler.sleep(5);

        return { success: true, latencyMs: 5 };
      },
    };
    const runner = createRunner(probe, scheduler);

    const summary = await scheduler.runUntilSettled(
      runner.runAssignment(
        createAssignment([
          {
            id: 'sustain',
            startsAtOffsetMs: 0,
            durationMs: 14,
            queryConcurrency: 1,
            queuePollingConcurrency: 0,
            inventoryLockConcurrency: 0,
            orderSubmissionConcurrency: 0,
          },
        ]),
      ),
    );

    expect(startTimes).toEqual([0, 5, 10]);
    expect(summary.phaseSummaries).toEqual([
      {
        phaseId: 'sustain',
        requestCount: 3,
        successCount: 3,
        averageLatencyMs: 5,
      },
    ]);
  });

  it('preserves concurrent overlap while workers repeat within a phase', async () => {
    const scheduler = new FakeScheduler();
    let inFlightCount = 0;
    let maxInFlightCount = 0;
    const startTimesByWorker = new Map<number, number[]>();

    const probe: TargetProbe = {
      async execute({ requestIndex }: ProbeRequest) {
        startTimesByWorker.set(requestIndex, [
          ...(startTimesByWorker.get(requestIndex) ?? []),
          scheduler.now(),
        ]);
        inFlightCount += 1;
        maxInFlightCount = Math.max(maxInFlightCount, inFlightCount);

        try {
          await scheduler.sleep(5);
          return { success: true, latencyMs: 5 };
        } finally {
          inFlightCount -= 1;
        }
      },
    };
    const runner = createRunner(probe, scheduler);

    const summary = await scheduler.runUntilSettled(
      runner.runAssignment(
        createAssignment([
          {
            id: 'main',
            startsAtOffsetMs: 0,
            durationMs: 11,
            queryConcurrency: 2,
            queuePollingConcurrency: 0,
            inventoryLockConcurrency: 0,
            orderSubmissionConcurrency: 0,
          },
        ]),
      ),
    );

    expect(maxInFlightCount).toBe(2);
    expect(startTimesByWorker.get(0)).toEqual([0, 5, 10]);
    expect(startTimesByWorker.get(1)).toEqual([0, 5, 10]);
    expect(summary.phaseSummaries).toEqual([
      {
        phaseId: 'main',
        requestCount: 6,
        successCount: 6,
        averageLatencyMs: 5,
      },
    ]);
  });

  it('caps fast worker relaunches to the configured lane interval', async () => {
    const scheduler = new FakeScheduler();
    const startTimesByWorker = new Map<number, number[]>();

    const probe: TargetProbe = {
      async execute({ requestIndex }: ProbeRequest) {
        startTimesByWorker.set(requestIndex, [
          ...(startTimesByWorker.get(requestIndex) ?? []),
          scheduler.now(),
        ]);
        await scheduler.sleep(1);

        return { success: true, latencyMs: 1 };
      },
    };
    const runner = createRunner(probe, scheduler, 10);

    const summary = await scheduler.runUntilSettled(
      runner.runAssignment(
        createAssignment([
          {
            id: 'main',
            startsAtOffsetMs: 0,
            durationMs: 12,
            queryConcurrency: 2,
            queuePollingConcurrency: 0,
            inventoryLockConcurrency: 0,
            orderSubmissionConcurrency: 0,
          },
        ]),
      ),
    );

    expect(startTimesByWorker.get(0)).toEqual([0, 10]);
    expect(startTimesByWorker.get(1)).toEqual([0, 10]);
    expect(summary.phaseSummaries).toEqual([
      {
        phaseId: 'main',
        requestCount: 4,
        successCount: 4,
        averageLatencyMs: 1,
      },
    ]);
  });
});
