import 'reflect-metadata';

import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module';

describe('Validation guardrails', () => {
  const originalAllowProductionWrite =
    process.env.LOAD_CONTROL_ALLOW_PRODUCTION_WRITE;
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

  afterEach(() => {
    if (originalAllowProductionWrite === undefined) {
      delete process.env.LOAD_CONTROL_ALLOW_PRODUCTION_WRITE;
      return;
    }

    process.env.LOAD_CONTROL_ALLOW_PRODUCTION_WRITE =
      originalAllowProductionWrite;
  });

  it('creates an OBSERVE_ONLY run definition', async () => {
    const payload = {
      id: 'run-observe-01',
      mode: 'OBSERVE_ONLY',
      targetBaseUrl: 'https://preprod.example.com',
      maxGlobalQps: 120,
      maxNodeConcurrency: 16,
      tags: {
        test_run_id: 'run-observe-01',
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
          id: 'observe',
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
      .send(payload)
      .expect(201)
      .expect({
        definition: payload,
        status: 'DRAFT',
        assignments: [],
        summaries: [],
      });
  });

  it('rejects planning OBSERVE_ONLY runs with write pools', async () => {
    const payload = {
      id: 'run-observe-02',
      mode: 'OBSERVE_ONLY',
      targetBaseUrl: 'https://preprod.example.com',
      maxGlobalQps: 120,
      maxNodeConcurrency: 16,
      tags: {
        test_run_id: 'run-observe-02',
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
          id: 'observe',
          startsAtOffsetMs: 0,
          durationMs: 30000,
          queryConcurrency: 4,
          queuePollingConcurrency: 2,
          inventoryLockConcurrency: 1,
          orderSubmissionConcurrency: 1,
        },
      ],
    };

    await request(app.getHttpServer())
      .post('/control/runs')
      .send(payload)
      .expect(201);

    await request(app.getHttpServer())
      .post('/control/runs/run-observe-02/plan')
      .send({})
      .expect(400)
      .expect(({ body }) => {
        expect(body.message).toBe(
          'OBSERVE_ONLY runs cannot include write concurrency.',
        );
      });
  });

  it('rejects planning non-PREPROD runs without tags.test_run_id', async () => {
    const payload = {
      id: 'run-observe-03',
      mode: 'OBSERVE_ONLY',
      targetBaseUrl: 'https://preprod.example.com',
      maxGlobalQps: 120,
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
          id: 'observe',
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
      .send(payload)
      .expect(201);

    await request(app.getHttpServer())
      .post('/control/runs/run-observe-03/plan')
      .send({})
      .expect(400)
      .expect(({ body }) => {
        expect(body.message).toBe(
          'Production validation runs require tags.test_run_id.',
        );
      });
  });

  it('rejects planning GRAY_VALIDATION runs when production writes are disabled', async () => {
    process.env.LOAD_CONTROL_ALLOW_PRODUCTION_WRITE = 'false';

    const payload = {
      id: 'run-gray-01',
      mode: 'GRAY_VALIDATION',
      targetBaseUrl: 'https://prod.example.com',
      inventoryPoolId: 'inventory-main',
      maxGlobalQps: 150,
      maxNodeConcurrency: 16,
      tags: {
        test_run_id: 'run-gray-01',
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
          id: 'gray',
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
      .send(payload)
      .expect(201);

    await request(app.getHttpServer())
      .post('/control/runs/run-gray-01/plan')
      .send({})
      .expect(400)
      .expect(({ body }) => {
        expect(body.message).toBe(
          'Write-capable production validation modes require LOAD_CONTROL_ALLOW_PRODUCTION_WRITE=true.',
        );
      });
  });
});
