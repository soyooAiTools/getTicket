import 'reflect-metadata';

import { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { ControlService } from '../src/modules/control/control.service';
import { createLoadControlE2eApp } from './e2e-app';

describe('Reports endpoints', () => {
  let app: INestApplication;

  beforeEach(async () => {
    app = await createLoadControlE2eApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('rejects calibration reports for runs that are not completed', async () => {
    const draftRun = {
      templateId: 'template-report-check',
      nodePoolId: 'pool-report-check',
      definition: {
        mode: 'PREPROD',
        targetBaseUrl: 'https://preprod.example.com',
        inventoryPoolId: 'inventory-main',
        maxGlobalQps: 200,
        maxNodeConcurrency: 16,
        tags: {
          test_run_id: 'report-check',
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
      .post('/control/runs')
      .send({
        id: 'run-report-baseline',
        ...draftRun,
        definition: {
          id: 'run-report-baseline',
          ...draftRun.definition,
        },
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/control/runs')
      .send({
        id: 'run-report-production',
        ...draftRun,
        definition: {
          id: 'run-report-production',
          ...draftRun.definition,
        },
      })
      .expect(201);

    await request(app.getHttpServer())
      .get(
        '/control/reports/calibration/run-report-baseline/run-report-production',
      )
      .expect(400)
      .expect(({ body }) => {
        expect(body.message).toBe(
          'Calibration reports require completed baseline and production runs.',
        );
      });
  });

  it('returns a calibration report for completed runs', async () => {
    const node = {
      id: 'node-report-01',
      region: 'ap-southeast-1',
      role: 'CONTROL',
      networkProfile: {
        id: 'net-report-1',
        label: 'steady',
        baseLatencyMs: 25,
        jitterMs: 5,
        packetLossRatio: 0.01,
      },
      maxConcurrency: 12,
    };
    const draftRun = {
      templateId: 'template-report-success',
      nodePoolId: 'pool-report-success',
      definition: {
        mode: 'PREPROD',
        targetBaseUrl: 'https://preprod.example.com',
        inventoryPoolId: 'inventory-main',
        maxGlobalQps: 200,
        maxNodeConcurrency: 16,
        tags: {
          test_run_id: 'report-success',
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
      .send({
        id: 'run-report-baseline-ok',
        ...draftRun,
        definition: {
          id: 'run-report-baseline-ok',
          ...draftRun.definition,
        },
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/control/runs')
      .send({
        id: 'run-report-production-ok',
        ...draftRun,
        definition: {
          id: 'run-report-production-ok',
          ...draftRun.definition,
        },
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/control/runs/run-report-baseline-ok/plan')
      .expect(201);

    await request(app.getHttpServer())
      .post('/control/runs/run-report-production-ok/plan')
      .expect(201);

    await request(app.getHttpServer())
      .post('/control/runs/run-report-baseline-ok/results')
      .send({
        runId: 'run-report-baseline-ok',
        nodeId: 'node-report-01',
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

    await request(app.getHttpServer())
      .post('/control/runs/run-report-production-ok/results')
      .send({
        runId: 'run-report-production-ok',
        nodeId: 'node-report-01',
        region: 'ap-southeast-1',
        role: 'CONTROL',
        mode: 'PREPROD',
        averageRttMs: 24,
        startupSkewMs: 3,
        phaseSummaries: [
          {
            phaseId: 'warmup',
            requestCount: 100,
            successCount: 92,
            averageLatencyMs: 210,
          },
        ],
      })
      .expect(201);

    app.get(ControlService).runs.clear();

    await request(app.getHttpServer())
      .get(
        '/control/reports/calibration/run-report-baseline-ok/run-report-production-ok',
      )
      .expect(200)
      .expect(({ body }) => {
        expect(body.baselineRunId).toBe('run-report-baseline-ok');
        expect(body.productionRunId).toBe('run-report-production-ok');
      });
  });
});
