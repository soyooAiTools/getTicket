import { type NodeRegistration } from '@ticketing/contracts';

import { AgentRunner, type TargetProbe } from './agent-runner';
import { HttpControlClient } from './http-control.client';

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

export async function bootstrap() {
  const controlBaseUrl = readControlBaseUrl();
  const controlClient = new HttpControlClient(controlBaseUrl);
  const node = readNodeRegistration();
  const runId = readRunId();

  await controlClient.registerNode(node);
  const run = await controlClient.getRun(runId);
  const assignment = run.assignments?.find((entry) => entry.nodeId === node.id);

  if (!assignment) {
    throw new Error(`No assignment found for node ${node.id} in run ${runId}`);
  }

  const probe: TargetProbe = {
    async execute() {
      return { success: true, latencyMs: node.networkProfile.baseLatencyMs };
    },
  };

  const runner = new AgentRunner(probe);
  const summary = await runner.runAssignment(assignment);
  await controlClient.submitSummary(runId, summary);
}

if (require.main === module) {
  void bootstrap();
}
