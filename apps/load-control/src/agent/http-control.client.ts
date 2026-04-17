import {
  type LoadTestRunDefinition,
  type NodeRegistration,
  type NodeRunSummary,
  type PlannedNodeAssignment,
} from '@ticketing/contracts';

export class HttpControlClient {
  constructor(
    private readonly baseUrl: string =
      process.env.LOAD_CONTROL_BASE_URL ??
      process.env.LOAD_CONTROL_URL ??
      'http://localhost:3001/control',
  ) {}

  async registerNode(node: NodeRegistration): Promise<NodeRegistration> {
    return this.request<NodeRegistration>('/nodes/register', {
      method: 'POST',
      body: node,
    });
  }

  async getRun(runId: string): Promise<LoadTestRunDefinition & {
    assignments?: PlannedNodeAssignment[];
  }> {
    return this.request('/runs/' + encodeURIComponent(runId), {
      method: 'GET',
    });
  }

  async submitSummary(
    runId: string,
    summary: NodeRunSummary,
  ): Promise<NodeRunSummary> {
    return this.request<NodeRunSummary>('/runs/' + encodeURIComponent(runId) + '/results', {
      method: 'POST',
      body: summary,
    });
  }

  private async request<T>(
    path: string,
    init: {
      method: 'GET' | 'POST';
      body?: unknown;
    },
  ): Promise<T> {
    const url = new URL(this.baseUrl);
    url.pathname = `${url.pathname.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;

    const response = await fetch(url, {
      method: init.method,
      headers: init.body ? { 'content-type': 'application/json' } : undefined,
      body: init.body ? JSON.stringify(init.body) : undefined,
    });

    if (!response.ok) {
      throw new Error(`Control request failed: ${response.status} ${response.statusText}`);
    }

    return (await response.json()) as T;
  }
}
