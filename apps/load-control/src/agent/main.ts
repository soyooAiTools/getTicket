import {
  type NodeRegistration,
  type PlannedNodeAssignment,
  type RunStatus,
  type NodeTelemetrySample,
} from '@ticketing/contracts';

import { AgentRunner, type TargetProbe } from './agent-runner';
import {
  HttpControlClient,
  type ControlRunSnapshot,
} from './http-control.client';

type EnvSource = Record<string, string | undefined>;

function readEnv(
  env: EnvSource,
  names: string[],
  defaultValue?: string,
): string {
  for (const name of names) {
    const value = env[name];

    if (value) {
      return value;
    }
  }

  if (defaultValue !== undefined) {
    return defaultValue;
  }

  throw new Error(
    `Missing required environment variable: ${names.join(' or ')}`,
  );
}

function readNumberEnv(
  env: EnvSource,
  names: string[],
  defaultValue: number,
): number {
  const value = readEnv(env, names, String(defaultValue));
  return value ? Number(value) : defaultValue;
}

const defaultSleep = (ms: number): Promise<void> =>
  ms <= 0 ? Promise.resolve() : new Promise((resolve) => setTimeout(resolve, ms));

const terminalRunStatuses: RunStatus[] = ['STOPPED', 'COMPLETED', 'FAILED'];

export interface AgentBootstrapOptions {
  controlClient?: HttpControlClient;
  runner?: AgentRunner;
  probe?: TargetProbe;
  sleep?: (ms: number) => Promise<void>;
  statusPollIntervalMs?: number;
  telemetryLaunchIntervalMs?: number;
}

export function readControlBaseUrl(
  env: EnvSource = process.env,
): string {
  return readEnv(
    env,
    ['LOAD_CONTROL_BASE_URL', 'LOAD_CONTROL_URL'],
    'http://localhost:3001/control',
  );
}

export function readRunId(env: EnvSource = process.env): string {
  return readEnv(
    env,
    ['LOAD_CONTROL_RUN_ID', 'LOAD_AGENT_RUN_ID'],
    'run-preprod-1',
  );
}

export function readNodeRegistration(
  env: EnvSource = process.env,
): NodeRegistration {
  return {
    id: readEnv(env, ['NODE_ID', 'LOAD_AGENT_NODE_ID'], 'node-local'),
    region: readEnv(env, ['NODE_REGION', 'LOAD_AGENT_REGION'], 'hk'),
    role: readEnv(env, ['NODE_ROLE', 'LOAD_AGENT_ROLE'], 'ANCHOR') as NodeRegistration['role'],
    networkProfile: {
      id: readEnv(
        env,
        ['NODE_PROFILE_ID', 'LOAD_AGENT_NETWORK_PROFILE_ID'],
        'hk-anchor',
      ),
      label: readEnv(
        env,
        ['NODE_PROFILE_LABEL', 'LOAD_AGENT_NETWORK_PROFILE_LABEL'],
        'Hong Kong anchor',
      ),
      baseLatencyMs: readNumberEnv(
        env,
        ['NODE_BASE_LATENCY_MS', 'LOAD_AGENT_BASE_LATENCY_MS'],
        18,
      ),
      jitterMs: readNumberEnv(
        env,
        ['NODE_JITTER_MS', 'LOAD_AGENT_JITTER_MS'],
        4,
      ),
      packetLossRatio: readNumberEnv(
        env,
        ['NODE_PACKET_LOSS_RATIO', 'LOAD_AGENT_PACKET_LOSS_RATIO'],
        0.002,
      ),
    },
    maxConcurrency: readNumberEnv(
      env,
      ['NODE_MAX_CONCURRENCY', 'LOAD_AGENT_MAX_CONCURRENCY'],
      180,
    ),
  };
}

export async function waitForRunningRun(
  controlClient: Pick<HttpControlClient, 'getRun'>,
  runId: string,
  sleep: (ms: number) => Promise<void> = defaultSleep,
  statusPollIntervalMs = 1_000,
): Promise<ControlRunSnapshot> {
  for (;;) {
    const run = await controlClient.getRun(runId);

    if (run.status === 'RUNNING') {
      return run;
    }

    if (terminalRunStatuses.includes(run.status)) {
      throw new Error(
        `Run ${runId} reached terminal status ${run.status} before starting.`,
      );
    }

    await sleep(statusPollIntervalMs);
  }
}

function createDefaultProbe(node: NodeRegistration): TargetProbe {
  return {
    async execute() {
      return { success: true, latencyMs: node.networkProfile.baseLatencyMs };
    },
  };
}

function findAssignment(
  run: ControlRunSnapshot,
  nodeId: string,
): PlannedNodeAssignment {
  const assignment = run.assignments?.find((entry) => entry.nodeId === nodeId);

  if (!assignment) {
    throw new Error(`No assignment found for node ${nodeId} in run ${run.definition.id}`);
  }

  return assignment;
}

function createTelemetryPoster(
  controlClient: Pick<HttpControlClient, 'postTelemetry'>,
  runId: string,
): (sample: NodeTelemetrySample) => Promise<void> {
  return async (sample) => {
    await controlClient.postTelemetry(runId, sample);
  };
}

function createRunStopChecker(
  controlClient: Pick<HttpControlClient, 'getRun'>,
  runId: string,
): () => Promise<boolean> {
  return async () => {
    const run = await controlClient.getRun(runId);
    return run.status !== 'RUNNING';
  };
}

export async function bootstrap(
  env: EnvSource = process.env,
  options: AgentBootstrapOptions = {},
) {
  const controlBaseUrl = readControlBaseUrl(env);
  const controlClient = options.controlClient ?? new HttpControlClient(controlBaseUrl);
  const node = readNodeRegistration(env);
  const runId = readRunId(env);

  await controlClient.registerNode(node);
  const runningRun = await waitForRunningRun(
    controlClient,
    runId,
    options.sleep ?? defaultSleep,
    options.statusPollIntervalMs,
  );
  const assignment = findAssignment(runningRun, node.id);
  const probe = options.probe ?? createDefaultProbe(node);
  const runner =
    options.runner ??
    new AgentRunner(probe, undefined, {
      workerLaunchIntervalMs: options.telemetryLaunchIntervalMs,
    });
  const summary = await runner.runAssignment(assignment, {
    onTelemetry: createTelemetryPoster(controlClient, runId),
    shouldStop: createRunStopChecker(controlClient, runId),
  });
  await controlClient.submitSummary(runId, summary);
}

if (require.main === module) {
  void bootstrap();
}
