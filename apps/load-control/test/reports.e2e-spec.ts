import 'reflect-metadata';

import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module';

describe('Reports endpoints', () => {
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

  it('rejects calibration reports for runs that are not completed', async () => {
    const draftRun = {
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
    };

    await request(app.getHttpServer())
      .post('/control/runs')
      .send({
        id: 'run-report-baseline',
        ...draftRun,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/control/runs')
      .send({
        id: 'run-report-production',
        ...draftRun,
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
});
