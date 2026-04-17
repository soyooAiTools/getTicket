import 'reflect-metadata';

import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module';

describe('Control endpoints', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('control');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('registers a node at POST /control/nodes/register', async () => {
    const payload = {
      id: 'node-01',
      region: 'ap-southeast-1',
      role: 'CONTROL',
      networkProfile: {
        id: 'net-1',
        label: 'steady',
        baseLatencyMs: 25,
        jitterMs: 5,
        packetLossRatio: 0.01,
      },
      maxConcurrency: 12,
    };

    await request(app.getHttpServer())
      .post('/control/nodes/register')
      .send(payload)
      .expect(201)
      .expect(payload);
  });

  it('creates a draft run at POST /control/runs', async () => {
    const payload = {
      id: 'run-01',
      mode: 'PREPROD',
      targetBaseUrl: 'https://preprod.example.com',
      inventoryPoolId: 'inventory-main',
      maxGlobalQps: 200,
      maxNodeConcurrency: 16,
      tags: {
        team: 'growth',
        release: '2026-04-17',
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
      phases: [
        {
          id: 'warmup',
          startsAtOffsetMs: 0,
          durationMs: 30000,
          queryConcurrency: 4,
          queuePollingConcurrency: 2,
          inventoryLockConcurrency: 2,
          orderSubmissionConcurrency: 1,
        },
      ],
    };

    await request(app.getHttpServer())
      .post('/control/runs')
      .send(payload)
      .expect(201)
      .expect({
        definition: payload,
        status: 'DRAFT',
        assignments: [],
        summaries: [],
      });
  });

  it('rejects partial phase summaries at POST /control/runs/:runId/results', async () => {
    const node = {
      id: 'node-results-01',
      region: 'ap-southeast-1',
      role: 'CONTROL',
      networkProfile: {
        id: 'net-results-1',
        label: 'steady',
        baseLatencyMs: 25,
        jitterMs: 5,
        packetLossRatio: 0.01,
      },
      maxConcurrency: 12,
    };
    const run = {
      id: 'run-results-01',
      mode: 'PREPROD',
      targetBaseUrl: 'https://preprod.example.com',
      inventoryPoolId: 'inventory-main',
      maxGlobalQps: 200,
      maxNodeConcurrency: 16,
      tags: {
        team: 'growth',
        release: '2026-04-17',
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
      phases: [
        {
          id: 'warmup',
          startsAtOffsetMs: 0,
          durationMs: 30000,
          queryConcurrency: 4,
          queuePollingConcurrency: 2,
          inventoryLockConcurrency: 2,
          orderSubmissionConcurrency: 1,
        },
        {
          id: 'steady',
          startsAtOffsetMs: 30000,
          durationMs: 45000,
          queryConcurrency: 6,
          queuePollingConcurrency: 3,
          inventoryLockConcurrency: 2,
          orderSubmissionConcurrency: 2,
        },
      ],
    };

    await request(app.getHttpServer())
      .post('/control/nodes/register')
      .send(node)
      .expect(201);

    await request(app.getHttpServer())
      .post('/control/runs')
      .send(run)
      .expect(201);

    await request(app.getHttpServer())
      .post('/control/runs/run-results-01/plan')
      .expect(201);

    await request(app.getHttpServer())
      .post('/control/runs/run-results-01/results')
      .send({
        runId: 'run-results-01',
        nodeId: 'node-results-01',
        region: 'ap-southeast-1',
        role: 'CONTROL',
        mode: 'PREPROD',
        averageRttMs: 28,
        startupSkewMs: 0,
        phaseSummaries: [
          {
            phaseId: 'warmup',
            requestCount: 9,
            successCount: 9,
            averageLatencyMs: 18,
          },
        ],
      })
      .expect(400)
      .expect(({ body }) => {
        expect(body.message).toBe(
          'Summary for node node-results-01 must match assigned phases [steady, warmup]. Missing [steady].',
        );
      });

    await request(app.getHttpServer())
      .get('/control/runs/run-results-01')
      .expect(200)
      .expect(({ body }) => {
        expect(body.status).toBe('PLANNED');
        expect(body.summaries).toEqual([]);
      });
  });
});
