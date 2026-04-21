import type { ProbeRequest, ProbeResult, TargetProbe } from './agent-runner';

type JsonResponse = {
  items?: Array<Record<string, unknown>>;
  [key: string]: unknown;
};

type FetchLike = (
  input: string | URL,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  },
) => Promise<{
  json(): Promise<JsonResponse>;
  ok: boolean;
  status: number;
  statusText: string;
}>;

type ProbeContext = {
  token?: string;
  viewerId?: string;
  eventId?: string;
  tierId?: string;
  ticketType?: 'E_TICKET' | 'PAPER_TICKET';
};

export interface HttpWorkflowProbeOptions {
  accountPrefix: string;
  fetchImpl?: FetchLike;
  loadTestSecret: string;
}

export class HttpWorkflowProbe implements TargetProbe {
  private readonly fetchImpl: FetchLike;
  private readonly context: ProbeContext = {};
  private sessionBootstrapPromise: Promise<void> | null = null;

  constructor(private readonly options: HttpWorkflowProbeOptions) {
    this.fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init as RequestInit));
  }

  async execute(request: ProbeRequest): Promise<ProbeResult> {
    const startedAt = Date.now();

    try {
      if (request.pool === 'query') {
        await this.ensureSession(request);
        await this.refreshCatalogContext(request);
      } else if (request.pool === 'orderSubmit') {
        await this.ensureSession(request);
        await this.ensureCatalogContext(request);
        await this.ensureViewer(request);
        await this.createDraftOrder(request);
      } else {
        await this.ensureSession(request);
        await this.ensureCatalogContext(request);
      }

      return {
        success: true,
        latencyMs: Date.now() - startedAt,
      };
    } catch {
      return {
        success: false,
        latencyMs: Date.now() - startedAt,
      };
    }
  }

  private async ensureSession(request: ProbeRequest) {
    if (this.context.token) {
      return;
    }

    if (!this.sessionBootstrapPromise) {
      this.sessionBootstrapPromise = (async () => {
        const payload = await this.bootstrapSession(
          request.assignment.targetBaseUrl,
          this.buildAccountKey(request),
        );

        const token = typeof payload.token === 'string' ? payload.token : undefined;

        if (!token) {
          throw new Error('Session bootstrap did not return a token.');
        }

        this.context.token = token;
      })().finally(() => {
        this.sessionBootstrapPromise = null;
      });
    }

    await this.sessionBootstrapPromise;
  }

  private async ensureCatalogContext(request: ProbeRequest) {
    if (!this.context.eventId || !this.context.tierId || !this.context.ticketType) {
      await this.refreshCatalogContext(request);
    }
  }

  private async refreshCatalogContext(request: ProbeRequest) {
    const eventList = await this.requestJson(request.assignment.targetBaseUrl, '/catalog/events', {
      method: 'GET',
    });
    const firstEvent = Array.isArray(eventList.items) ? eventList.items[0] : undefined;
    const eventId = typeof firstEvent?.id === 'string' ? firstEvent.id : undefined;

    if (!eventId) {
      throw new Error('No published event is available.');
    }

    const eventDetail = await this.requestJson(
      request.assignment.targetBaseUrl,
      `/catalog/events/${encodeURIComponent(eventId)}`,
      {
        method: 'GET',
      },
    );

    const sessions = Array.isArray(eventDetail.sessions)
      ? (eventDetail.sessions as Array<Record<string, unknown>>)
      : [];
    const firstTier = sessions
      .flatMap((session) =>
        Array.isArray(session.ticketTiers)
          ? (session.ticketTiers as Array<Record<string, unknown>>)
          : [],
      )
      .find((tier) => tier.ticketType === 'E_TICKET') ??
      sessions.flatMap((session) =>
        Array.isArray(session.ticketTiers)
          ? (session.ticketTiers as Array<Record<string, unknown>>)
          : [],
      )[0];

    const tierId = typeof firstTier?.id === 'string' ? firstTier.id : undefined;
    const ticketType =
      firstTier?.ticketType === 'PAPER_TICKET' ? 'PAPER_TICKET' : 'E_TICKET';

    if (!tierId) {
      throw new Error('No ticket tier is available.');
    }

    this.context.eventId = eventId;
    this.context.tierId = tierId;
    this.context.ticketType = ticketType;
  }

  private async ensureViewer(request: ProbeRequest) {
    if (this.context.viewerId) {
      return;
    }

    const viewersPayload = await this.requestJson(request.assignment.targetBaseUrl, '/viewers', {
      method: 'GET',
    });
    const existingViewer = Array.isArray(viewersPayload.items)
      ? viewersPayload.items[0]
      : undefined;

    if (typeof existingViewer?.id === 'string') {
      this.context.viewerId = existingViewer.id;
      return;
    }

    const createdViewer = await this.requestJson(request.assignment.targetBaseUrl, '/viewers', {
      method: 'POST',
      body: this.buildViewerPayload(request),
    });

    if (typeof createdViewer.id !== 'string') {
      throw new Error('Viewer creation did not return an id.');
    }

    this.context.viewerId = createdViewer.id;
  }

  private async createDraftOrder(request: ProbeRequest) {
    if (!this.context.viewerId || !this.context.tierId || !this.context.ticketType) {
      throw new Error('Draft order prerequisites are missing.');
    }

    await this.requestJson(request.assignment.targetBaseUrl, '/orders/draft', {
      method: 'POST',
      body: {
        tierId: this.context.tierId,
        viewerIds: [this.context.viewerId],
        quantity: 1,
        ticketType: this.context.ticketType,
      },
    });
  }

  private buildViewerPayload(request: ProbeRequest) {
    const suffix = String(request.requestIndex % 10000).padStart(4, '0');

    return {
      name: `Node ${request.assignment.nodeId}`,
      idCard: `11010119900101${suffix}`,
      mobile: `1380000${suffix}`,
    };
  }

  private buildAccountKey(request: ProbeRequest) {
    const sanitizedNodeId = request.assignment.nodeId.replace(/[^a-zA-Z0-9_-]/g, '-');
    return `loadtest:${this.options.accountPrefix}-${sanitizedNodeId}`;
  }

  private bootstrapSession(baseUrl: string, accountKey: string) {
    return this.requestJson(baseUrl, '/auth/session/bootstrap', {
      method: 'POST',
      headers: {
        'x-load-test-secret': this.options.loadTestSecret,
      },
      body: {
        accountKey,
      },
      includeAuth: false,
      retryOnUnauthorized: false,
    });
  }

  private async requestJson(
    baseUrl: string,
    path: string,
    options: {
      method: 'GET' | 'POST';
      body?: Record<string, unknown>;
      headers?: Record<string, string>;
      includeAuth?: boolean;
      retryOnUnauthorized?: boolean;
    },
  ): Promise<JsonResponse> {
    const url = new URL(baseUrl);
    url.pathname = `${url.pathname.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;

    const headers: Record<string, string> = {
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(options.headers ?? {}),
    };

    if (options.includeAuth !== false && this.context.token) {
      headers.authorization = `Bearer ${this.context.token}`;
    }

    const response = await this.fetchImpl(url.toString(), {
      method: options.method,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (
      response.status === 401 &&
      options.retryOnUnauthorized !== false &&
      options.includeAuth !== false
    ) {
      this.context.token = undefined;
      throw new Error('Unauthorized');

    }

    if (!response.ok) {
      throw new Error(`Target request failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }
}
