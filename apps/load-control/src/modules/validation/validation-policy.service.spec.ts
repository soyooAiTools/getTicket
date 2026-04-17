import { BadRequestException } from '@nestjs/common';

import { ValidationPolicyService } from './validation-policy.service';

describe('ValidationPolicyService', () => {
  const originalAllowProductionWrite =
    process.env.LOAD_CONTROL_ALLOW_PRODUCTION_WRITE;
  const baseRun = {
    id: 'run-01',
    mode: 'PREPROD' as const,
    targetBaseUrl: 'https://preprod.example.com',
    inventoryPoolId: 'inventory-main',
    maxGlobalQps: 200,
    maxNodeConcurrency: 16,
    tags: {
      test_run_id: 'run-01',
    },
    requestTemplates: {
      query: {
        method: 'GET' as const,
        path: '/catalog',
        timeoutMs: 500,
      },
      queue: {
        method: 'POST' as const,
        path: '/queue',
        timeoutMs: 500,
      },
      inventoryLock: {
        method: 'POST' as const,
        path: '/inventory/lock',
        timeoutMs: 500,
      },
      orderSubmit: {
        method: 'POST' as const,
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

  afterEach(() => {
    if (originalAllowProductionWrite === undefined) {
      delete process.env.LOAD_CONTROL_ALLOW_PRODUCTION_WRITE;
      return;
    }

    process.env.LOAD_CONTROL_ALLOW_PRODUCTION_WRITE =
      originalAllowProductionWrite;
  });

  it('rejects OBSERVE_ONLY runs with write concurrency', () => {
    const policy = new ValidationPolicyService();

    expect(() =>
      policy.assertAllowed({
        ...baseRun,
        mode: 'OBSERVE_ONLY',
        tags: {
          test_run_id: 'run-01',
        },
        phases: [
          {
            ...baseRun.phases[0],
            inventoryLockConcurrency: 1,
          },
        ],
      }),
    ).toThrow(new BadRequestException('OBSERVE_ONLY runs cannot include write concurrency.'));
  });

  it('rejects WHITELIST_FULL_PATH runs without an inventory pool', () => {
    process.env.LOAD_CONTROL_ALLOW_PRODUCTION_WRITE = 'true';
    const policy = new ValidationPolicyService();

    expect(() =>
      policy.assertAllowed({
        ...baseRun,
        mode: 'WHITELIST_FULL_PATH',
        inventoryPoolId: undefined,
      }),
    ).toThrow(
      new BadRequestException('WHITELIST_FULL_PATH runs require inventoryPoolId.'),
    );
  });

  it('rejects GRAY_VALIDATION runs without an inventory pool', () => {
    process.env.LOAD_CONTROL_ALLOW_PRODUCTION_WRITE = 'true';
    const policy = new ValidationPolicyService();

    expect(() =>
      policy.assertAllowed({
        ...baseRun,
        mode: 'GRAY_VALIDATION',
        inventoryPoolId: undefined,
      }),
    ).toThrow(
      new BadRequestException('GRAY_VALIDATION runs require inventoryPoolId.'),
    );
  });

  it('rejects GRAY_VALIDATION runs above the global QPS limit', () => {
    process.env.LOAD_CONTROL_ALLOW_PRODUCTION_WRITE = 'true';
    const policy = new ValidationPolicyService();

    expect(() =>
      policy.assertAllowed({
        ...baseRun,
        mode: 'GRAY_VALIDATION',
        maxGlobalQps: 151,
      }),
    ).toThrow(
      new BadRequestException(
        'GRAY_VALIDATION runs must keep maxGlobalQps at or below 150.',
      ),
    );
  });

  it.each(['WHITELIST_FULL_PATH', 'GRAY_VALIDATION'] as const)(
    'rejects %s runs when production writes are disabled',
    (mode) => {
      delete process.env.LOAD_CONTROL_ALLOW_PRODUCTION_WRITE;
      const policy = new ValidationPolicyService();

      expect(() =>
        policy.assertAllowed({
          ...baseRun,
          mode,
          maxGlobalQps: 150,
        }),
      ).toThrow(
        new BadRequestException(
          'Write-capable production validation modes require LOAD_CONTROL_ALLOW_PRODUCTION_WRITE=true.',
        ),
      );
    },
  );
});
