import type {
  CalibrationReport,
  ControlRunDraft,
  ControlRunRecord,
  LiveRunSnapshot,
  LoadTestRunDefinition,
  NodePool,
  NodeRegistration,
  NodeRunSummary,
  PlannedNodeAssignment,
  RunStatus,
  ScenarioTemplate,
} from '../../../../packages/contracts/src';

type ImportMetaWithEnv = ImportMeta & {
  env?: Record<string, string | undefined>;
};

export type LoadControlRun = {
  definition: LoadTestRunDefinition;
  status: RunStatus;
  assignments: PlannedNodeAssignment[];
  summaries: NodeRunSummary[];
};

const DEFAULT_LOAD_CONTROL_BASE_URL = 'http://localhost:3001/control';
const LOAD_CONTROL_BASE_URL_STORAGE_KEY = 'load-testing.operator.base-url';

function readStoredBaseUrl() {
  if (typeof window === 'undefined') {
    return undefined;
  }

  try {
    const value = window.localStorage
      .getItem(LOAD_CONTROL_BASE_URL_STORAGE_KEY)
      ?.trim();

    return value ? value : undefined;
  } catch {
    return undefined;
  }
}

export function getLoadControlBaseUrl() {
  const envBaseUrl = (import.meta as ImportMetaWithEnv).env?.VITE_LOAD_CONTROL_BASE_URL?.trim();

  return (
    readStoredBaseUrl() ??
    (envBaseUrl && envBaseUrl.length > 0 ? envBaseUrl : DEFAULT_LOAD_CONTROL_BASE_URL)
  ).replace(/\/+$/, '');
}

function buildControlUrl(path: string) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${getLoadControlBaseUrl()}${normalizedPath}`;
}

async function readErrorMessage(response: Response) {
  const contentType = response.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    const payload = (await response.json().catch(() => null)) as
      | { message?: string | string[] }
      | null;

    if (Array.isArray(payload?.message)) {
      return payload.message.join(', ');
    }

    if (typeof payload?.message === 'string' && payload.message.length > 0) {
      return payload.message;
    }
  }

  const text = await response.text().catch(() => '');
  return text.length > 0 ? text : `Load-control request failed: ${response.status}`;
}

async function loadControlRequest<TResponse>(
  path: string,
  init: RequestInit = {},
): Promise<TResponse> {
  const headers = new Headers(init.headers);
  headers.set('accept', 'application/json');

  const response = await fetch(buildControlUrl(path), {
    ...init,
    headers,
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  if (response.status === 204) {
    return undefined as TResponse;
  }

  return (await response.json()) as TResponse;
}

function jsonRequest<TResponse>(path: string, method: 'POST', body?: unknown) {
  return loadControlRequest<TResponse>(path, {
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: {
      'content-type': 'application/json',
    },
    method,
  });
}

export function buildRunStreamUrl(runId: string) {
  return buildControlUrl(`/runs/${encodeURIComponent(runId)}/stream`);
}

export function listNodePools() {
  return loadControlRequest<NodePool[]>('/node-pools');
}

export function listTemplates() {
  return loadControlRequest<ScenarioTemplate[]>('/templates');
}

export function listNodes() {
  return loadControlRequest<NodeRegistration[]>('/nodes');
}

export function listRuns() {
  return loadControlRequest<ControlRunRecord[]>('/runs');
}

export function getRun(runId: string) {
  return loadControlRequest<LoadControlRun>(`/runs/${encodeURIComponent(runId)}`);
}

export function createRun(draft: ControlRunDraft) {
  return jsonRequest<LoadControlRun>('/runs', 'POST', draft);
}

export function planRun(runId: string) {
  return jsonRequest<LoadControlRun>(`/runs/${encodeURIComponent(runId)}/plan`, 'POST');
}

export function startRun(runId: string) {
  return jsonRequest<LoadControlRun>(`/runs/${encodeURIComponent(runId)}/start`, 'POST');
}

export function stopRun(runId: string) {
  return jsonRequest<LoadControlRun>(`/runs/${encodeURIComponent(runId)}/stop`, 'POST');
}

export function getLiveRunSnapshot(runId: string) {
  return loadControlRequest<LiveRunSnapshot>(
    `/runs/${encodeURIComponent(runId)}/live`,
  );
}

export function getCalibrationReport(
  baselineRunId: string,
  productionRunId: string,
) {
  return loadControlRequest<CalibrationReport>(
    `/reports/calibration/${encodeURIComponent(baselineRunId)}/${encodeURIComponent(
      productionRunId,
    )}`,
  );
}
