import {
  type NodeHealthStatus,
  type NodeTelemetrySample,
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

export type AgentTelemetryCallback = (
  sample: NodeTelemetrySample,
) => Promise<void> | void;

export type AgentStopCallback = () => Promise<boolean> | boolean;

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

export interface AgentRunnerRunHooks {
  onTelemetry?: AgentTelemetryCallback;
  shouldStop?: AgentStopCallback;
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
    hooks: AgentRunnerRunHooks = {},
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
        hooks,
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
    hooks: AgentRunnerRunHooks,
  ) {
    const phaseEndsAtMs = phaseStartAtMs + phase.durationMs;
    const hasTelemetry = hooks.onTelemetry !== undefined;
    let requestCount = 0;
    let successCount = 0;
    let totalLatencyMs = 0;
    let activeWorkers = 0;
    const latencies: number[] = [];
    let stopRequested = false;
    const shouldStop = hooks.shouldStop
      ? async (): Promise<boolean> => {
          if (stopRequested) {
            return true;
          }

          stopRequested = await hooks.shouldStop!();
          return stopRequested;
        }
      : undefined;
    const emitTelemetry = async (): Promise<void> => {
      if (!hasTelemetry) {
        return;
      }

      await hooks.onTelemetry(
        this.buildTelemetrySample({
          assignment,
          phase,
          phaseStartAtMs,
          requestCount,
          successCount,
          totalLatencyMs,
          latencies,
          activeWorkers,
          stopRequested,
        }),
      );
    };
    const recordResult = (result: ProbeResult): void => {
      requestCount += 1;
      totalLatencyMs += result.latencyMs;
      latencies.push(result.latencyMs);

      if (result.success) {
        successCount += 1;
      }
    };

    const workers = phasePoolPlan.flatMap(({ pool, key }) =>
      Array.from({ length: phase[key] as number }, (_, requestIndex) =>
        this.runWorker({
          assignment,
          phase,
          pool,
          requestIndex,
          phaseEndsAtMs,
          shouldStop,
          onStart: hasTelemetry
            ? async () => {
                activeWorkers += 1;
                await emitTelemetry();
              }
            : undefined,
          onResult: hasTelemetry
            ? async (result) => {
                recordResult(result);
                activeWorkers -= 1;
                await emitTelemetry();
              }
            : recordResult,
          onStop: hasTelemetry
            ? async () => {
                await emitTelemetry();
              }
            : undefined,
        }),
      ),
    );

    const telemetryLoop = hasTelemetry
      ? this.runTelemetryLoop({
          phaseEndsAtMs,
          shouldStop: shouldStop ?? (async () => false),
          emitTelemetry,
        })
      : Promise.resolve();

    await Promise.all([telemetryLoop, ...workers]);
    await emitTelemetry();

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
    shouldStop,
    onStart,
    onResult,
    onStop,
  }: {
    assignment: PlannedNodeAssignment;
    phase: ScenarioPhase;
    pool: RequestPool;
    requestIndex: number;
    phaseEndsAtMs: number;
    shouldStop?: () => Promise<boolean>;
    onStart?: () => Promise<void>;
    onResult?: (result: ProbeResult) => void | Promise<void>;
    onStop?: () => Promise<void>;
  }): Promise<void> {
    let nextLaunchAtMs = this.scheduler.now();

    while (nextLaunchAtMs < phaseEndsAtMs) {
      if (shouldStop && (await shouldStop())) {
        await onStop?.();
        break;
      }

      const sleepPromise = this.sleepUntil(nextLaunchAtMs);

      if (sleepPromise) {
        await sleepPromise;
        if (
          this.scheduler.now() >= phaseEndsAtMs ||
          (shouldStop ? await shouldStop() : false)
        ) {
          if (onStop) {
            await onStop();
          }
          break;
        }
      } else if (this.scheduler.now() >= phaseEndsAtMs) {
        if (onStop) {
          await onStop();
        }
        break;
      }

      if (onStart) {
        await onStart();
      }
      const result = await this.probe.execute({
        assignment,
        phase,
        pool,
        requestTemplate: assignment.requestTemplates[pool],
        requestIndex,
      });

      if (onResult) {
        const maybePromise = onResult(result);

        if (maybePromise && typeof (maybePromise as Promise<void>).then === 'function') {
          await maybePromise;
        }
      }
      nextLaunchAtMs += this.workerLaunchIntervalMs;
    }
  }

  private async runTelemetryLoop({
    phaseEndsAtMs,
    shouldStop,
    emitTelemetry,
  }: {
    phaseEndsAtMs: number;
    shouldStop: () => Promise<boolean>;
    emitTelemetry: () => Promise<void>;
  }): Promise<void> {
    let nextTelemetryAtMs = this.scheduler.now();

    while (nextTelemetryAtMs <= phaseEndsAtMs) {
      if (await shouldStop()) {
        break;
      }

      await emitTelemetry();
      nextTelemetryAtMs += this.workerLaunchIntervalMs;

      const sleepPromise = this.sleepUntil(nextTelemetryAtMs);

      if (sleepPromise) {
        await sleepPromise;
      }
    }
  }

  private sleepUntil(targetTimeMs: number): Promise<void> | null {
    const remainingDelayMs = targetTimeMs - this.scheduler.now();

    return remainingDelayMs > 0
      ? this.scheduler.sleep(remainingDelayMs)
      : null;
  }

  private buildTelemetrySample({
    assignment,
    phase,
    phaseStartAtMs,
    requestCount,
    successCount,
    totalLatencyMs,
    latencies,
    activeWorkers,
    stopRequested,
  }: {
    assignment: PlannedNodeAssignment;
    phase: ScenarioPhase;
    phaseStartAtMs: number;
    requestCount: number;
    successCount: number;
    totalLatencyMs: number;
    latencies: number[];
    activeWorkers: number;
    stopRequested: boolean;
  }): NodeTelemetrySample {
    const elapsedMs = Math.max(1, this.scheduler.now() - phaseStartAtMs);
    const errorRate =
      requestCount === 0 ? 0 : (requestCount - successCount) / requestCount;

    return {
      runId: assignment.runId,
      nodeId: assignment.nodeId,
      phaseId: phase.id,
      status: this.deriveTelemetryStatus({
        activeWorkers,
        errorRate,
        stopRequested,
      }),
      qps: requestCount === 0 ? 0 : (requestCount * 1_000) / elapsedMs,
      errorRate,
      p95LatencyMs:
        latencies.length === 0 ? 0 : this.percentile(latencies, 95),
      activeWorkers,
      recordedAt: new Date(this.scheduler.now()).toISOString(),
    };
  }

  private deriveTelemetryStatus({
    activeWorkers,
    errorRate,
    stopRequested,
  }: {
    activeWorkers: number;
    errorRate: number;
    stopRequested: boolean;
  }): NodeHealthStatus {
    if (stopRequested) {
      return 'OFFLINE';
    }

    if (errorRate >= 0.25) {
      return 'DEGRADED';
    }

    return activeWorkers > 0 ? 'BUSY' : 'ONLINE';
  }

  private percentile(values: number[], percentile: number): number {
    const sortedValues = [...values].sort((left, right) => left - right);
    const index = Math.min(
      sortedValues.length - 1,
      Math.max(0, Math.ceil((percentile / 100) * sortedValues.length) - 1),
    );

    return sortedValues[index] ?? 0;
  }
}
