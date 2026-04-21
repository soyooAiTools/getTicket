import type { PlannedNodeAssignment, ScenarioPhase } from '@ticketing/contracts';

import type { ProbeRequest } from './agent-runner';
import { HttpWorkflowProbe } from './http-workflow.probe';

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
  statusText = 'OK',
) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: async () => body,
  };
}

function createAssignment(): PlannedNodeAssignment {
  const phases: ScenarioPhase[] = [
    {
      id: 'phase-1',
      startsAtOffsetMs: 0,
      durationMs: 1_000,
      queryConcurrency: 1,
      queuePollingConcurrency: 0,
      inventoryLockConcurrency: 0,
      orderSubmissionConcurrency: 1,
    },
  ];

  return {
    runId: 'run-01',
    nodeId: 'node-a',
    region: 'ap-southeast-1',
    role: 'EDGE',
    mode: 'PREPROD',
    targetBaseUrl: 'https://target.example.com/api',
    networkProfile: {
      id: 'profile-1',
      label: 'steady',
      baseLatencyMs: 25,
      jitterMs: 5,
      packetLossRatio: 0.01,
    },
    requestTemplates: {
      query: {
        method: 'GET',
        path: '/catalog/events',
        timeoutMs: 500,
      },
      queue: {
        method: 'GET',
        path: '/catalog/events',
        timeoutMs: 500,
      },
      inventoryLock: {
        method: 'POST',
        path: '/orders/draft',
        timeoutMs: 500,
      },
      orderSubmit: {
        method: 'POST',
        path: '/orders/draft',
        timeoutMs: 500,
      },
    },
    phases,
    tags: {
      team: 'growth',
    },
  };
}

function createProbeRequest(pool: ProbeRequest['pool']): ProbeRequest {
  const assignment = createAssignment();

  return {
    assignment,
    phase: assignment.phases[0]!,
    pool,
    requestTemplate: assignment.requestTemplates[pool],
    requestIndex: 7,
  };
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return {
    promise,
    resolve,
    reject,
  };
}

describe('HttpWorkflowProbe', () => {
  it('bootstraps a session, creates a viewer, and submits a draft order', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          token: 'token-123',
          customer: {
            id: 'cust-1',
            accountKey: 'loadtest:node-local-user-node-a',
          },
          expiresAt: '2026-04-24T09:30:00.000Z',
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          items: [{ id: 'event-1' }],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          id: 'event-1',
          sessions: [
            {
              ticketTiers: [{ id: 'tier-1', ticketType: 'E_TICKET' }],
            },
          ],
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ items: [] }))
      .mockResolvedValueOnce(jsonResponse({ id: 'viewer-1' }))
      .mockResolvedValueOnce(jsonResponse({ id: 'draft-1' }));

    const probe = new HttpWorkflowProbe({
      accountPrefix: 'node-local-user',
      fetchImpl: fetchMock,
      loadTestSecret: 'secret_123',
    });

    const result = await probe.execute(createProbeRequest('orderSubmit'));

    expect(result.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(6);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://target.example.com/api/auth/session/bootstrap',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-load-test-secret': 'secret_123',
        },
        body: JSON.stringify({
          accountKey: 'loadtest:node-local-user-node-a',
        }),
      },
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      'https://target.example.com/api/viewers',
      {
        method: 'GET',
        headers: {
          authorization: 'Bearer token-123',
        },
        body: undefined,
      },
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      5,
      'https://target.example.com/api/viewers',
      {
        method: 'POST',
        headers: {
          authorization: 'Bearer token-123',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Node node-a',
          idCard: '110101199001010007',
          mobile: '13800000007',
        }),
      },
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      6,
      'https://target.example.com/api/orders/draft',
      {
        method: 'POST',
        headers: {
          authorization: 'Bearer token-123',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          tierId: 'tier-1',
          viewerIds: ['viewer-1'],
          quantity: 1,
          ticketType: 'E_TICKET',
        }),
      },
    );
  });

  it('reuses the cached session, catalog context, and viewer across submissions', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          token: 'token-123',
          customer: {
            id: 'cust-1',
            accountKey: 'loadtest:node-local-user-node-a',
          },
          expiresAt: '2026-04-24T09:30:00.000Z',
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ items: [{ id: 'event-1' }] }))
      .mockResolvedValueOnce(
        jsonResponse({
          id: 'event-1',
          sessions: [
            {
              ticketTiers: [{ id: 'tier-1', ticketType: 'E_TICKET' }],
            },
          ],
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ items: [{ id: 'viewer-1' }] }))
      .mockResolvedValueOnce(jsonResponse({ id: 'draft-1' }))
      .mockResolvedValueOnce(jsonResponse({ id: 'draft-2' }));

    const probe = new HttpWorkflowProbe({
      accountPrefix: 'node-local-user',
      fetchImpl: fetchMock,
      loadTestSecret: 'secret_123',
    });

    await expect(probe.execute(createProbeRequest('orderSubmit'))).resolves.toMatchObject({
      success: true,
    });
    await expect(probe.execute(createProbeRequest('orderSubmit'))).resolves.toMatchObject({
      success: true,
    });

    expect(fetchMock).toHaveBeenCalledTimes(6);
    expect(fetchMock).toHaveBeenNthCalledWith(
      6,
      'https://target.example.com/api/orders/draft',
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: 'Bearer token-123',
        }),
      }),
    );
  });

  it('deduplicates concurrent session bootstrap requests for the same probe', async () => {
    const bootstrapGate = createDeferred<void>();
    const fetchMock = jest.fn(async (input: string | URL) => {
      const url = input.toString();

      if (url.endsWith('/auth/session/bootstrap')) {
        await bootstrapGate.promise;

        return jsonResponse({
          token: 'token-123',
          customer: {
            id: 'cust-1',
            accountKey: 'loadtest:node-local-user-node-a',
          },
          expiresAt: '2026-04-24T09:30:00.000Z',
        });
      }

      if (url.endsWith('/catalog/events')) {
        return jsonResponse({ items: [{ id: 'event-1' }] });
      }

      if (url.endsWith('/catalog/events/event-1')) {
        return jsonResponse({
          id: 'event-1',
          sessions: [
            {
              ticketTiers: [{ id: 'tier-1', ticketType: 'E_TICKET' }],
            },
          ],
        });
      }

      throw new Error(`Unexpected URL: ${url}`);
    });

    const probe = new HttpWorkflowProbe({
      accountPrefix: 'node-local-user',
      fetchImpl: fetchMock,
      loadTestSecret: 'secret_123',
    });

    const firstQuery = probe.execute(createProbeRequest('query'));
    const secondQuery = probe.execute(createProbeRequest('query'));
    bootstrapGate.resolve();

    await expect(Promise.all([firstQuery, secondQuery])).resolves.toEqual([
      expect.objectContaining({ success: true }),
      expect.objectContaining({ success: true }),
    ]);

    expect(
      fetchMock.mock.calls.filter(([url]) =>
        url.toString().endsWith('/auth/session/bootstrap'),
      ),
    ).toHaveLength(1);
  });

  it('clears the cached token after a 401 and bootstraps again on the next attempt', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          token: 'token-123',
          customer: {
            id: 'cust-1',
            accountKey: 'loadtest:node-local-user-node-a',
          },
          expiresAt: '2026-04-24T09:30:00.000Z',
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ items: [{ id: 'event-1' }] }))
      .mockResolvedValueOnce(
        jsonResponse({
          id: 'event-1',
          sessions: [
            {
              ticketTiers: [{ id: 'tier-1', ticketType: 'E_TICKET' }],
            },
          ],
        }),
      )
      .mockResolvedValueOnce(jsonResponse({}, 401, 'Unauthorized'))
      .mockResolvedValueOnce(
        jsonResponse({
          token: 'token-456',
          customer: {
            id: 'cust-1',
            accountKey: 'loadtest:node-local-user-node-a',
          },
          expiresAt: '2026-04-24T09:35:00.000Z',
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ items: [{ id: 'event-1' }] }))
      .mockResolvedValueOnce(
        jsonResponse({
          id: 'event-1',
          sessions: [
            {
              ticketTiers: [{ id: 'tier-1', ticketType: 'E_TICKET' }],
            },
          ],
        }),
      );

    const probe = new HttpWorkflowProbe({
      accountPrefix: 'node-local-user',
      fetchImpl: fetchMock,
      loadTestSecret: 'secret_123',
    });

    await expect(probe.execute(createProbeRequest('query'))).resolves.toMatchObject({
      success: true,
    });
    await expect(probe.execute(createProbeRequest('orderSubmit'))).resolves.toMatchObject({
      success: false,
    });
    await expect(probe.execute(createProbeRequest('query'))).resolves.toMatchObject({
      success: true,
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      'https://target.example.com/api/viewers',
      expect.objectContaining({
        headers: {
          authorization: 'Bearer token-123',
        },
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      5,
      'https://target.example.com/api/auth/session/bootstrap',
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-load-test-secret': 'secret_123',
        }),
      }),
    );
  });

  it('reports catalog and draft-order validation failures as unsuccessful requests', async () => {
    const catalogFailureProbe = new HttpWorkflowProbe({
      accountPrefix: 'node-local-user',
      fetchImpl: jest
        .fn()
        .mockResolvedValueOnce(
          jsonResponse({
            token: 'token-123',
            customer: {
              id: 'cust-1',
              accountKey: 'loadtest:node-local-user-node-a',
            },
            expiresAt: '2026-04-24T09:30:00.000Z',
          }),
        )
        .mockResolvedValueOnce(jsonResponse({ items: [] })),
      loadTestSecret: 'secret_123',
    });
    const orderFailureFetchMock = jest
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          token: 'token-123',
          customer: {
            id: 'cust-1',
            accountKey: 'loadtest:node-local-user-node-a',
          },
          expiresAt: '2026-04-24T09:30:00.000Z',
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ items: [{ id: 'event-1' }] }))
      .mockResolvedValueOnce(
        jsonResponse({
          id: 'event-1',
          sessions: [
            {
              ticketTiers: [{ id: 'tier-1', ticketType: 'E_TICKET' }],
            },
          ],
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ items: [{ id: 'viewer-1' }] }))
      .mockResolvedValueOnce(
        jsonResponse(
          {
            message: 'quantity exceeds remaining inventory',
          },
          422,
          'Unprocessable Entity',
        ),
      );
    const orderFailureProbe = new HttpWorkflowProbe({
      accountPrefix: 'node-local-user',
      fetchImpl: orderFailureFetchMock,
      loadTestSecret: 'secret_123',
    });

    await expect(catalogFailureProbe.execute(createProbeRequest('query'))).resolves.toMatchObject(
      {
        success: false,
      },
    );
    await expect(orderFailureProbe.execute(createProbeRequest('orderSubmit'))).resolves.toMatchObject(
      {
        success: false,
      },
    );
  });
});
