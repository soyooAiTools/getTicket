import 'reflect-metadata';

import { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { ControlRepository } from '../src/modules/control/control.repository';
import { ControlService } from '../src/modules/control/control.service';
import { createLoadControlE2eApp } from './e2e-app';

describe('Control endpoints', () => {
  let app: INestApplication;

  beforeEach(async () => {
    app = await createLoadControlE2eApp();
  });

  afterEach(async () => {
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

  it('lists seeded node pools and templates', async () => {
    await request(app.getHttpServer())
      .get('/control/node-pools')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: 'pool-control-01',
              role: 'CONTROL',
            }),
          ]),
        );
      });

    await request(app.getHttpServer())
      .get('/control/templates')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: 'template-preprod-01',
              name: expect.any(String),
            }),
          ]),
        );
      });
  });

  it('creates a draft run at POST /control/runs', async () => {
    const payload = {
      id: 'run-01',
      templateId: 'template-preprod-01',
      nodePoolId: 'pool-control-01',
      definition: {
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
      },
    };

    await request(app.getHttpServer())
      .post('/control/runs')
      .send(payload)
      .expect(201)
      .expect({
        definition: payload.definition,
        status: 'DRAFT',
        assignments: [],
        summaries: [],
      });

    await expect(
      (
        app.get(ControlRepository) as Pick<ControlRepository, 'getRun'>
      ).getRun('run-01'),
    ).resolves.toMatchObject({
      id: 'run-01',
      templateId: 'template-preprod-01',
      nodePoolId: 'pool-control-01',
      definition: payload.definition,
    });
  });

  it('returns 400 when a draft run payload fails zod validation', async () => {
    await request(app.getHttpServer())
      .post('/control/runs')
      .send({
        id: 'run-invalid-01',
        templateId: 'template-preprod-01',
        nodePoolId: 'pool-control-01',
        definition: {
          mode: 'PREPROD',
          targetBaseUrl: 'https://preprod.example.com',
          maxGlobalQps: 1,
          maxNodeConcurrency: 1,
          tags: {},
          requestTemplates: {
            query: {
              method: 'GET',
              path: '/catalog',
              timeoutMs: 500,
            },
            queue: {
              method: 'GET',
              path: '/catalog',
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
          phases: [
            {
              id: 'smoke',
              startsAtOffsetMs: 0,
              durationMs: 1000,
              queryConcurrency: 1,
              queuePollingConcurrency: 0,
              inventoryLockConcurrency: 0,
              orderSubmissionConcurrency: 0,
            },
          ],
        },
      })
      .expect(400)
      .expect({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Required',
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
      templateId: 'template-preprod-01',
      nodePoolId: 'pool-control-01',
      definition: {
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
      },
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

  it('reconstructs assignments and summaries from the repository after in-memory state is cleared', async () => {
    const node = {
      id: 'node-cold-01',
      region: 'ap-southeast-1',
      role: 'CONTROL',
      networkProfile: {
        id: 'net-cold-1',
        label: 'steady',
        baseLatencyMs: 25,
        jitterMs: 5,
        packetLossRatio: 0.01,
      },
      maxConcurrency: 12,
    };
    const run = {
      id: 'run-cold-01',
      templateId: 'template-preprod-cold',
      nodePoolId: 'pool-control-cold',
      definition: {
        id: 'run-cold-01',
        mode: 'PREPROD',
        targetBaseUrl: 'https://preprod.example.com',
        inventoryPoolId: 'inventory-main',
        maxGlobalQps: 200,
        maxNodeConcurrency: 16,
        tags: {
          team: 'growth',
          release: '2026-04-18',
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
            inventoryLockConcurrency: 0,
            orderSubmissionConcurrency: 0,
          },
        ],
      },
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
      .post('/control/runs/run-cold-01/plan')
      .expect(201);

    await request(app.getHttpServer())
      .post('/control/runs/run-cold-01/results')
      .send({
        runId: 'run-cold-01',
        nodeId: 'node-cold-01',
        region: 'ap-southeast-1',
        role: 'CONTROL',
        mode: 'PREPROD',
        averageRttMs: 20,
        startupSkewMs: 2,
        phaseSummaries: [
          {
            phaseId: 'warmup',
            requestCount: 100,
            successCount: 96,
            averageLatencyMs: 180,
          },
        ],
      })
      .expect(201);

    app.get(ControlService).runs.clear();

    await request(app.getHttpServer())
      .get('/control/runs/run-cold-01')
      .expect(200)
      .expect(({ body }) => {
        expect(body.status).toBe('COMPLETED');
        expect(body.assignments).toEqual([
          expect.objectContaining({
            runId: 'run-cold-01',
            nodeId: 'node-cold-01',
          }),
        ]);
        expect(body.summaries).toEqual([
          expect.objectContaining({
            runId: 'run-cold-01',
            nodeId: 'node-cold-01',
          }),
        ]);
      });
  });

  it('lists runs and persists start and stop transitions', async () => {
    const node = {
      id: 'node-start-stop-01',
      region: 'ap-southeast-1',
      role: 'CONTROL',
      networkProfile: {
        id: 'net-start-stop-1',
        label: 'steady',
        baseLatencyMs: 25,
        jitterMs: 5,
        packetLossRatio: 0.01,
      },
      maxConcurrency: 12,
    };
    const run = {
      id: 'run-start-stop-01',
      templateId: 'template-preprod-01',
      nodePoolId: 'pool-control-01',
      definition: {
        id: 'run-start-stop-01',
        mode: 'PREPROD',
        targetBaseUrl: 'https://preprod.example.com',
        inventoryPoolId: 'inventory-main',
        maxGlobalQps: 200,
        maxNodeConcurrency: 16,
        tags: {
          team: 'growth',
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
            inventoryLockConcurrency: 0,
            orderSubmissionConcurrency: 0,
          },
        ],
      },
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
      .get('/control/runs')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: 'run-start-stop-01',
              status: 'DRAFT',
            }),
          ]),
        );
      });

    await request(app.getHttpServer())
      .post('/control/runs/run-start-stop-01/plan')
      .expect(201);

    await request(app.getHttpServer())
      .post('/control/runs/run-start-stop-01/start')
      .expect(201)
      .expect(({ body }) => {
        expect(body.status).toBe('RUNNING');
      });

    await request(app.getHttpServer())
      .post('/control/runs/run-start-stop-01/stop')
      .expect(201)
      .expect(({ body }) => {
        expect(body.status).toBe('STOPPING');
      });

    await request(app.getHttpServer())
      .get('/control/runs')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: 'run-start-stop-01',
              status: 'STOPPING',
            }),
          ]),
        );
      });
  });
});
