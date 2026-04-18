import { describe, expect, it } from 'vitest';

import {
  controlRunDraftSchema,
  controlRunRecordSchema,
  calibrationReportSchema,
  eventCatalogSummarySchema,
  eventDetailSchema,
  eventOperationsUpdateSchema,
  eventSummarySchema,
  orderDetailSchema,
  orderListItemSchema,
  orderTimelineItemSchema,
  liveRunSnapshotSchema,
  nodeHealthStatusSchema,
  nodePoolSchema,
  nodeTelemetrySampleSchema,
  ticketTierSummarySchema,
  loadTestRunDefinitionSchema,
  networkProfileSchema,
  miniappSessionSchema,
  runStatusSchema,
  scenarioTemplateSchema,
  wechatPaymentIntentSchema,
  viewerSchema,
} from './index';

describe('shared contracts', () => {
  it('validates an event summary payload', () => {
    expect(
      eventSummarySchema.parse({
        id: 'evt_20260417_001',
        title: 'Jay Chou Carnival World Tour',
        city: 'Shanghai',
        venueName: 'Shanghai Stadium',
        saleStatus: 'ON_SALE',
        minPrice: 499,
      }),
    ).toMatchObject({
      saleStatus: 'ON_SALE',
      minPrice: 499,
    });
  });

  it('rejects event summary payloads with session-only fields', () => {
    expect(() =>
      eventSummarySchema.parse({
        id: 'evt_20260417_001',
        title: 'Jay Chou Carnival World Tour',
        city: 'Shanghai',
        venueName: 'Shanghai Stadium',
        startsAt: '2026-05-01T19:30:00.000Z',
        saleStatus: 'ON_SALE',
        minPrice: 499,
      }),
    ).toThrow();
  });

  it('validates a catalog event payload with sale and refund switches', () => {
    expect(
      eventCatalogSummarySchema.parse({
        id: 'evt_20260417_001',
        title: 'Jay Chou Carnival World Tour',
        city: 'Shanghai',
        venueName: 'Shanghai Stadium',
        saleStatus: 'ON_SALE',
        minPrice: 499,
        published: true,
        refundEntryEnabled: false,
      }),
    ).toMatchObject({
      published: true,
      refundEntryEnabled: false,
      saleStatus: 'ON_SALE',
    });
  });

  it('validates an event detail payload with sessions and ticket tiers', () => {
    expect(
      eventDetailSchema.parse({
        id: 'evt_20260417_001',
        title: 'Jay Chou Carnival World Tour',
        city: 'Shanghai',
        venueName: 'Shanghai Stadium',
        description: 'A beta event detail payload.',
        saleStatus: 'ON_SALE',
        minPrice: 499,
        published: true,
        refundEntryEnabled: true,
        sessions: [
          {
            id: 'session_001',
            name: '2026-05-01 19:30',
            startsAt: '2026-05-01T11:30:00.000Z',
            saleStartsAt: '2026-04-20T12:00:00.000Z',
            saleEndsAt: '2026-04-30T12:00:00.000Z',
            ticketTiers: [
              {
                id: 'tier_001',
                name: 'Inner Field',
                price: 499,
                inventory: 200,
                ticketType: 'E_TICKET',
              },
            ],
          },
        ],
      }),
    ).toMatchObject({
      published: true,
      refundEntryEnabled: true,
      sessions: [
        {
          name: '2026-05-01 19:30',
          ticketTiers: [
            {
              ticketType: 'E_TICKET',
            },
          ],
        },
      ],
    });
  });

  it('validates a ticket tier summary payload through the planned symbol', () => {
    expect(
      ticketTierSummarySchema.parse({
        id: 'tier_001',
        name: 'Inner Field',
        price: 499,
        inventory: 200,
        ticketType: 'E_TICKET',
      }),
    ).toMatchObject({
      ticketType: 'E_TICKET',
      inventory: 200,
    });
  });

  it('validates admin event updates with sale status and operation switches', () => {
    expect(
      eventOperationsUpdateSchema.parse({
        published: true,
        refundEntryEnabled: false,
        saleStatus: 'ON_SALE',
      }),
    ).toMatchObject({
      published: true,
      saleStatus: 'ON_SALE',
    });
  });

  it('rejects admin event updates without any operation fields', () => {
    expect(() => eventOperationsUpdateSchema.parse({})).toThrow();
  });

  it('validates a viewer payload with mainland mobile and 18-char id card', () => {
    expect(
      viewerSchema.parse({
        id: 'viewer_001',
        name: 'Zhang San',
        mobile: '13800138000',
        idCard: '110101199003071234',
      }),
    ).toMatchObject({
      mobile: '13800138000',
      idCard: '110101199003071234',
    });
  });

  it('rejects a viewer payload with an invalid mainland mobile', () => {
    expect(() =>
      viewerSchema.parse({
        id: 'viewer_001',
        name: 'Zhang San',
        mobile: '23800138000',
        idCard: '110101199003071234',
      }),
    ).toThrow();
  });

  it('validates an order detail payload', () => {
    expect(
      orderDetailSchema.parse({
        id: 'ord_20260417_001',
        orderNumber: 'AT202604170001',
        status: 'PAID_PENDING_FULFILLMENT',
        ticketType: 'E_TICKET',
        totalAmount: 998,
        currency: 'CNY',
        createdAt: '2026-04-17T12:00:00.000Z',
        event: {
          id: 'evt_20260417_001',
          title: 'Jay Chou Carnival World Tour',
          city: 'Shanghai',
          venueName: 'Shanghai Stadium',
          saleStatus: 'ON_SALE',
          minPrice: 499,
        },
        timeline: {
          title: 'Pending Fulfillment',
          description:
            'E-ticket confirmation arrives no later than 3 days before the show.',
        },
        refundEntryEnabled: true,
        items: [
          {
            id: 'item_001',
            sessionId: 'session_001',
            sessionName: '2026-05-01 19:30',
            tierName: 'Inner Field',
            quantity: 2,
            unitPrice: 499,
            totalAmount: 998,
            viewer: {
              id: 'viewer_001',
              name: 'Zhang San',
              mobile: '13800138000',
            },
          },
        ],
      }),
    ).toMatchObject({
      status: 'PAID_PENDING_FULFILLMENT',
      ticketType: 'E_TICKET',
      totalAmount: 998,
    });
  });

  it('rejects an order detail payload with a negative total amount', () => {
    expect(() =>
      orderDetailSchema.parse({
        id: 'ord_20260417_001',
        orderNumber: 'AT202604170001',
        status: 'PAID_PENDING_FULFILLMENT',
        ticketType: 'E_TICKET',
        totalAmount: -1,
        currency: 'CNY',
        viewer: {
          id: 'viewer_001',
          name: 'Zhang San',
          mobile: '13800138000',
          idCard: '110101199003071234',
        },
        event: {
          id: 'evt_20260417_001',
          title: 'Jay Chou Carnival World Tour',
          city: 'Shanghai',
          venueName: 'Shanghai Stadium',
          saleStatus: 'ON_SALE',
          minPrice: 499,
        },
        items: [
          {
            id: 'item_001',
            sessionId: 'session_001',
            sessionName: '2026-05-01 19:30',
            tierName: 'Inner Field',
            quantity: 2,
            unitPrice: 499,
            totalAmount: 998,
          },
        ],
      }),
    ).toThrow();
  });

  it('validates an order timeline payload', () => {
    expect(
      orderTimelineItemSchema.parse({
        title: 'Pending Fulfillment',
        description:
          'E-ticket confirmation arrives no later than 3 days before the show.',
      }),
    ).toMatchObject({
      title: 'Pending Fulfillment',
    });
  });

  it('validates a beta order list item payload', () => {
    expect(
      orderListItemSchema.parse({
        id: 'ord_20260417_001',
        orderNumber: 'AT202604170001',
        status: 'PAID_PENDING_FULFILLMENT',
        ticketType: 'E_TICKET',
        totalAmount: 998,
        currency: 'CNY',
        createdAt: '2026-04-17T12:00:00.000Z',
        refundEntryEnabled: true,
        timeline: {
          title: 'Pending Fulfillment',
          description:
            'E-ticket confirmation arrives no later than 3 days before the show.',
        },
        event: {
          id: 'evt_20260417_001',
          title: 'Jay Chou Carnival World Tour',
          city: 'Shanghai',
          venueName: 'Shanghai Stadium',
          saleStatus: 'ON_SALE',
          minPrice: 499,
        },
      }),
    ).toMatchObject({
      status: 'PAID_PENDING_FULFILLMENT',
      refundEntryEnabled: true,
    });
  });

  it('validates a miniapp session payload', () => {
    expect(
      miniappSessionSchema.parse({
        token: 'session-token-123',
        customer: {
          id: 'cust_001',
          openId: 'openid_abc123',
        },
        expiresAt: '2026-04-24T09:30:00.000Z',
      }),
    ).toMatchObject({
      customer: {
        openId: 'openid_abc123',
      },
      token: 'session-token-123',
    });
  });

  it('rejects a miniapp session payload with extra fields', () => {
    expect(() =>
      miniappSessionSchema.parse({
        token: 'session-token-123',
        customer: {
          id: 'cust_001',
          openId: 'openid_abc123',
          sessionKey: 'should-not-be-exposed',
        },
        expiresAt: '2026-04-24T09:30:00.000Z',
      }),
    ).toThrow();
  });

  it('validates the wechat payment intent contract', () => {
    expect(
      wechatPaymentIntentSchema.parse({
        appId: 'wx-app-id',
        nonceStr: 'nonce',
        packageValue: 'prepay_id=wx123',
        paySign: 'signature',
        signType: 'RSA',
        timeStamp: '1713355200',
      }),
    ).toMatchObject({
      packageValue: 'prepay_id=wx123',
      signType: 'RSA',
    });
  });

  it('validates a release-window load-test run definition', () => {
    expect(
      loadTestRunDefinitionSchema.parse({
        id: 'run_preprod_20260417_001',
        mode: 'PREPROD',
        targetBaseUrl: 'https://preprod-api.example.com',
        maxGlobalQps: 2400,
        maxNodeConcurrency: 180,
        tags: {
          test_run_id: 'run_preprod_20260417_001',
        },
        requestTemplates: {
          query: {
            method: 'GET',
            path: '/api/catalog/events',
            timeoutMs: 1500,
          },
          queue: {
            method: 'GET',
            path: '/api/queue/status',
            timeoutMs: 1500,
          },
          inventoryLock: {
            method: 'POST',
            path: '/api/checkout/draft-orders',
            timeoutMs: 2500,
          },
          orderSubmit: {
            method: 'POST',
            path: '/api/orders/submit',
            timeoutMs: 2500,
          },
        },
        phases: [
          {
            id: 'warmup',
            startsAtOffsetMs: 0,
            durationMs: 1500000,
            queryConcurrency: 30,
            queuePollingConcurrency: 0,
            inventoryLockConcurrency: 0,
            orderSubmissionConcurrency: 0,
          },
          {
            id: 'ramp',
            startsAtOffsetMs: 1500000,
            durationMs: 290000,
            queryConcurrency: 120,
            queuePollingConcurrency: 24,
            inventoryLockConcurrency: 0,
            orderSubmissionConcurrency: 0,
          },
          {
            id: 'peak',
            startsAtOffsetMs: 1790000,
            durationMs: 15000,
            queryConcurrency: 300,
            queuePollingConcurrency: 120,
            inventoryLockConcurrency: 80,
            orderSubmissionConcurrency: 50,
          },
          {
            id: 'decay',
            startsAtOffsetMs: 1805000,
            durationMs: 55000,
            queryConcurrency: 180,
            queuePollingConcurrency: 140,
            inventoryLockConcurrency: 50,
            orderSubmissionConcurrency: 24,
          },
          {
            id: 'tail',
            startsAtOffsetMs: 1860000,
            durationMs: 120000,
            queryConcurrency: 50,
            queuePollingConcurrency: 18,
            inventoryLockConcurrency: 0,
            orderSubmissionConcurrency: 0,
          },
        ],
      }),
    ).toMatchObject({
      mode: 'PREPROD',
      maxGlobalQps: 2400,
    });
  });

  it('validates a Hong Kong anchor network profile', () => {
    expect(
      networkProfileSchema.parse({
        id: 'hk-anchor',
        label: 'Hong Kong anchor',
        baseLatencyMs: 18,
        jitterMs: 4,
        packetLossRatio: 0.002,
      }),
    ).toMatchObject({
      id: 'hk-anchor',
      baseLatencyMs: 18,
    });
  });

  it('validates a scenario template payload', () => {
    expect(
      scenarioTemplateSchema.parse({
        id: 'template-preprod-01',
        name: 'Preprod release window',
        description: 'Baseline release-window template.',
        definition: {
          mode: 'PREPROD',
          targetBaseUrl: 'https://preprod-api.example.com',
          inventoryPoolId: 'inventory-main',
          maxGlobalQps: 2400,
          maxNodeConcurrency: 180,
          tags: {
            cohort: 'release-window',
          },
          requestTemplates: {
            query: {
              method: 'GET',
              path: '/api/catalog/events',
              timeoutMs: 1500,
            },
            queue: {
              method: 'GET',
              path: '/api/queue/status',
              timeoutMs: 1500,
            },
            inventoryLock: {
              method: 'POST',
              path: '/api/checkout/draft-orders',
              timeoutMs: 2500,
            },
            orderSubmit: {
              method: 'POST',
              path: '/api/orders/submit',
              timeoutMs: 2500,
            },
          },
          phases: [
            {
              id: 'warmup',
              startsAtOffsetMs: 0,
              durationMs: 1500000,
              queryConcurrency: 30,
              queuePollingConcurrency: 0,
              inventoryLockConcurrency: 0,
              orderSubmissionConcurrency: 0,
            },
          ],
        },
      }),
    ).toMatchObject({
      id: 'template-preprod-01',
      definition: {
        mode: 'PREPROD',
      },
    });
  });

  it('rejects a scenario template payload without a description', () => {
    expect(() =>
      scenarioTemplateSchema.parse({
        id: 'template-preprod-01',
        name: 'Preprod release window',
        definition: {
          mode: 'PREPROD',
          targetBaseUrl: 'https://preprod-api.example.com',
          inventoryPoolId: 'inventory-main',
          maxGlobalQps: 2400,
          maxNodeConcurrency: 180,
          tags: {
            cohort: 'release-window',
          },
          requestTemplates: {
            query: {
              method: 'GET',
              path: '/api/catalog/events',
              timeoutMs: 1500,
            },
            queue: {
              method: 'GET',
              path: '/api/queue/status',
              timeoutMs: 1500,
            },
            inventoryLock: {
              method: 'POST',
              path: '/api/checkout/draft-orders',
              timeoutMs: 2500,
            },
            orderSubmit: {
              method: 'POST',
              path: '/api/orders/submit',
              timeoutMs: 2500,
            },
          },
          phases: [
            {
              id: 'warmup',
              startsAtOffsetMs: 0,
              durationMs: 1500000,
              queryConcurrency: 30,
              queuePollingConcurrency: 0,
              inventoryLockConcurrency: 0,
              orderSubmissionConcurrency: 0,
            },
          ],
        },
      }),
    ).toThrow();
  });

  it('validates a node pool payload', () => {
    expect(
      nodePoolSchema.parse({
        id: 'pool-hk-anchor',
        name: 'Hong Kong anchor pool',
        region: 'hk',
        role: 'ANCHOR',
        maxNodes: 3,
        nodeIds: ['node-hk-1', 'node-hk-2'],
      }),
    ).toMatchObject({
      id: 'pool-hk-anchor',
      maxNodes: 3,
      nodeIds: ['node-hk-1', 'node-hk-2'],
    });
  });

  it('rejects a node pool payload with a non-positive maxNodes value', () => {
    expect(() =>
      nodePoolSchema.parse({
        id: 'pool-hk-anchor',
        name: 'Hong Kong anchor pool',
        region: 'hk',
        role: 'ANCHOR',
        maxNodes: 0,
        nodeIds: ['node-hk-1'],
      }),
    ).toThrow();
  });

  it('validates a control run draft payload', () => {
    expect(
      controlRunDraftSchema.parse({
        id: 'run-control-01',
        templateId: 'template-preprod-01',
        nodePoolId: 'pool-hk-anchor',
        definition: {
          id: 'run_preprod_20260417_001',
          mode: 'PREPROD',
          targetBaseUrl: 'https://preprod-api.example.com',
          inventoryPoolId: 'inventory-main',
          maxGlobalQps: 2400,
          maxNodeConcurrency: 180,
          tags: {
            release: '2026-04-18',
          },
          requestTemplates: {
            query: {
              method: 'GET',
              path: '/api/catalog/events',
              timeoutMs: 1500,
            },
            queue: {
              method: 'GET',
              path: '/api/queue/status',
              timeoutMs: 1500,
            },
            inventoryLock: {
              method: 'POST',
              path: '/api/checkout/draft-orders',
              timeoutMs: 2500,
            },
            orderSubmit: {
              method: 'POST',
              path: '/api/orders/submit',
              timeoutMs: 2500,
            },
          },
          phases: [
            {
              id: 'warmup',
              startsAtOffsetMs: 0,
              durationMs: 1500000,
              queryConcurrency: 30,
              queuePollingConcurrency: 0,
              inventoryLockConcurrency: 0,
              orderSubmissionConcurrency: 0,
            },
          ],
        },
      }),
    ).toMatchObject({
      id: 'run-control-01',
      templateId: 'template-preprod-01',
    });
  });

  it('validates a control run record payload', () => {
    expect(
      controlRunRecordSchema.parse({
        id: 'run-control-01',
        templateId: 'template-preprod-01',
        nodePoolId: 'pool-hk-anchor',
        mode: 'PREPROD',
        targetBaseUrl: 'https://preprod-api.example.com',
        status: 'RUNNING',
        tags: {
          release: '2026-04-18',
        },
        createdAt: '2026-04-18T09:30:00.000Z',
        updatedAt: '2026-04-18T09:35:00.000Z',
      }),
    ).toMatchObject({
      status: 'RUNNING',
      nodePoolId: 'pool-hk-anchor',
    });
  });

  it('validates a node health status payload through the planned symbol', () => {
    expect(nodeHealthStatusSchema.parse('ONLINE')).toBe('ONLINE');
    expect(nodeHealthStatusSchema.parse('DEGRADED')).toBe('DEGRADED');
    expect(nodeHealthStatusSchema.parse('OFFLINE')).toBe('OFFLINE');
    expect(nodeHealthStatusSchema.parse('BUSY')).toBe('BUSY');
    expect(runStatusSchema.parse('PLANNED')).toBe('PLANNED');
    expect(runStatusSchema.parse('STOPPING')).toBe('STOPPING');
    expect(runStatusSchema.parse('STOPPED')).toBe('STOPPED');
  });

  it('validates a node telemetry sample payload', () => {
    expect(
      nodeTelemetrySampleSchema.parse({
        runId: 'run-control-01',
        nodeId: 'node-hk-1',
        phaseId: null,
        status: 'BUSY',
        qps: 218.5,
        errorRate: 0.012,
        p95LatencyMs: 240,
        activeWorkers: 28,
        recordedAt: '2026-04-18T09:40:00.000Z',
      }),
    ).toMatchObject({
      runId: 'run-control-01',
      phaseId: null,
      status: 'BUSY',
      qps: 218.5,
    });
  });

  it('validates a live run snapshot payload', () => {
    expect(
      liveRunSnapshotSchema.parse({
        runId: 'run-control-01',
        status: 'RUNNING',
        currentPhaseId: null,
        aggregateQps: 218.5,
        aggregateErrorRate: 0.012,
        aggregateP95LatencyMs: 240,
        activeNodeCount: 1,
        unhealthyNodeCount: 0,
        nodes: [
          {
            nodeId: 'node-hk-1',
            region: 'hk',
            role: 'CONTROL',
            status: 'DEGRADED',
            phaseId: null,
            qps: 218.5,
            errorRate: 0.012,
            p95LatencyMs: 240,
            activeWorkers: 28,
            recordedAt: '2026-04-18T09:40:00.000Z',
          },
        ],
        alerts: [
          {
            id: 'alert-001',
            severity: 'CRITICAL',
            message: 'One node is degraded',
            recordedAt: '2026-04-18T09:40:00.000Z',
          },
        ],
        updatedAt: '2026-04-18T09:40:00.000Z',
      }),
    ).toMatchObject({
      runId: 'run-control-01',
      status: 'RUNNING',
      currentPhaseId: null,
    });
  });

  it('validates a calibration report with one recommendation', () => {
    expect(
      calibrationReportSchema.parse({
        baselineRunId: 'run_preprod_20260417_001',
        productionRunId: 'run_prod_20260417_001',
        realismScore: 91,
        capacityScore: 88,
        fairnessScore: 86,
        controlScore: 94,
        recommendedUpdates: [
          {
            field: 'network.hk-anchor.baseLatencyMs',
            previousValue: 18,
            recommendedValue: 22,
          },
        ],
      }),
    ).toMatchObject({
      realismScore: 91,
      controlScore: 94,
    });
  });
});
