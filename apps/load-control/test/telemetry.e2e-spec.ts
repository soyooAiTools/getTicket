import 'reflect-metadata';

import { AddressInfo } from 'node:net';

import { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { createLoadControlE2eApp } from './e2e-app';

describe('Telemetry endpoints', () => {
  let app: INestApplication;

  beforeEach(async () => {
    app = await createLoadControlE2eApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('ingests telemetry and returns a live snapshot', async () => {
    const node = {
      id: 'node-telemetry-01',
      region: 'ap-southeast-1',
      role: 'CONTROL',
      networkProfile: {
        id: 'net-telemetry-1',
        label: 'steady',
        baseLatencyMs: 25,
        jitterMs: 5,
        packetLossRatio: 0.01,
      },
      maxConcurrency: 12,
    };
    const run = {
      id: 'run-telemetry-01',
      templateId: 'template-preprod-01',
      nodePoolId: 'pool-control-01',
      definition: {
        id: 'run-telemetry-01',
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
      .post('/control/runs/run-telemetry-01/plan')
      .expect(201);

    await request(app.getHttpServer())
      .post('/control/runs/run-telemetry-01/start')
      .expect(201);

    await request(app.getHttpServer())
      .post('/control/telemetry')
      .send({
        runId: 'run-telemetry-01',
        nodeId: 'node-telemetry-01',
        phaseId: 'warmup',
        status: 'BUSY',
        qps: 42.5,
        errorRate: 0.03,
        p95LatencyMs: 280,
        activeWorkers: 7,
        recordedAt: '2026-04-18T10:00:00.000Z',
      })
      .expect(201);

    await request(app.getHttpServer())
      .get('/control/runs/run-telemetry-01/live')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          runId: 'run-telemetry-01',
          status: 'RUNNING',
          currentPhaseId: 'warmup',
          aggregateQps: 42.5,
          aggregateErrorRate: 0.03,
          aggregateP95LatencyMs: 280,
          activeNodeCount: 1,
          unhealthyNodeCount: 1,
          nodes: [
            expect.objectContaining({
              nodeId: 'node-telemetry-01',
              region: 'ap-southeast-1',
              role: 'CONTROL',
              status: 'BUSY',
            }),
          ],
          alerts: [
            expect.objectContaining({
              severity: 'WARN',
            }),
          ],
        });
      });
  });

  it('streams the latest live snapshot over SSE', async () => {
    const node = {
      id: 'node-stream-01',
      region: 'ap-southeast-1',
      role: 'CONTROL',
      networkProfile: {
        id: 'net-stream-1',
        label: 'steady',
        baseLatencyMs: 25,
        jitterMs: 5,
        packetLossRatio: 0.01,
      },
      maxConcurrency: 12,
    };
    const run = {
      id: 'run-stream-01',
      templateId: 'template-preprod-01',
      nodePoolId: 'pool-control-01',
      definition: {
        id: 'run-stream-01',
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
      .post('/control/runs/run-stream-01/plan')
      .expect(201);

    await request(app.getHttpServer())
      .post('/control/runs/run-stream-01/start')
      .expect(201);

    await request(app.getHttpServer())
      .post('/control/telemetry')
      .send({
        runId: 'run-stream-01',
        nodeId: 'node-stream-01',
        phaseId: 'warmup',
        status: 'ONLINE',
        qps: 18,
        errorRate: 0,
        p95LatencyMs: 140,
        activeWorkers: 3,
        recordedAt: '2026-04-18T10:05:00.000Z',
      })
      .expect(201);

    await app.listen(0);
    const port = (app.getHttpServer().address() as AddressInfo).port;
    const controller = new AbortController();
    const response = await fetch(
      `http://127.0.0.1:${port}/control/runs/run-stream-01/stream`,
      {
        headers: {
          accept: 'text/event-stream',
        },
        signal: controller.signal,
      },
    );

    expect(response.ok).toBe(true);
    expect(response.headers.get('content-type')).toContain('text/event-stream');

    const reader = response.body?.getReader();
    expect(reader).toBeDefined();

    const firstChunk = await reader!.read();
    const payload = new TextDecoder().decode(firstChunk.value);
    const dataLine = payload
      .split('\n')
      .find((line) => line.startsWith('data: '));

    expect(dataLine).toBeDefined();
    expect(JSON.parse(dataLine!.slice(6))).toMatchObject({
      runId: 'run-stream-01',
      status: 'RUNNING',
      currentPhaseId: 'warmup',
    });

    controller.abort();
  });
});
