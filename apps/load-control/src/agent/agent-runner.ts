import {
  type NodeRunSummary,
  type PlannedNodeAssignment,
  type RequestTemplate,
  type ScenarioPhase,
} from '@ticketing/contracts';

export type RequestPool =
  | 'query'
  | 'queue'
  | 'inventoryLock'
  | 'orderSubmit';

export type ProbeRequest = {
  assignment: PlannedNodeAssignment;
  phase: ScenarioPhase;
  pool: RequestPool;
  requestTemplate: RequestTemplate;
  requestIndex: number;
};

export type ProbeResult = {
  success: boolean;
  latencyMs: number;
};

export interface TargetProbe {
  execute(request: ProbeRequest): Promise<ProbeResult>;
}

export interface AgentRunnerScheduler {
  now(): number;
  sleep(ms: number): Promise<void>;
}

export interface AgentRunnerOptions {
  workerLaunchIntervalMs?: number;
}

const phasePoolPlan: Array<{
  pool: RequestPool;
  key: keyof ScenarioPhase;
}> = [
  { pool: 'query', key: 'queryConcurrency' },
  { pool: 'queue', key: 'queuePollingConcurrency' },
  { pool: 'inventoryLock', key: 'inventoryLockConcurrency' },
  { pool: 'orderSubmit', key: 'orderSubmissionConcurrency' },
];

const realScheduler: AgentRunnerScheduler = {
  now: () => Date.now(),
  sleep: (ms) =>
    ms <= 0
      ? Promise.resolve()
      : new Promise((resolve) => setTimeout(resolve, ms)),
};

const defaultWorkerLaunchIntervalMs = 1_000;

export class AgentRunner {
  private readonly workerLaunchIntervalMs: number;

  constructor(
    private readonly probe: TargetProbe,
    private readonly scheduler: AgentRunnerScheduler = realScheduler,
    options: AgentRunnerOptions = {},
  ) {
    this.workerLaunchIntervalMs =
      options.workerLaunchIntervalMs ?? defaultWorkerLaunchIntervalMs;
  }

  async runAssignment(
    assignment: PlannedNodeAssignment,
  ): Promise<NodeRunSummary> {
    const assignmentStartedAtMs = this.scheduler.now();
    const scheduledPhases = assignment.phases.map((phase) => ({
      phase,
      phaseStartAtMs: assignmentStartedAtMs + phase.startsAtOffsetMs,
      summaryPromise: null as Promise<{
        phaseId: string;
        requestCount: number;
        successCount: number;
        averageLatencyMs: number;
      }> | null,
    }));

    for (const scheduledPhase of [...scheduledPhases]
      .sort((left, right) => left.phaseStartAtMs - right.phaseStartAtMs)) {
      const sleepPromise = this.sleepUntil(scheduledPhase.phaseStartAtMs);

      if (sleepPromise) {
        await sleepPromise;
      }

      scheduledPhase.summaryPromise = this.runPhase(
        assignment,
        scheduledPhase.phase,
        scheduledPhase.phaseStartAtMs,
      );
    }

    const resolvedPhaseSummaries = await Promise.all(
      scheduledPhases.map((scheduledPhase) => scheduledPhase.summaryPromise!),
    );

    return {
      runId: assignment.runId,
      nodeId: assignment.nodeId,
      region: assignment.region,
      role: assignment.role,
      mode: assignment.mode,
      averageRttMs:
        assignment.networkProfile.baseLatencyMs +
        Math.round(assignment.networkProfile.jitterMs / 2),
      startupSkewMs: 0,
      phaseSummaries: resolvedPhaseSummaries,
    };
  }

  private async runPhase(
    assignment: PlannedNodeAssignment,
    phase: ScenarioPhase,
    phaseStartAtMs: number,
  ) {
    const phaseEndsAtMs = phaseStartAtMs + phase.durationMs;
    let requestCount = 0;
    let successCount = 0;
    let totalLatencyMs = 0;

    const workers = phasePoolPlan.flatMap(({ pool, key }) =>
      Array.from({ length: phase[key] as number }, (_, requestIndex) =>
        this.runWorker({
          assignment,
          phase,
          pool,
          requestIndex,
          phaseEndsAtMs,
          onResult: (result) => {
            requestCount += 1;
            totalLatencyMs += result.latencyMs;

            if (result.success) {
              successCount += 1;
            }
          },
        }),
      ),
    );

    await Promise.all(workers);

    return {
      phaseId: phase.id,
      requestCount,
      successCount,
      averageLatencyMs: requestCount === 0 ? 0 : totalLatencyMs / requestCount,
    };
  }

  private async runWorker({
    assignment,
    phase,
    pool,
    requestIndex,
    phaseEndsAtMs,
    onResult,
  }: {
    assignment: PlannedNodeAssignment;
    phase: ScenarioPhase;
    pool: RequestPool;
    requestIndex: number;
    phaseEndsAtMs: number;
    onResult: (result: ProbeResult) => void;
  }): Promise<void> {
    let nextLaunchAtMs = this.scheduler.now();

    while (nextLaunchAtMs < phaseEndsAtMs) {
      const sleepPromise = this.sleepUntil(nextLaunchAtMs);

      if (sleepPromise) {
        await sleepPromise;
      }

      if (this.scheduler.now() >= phaseEndsAtMs) {
        break;
      }

      const result = await this.probe.execute({
        assignment,
        phase,
        pool,
        requestTemplate: assignment.requestTemplates[pool],
        requestIndex,
      });

      onResult(result);
      nextLaunchAtMs += this.workerLaunchIntervalMs;
    }
  }

  private sleepUntil(targetTimeMs: number): Promise<void> | null {
    const remainingDelayMs = targetTimeMs - this.scheduler.now();

    return remainingDelayMs > 0
      ? this.scheduler.sleep(remainingDelayMs)
      : null;
  }
}
