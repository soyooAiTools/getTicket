import {
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createHash } from 'crypto';

import { PrismaService } from '../../common/prisma/prisma.service';
import { AuthController } from './auth.controller';
import { SessionBootstrapService } from './session-bootstrap.service';

describe('SessionBootstrapService', () => {
  const randomBytesMock = jest.spyOn(require('crypto'), 'randomBytes');
  const prismaMock = {
    customerAccount: {
      upsert: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    customerSession: {
      create: jest.fn(),
    },
  } as unknown as PrismaService;

  beforeEach(() => {
    jest.clearAllMocks();
    randomBytesMock.mockReset();
    randomBytesMock.mockReturnValue(Buffer.from('abcdefghijklmnopqrstuvwx'));
    prismaMock.customerAccount.upsert = jest.fn();
    prismaMock.customerAccount.findUniqueOrThrow = jest.fn();
    prismaMock.customerSession.create = jest.fn();
  });

  afterEach(() => {
    jest.useRealTimers();
    delete process.env.LOAD_TEST_INTERNAL_SECRET;
  });

  it('bootstraps a generic customer session for an account key', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-17T09:30:00.000Z'));
    prismaMock.customerAccount.upsert = jest.fn().mockResolvedValue({
      accountKey: 'loadtest:node-local-user-01',
      id: 'cust_001',
    });
    prismaMock.customerSession.create = jest.fn().mockResolvedValue({
      id: 'session_001',
    });

    const moduleRef = await Test.createTestingModule({
      providers: [
        SessionBootstrapService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    const service = moduleRef.get(SessionBootstrapService);
    const result = await service.bootstrapSession('loadtest:node-local-user-01');

    const rawToken = Buffer.from('abcdefghijklmnopqrstuvwx').toString('hex');
    const expectedExpiresAt = new Date(
      Date.parse('2026-04-17T09:30:00.000Z') + 7 * 24 * 60 * 60 * 1000,
    ).toISOString();

    expect(prismaMock.customerAccount.upsert).toHaveBeenCalledWith({
      where: {
        accountKey: 'loadtest:node-local-user-01',
      },
      update: {},
      create: {
        accountKey: 'loadtest:node-local-user-01',
      },
      select: {
        accountKey: true,
        id: true,
      },
    });
    expect(prismaMock.customerSession.create).toHaveBeenCalledWith({
      data: {
        customerId: 'cust_001',
        expiresAt: new Date(expectedExpiresAt),
        tokenHash: createHash('sha256').update(rawToken).digest('hex'),
      },
    });
    expect(result).toEqual({
      token: rawToken,
      customer: {
        accountKey: 'loadtest:node-local-user-01',
        id: 'cust_001',
      },
      expiresAt: expectedExpiresAt,
    });
  });

  it('falls back to the existing customer when concurrent bootstrap hits the account key unique constraint', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-17T09:30:00.000Z'));
    prismaMock.customerAccount.upsert = jest.fn().mockRejectedValue({
      code: 'P2002',
      meta: {
        target: ['accountKey'],
      },
    });
    prismaMock.customerAccount.findUniqueOrThrow = jest.fn().mockResolvedValue({
      accountKey: 'loadtest:node-local-user-01',
      id: 'cust_001',
    });
    prismaMock.customerSession.create = jest.fn().mockResolvedValue({
      id: 'session_001',
    });

    const moduleRef = await Test.createTestingModule({
      providers: [
        SessionBootstrapService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    const service = moduleRef.get(SessionBootstrapService);
    const result = await service.bootstrapSession('loadtest:node-local-user-01');

    expect(prismaMock.customerAccount.upsert).toHaveBeenCalledTimes(1);
    expect(prismaMock.customerAccount.findUniqueOrThrow).toHaveBeenCalledWith({
      where: {
        accountKey: 'loadtest:node-local-user-01',
      },
      select: {
        accountKey: true,
        id: true,
      },
    });
    expect(prismaMock.customerSession.create).toHaveBeenCalledTimes(1);
    expect(result.customer).toEqual({
      accountKey: 'loadtest:node-local-user-01',
      id: 'cust_001',
    });
  });

  it('rejects missing account keys at the controller boundary', () => {
    process.env.LOAD_TEST_INTERNAL_SECRET = 'secret_123';
    const controller = new AuthController({
      bootstrapSession: jest.fn(),
    } as unknown as SessionBootstrapService);

    expect(() =>
      controller.bootstrapSession('secret_123', {
        accountKey: '   ',
      }),
    ).toThrow(new BadRequestException('accountKey is required.'));
  });

  it('rejects invalid bootstrap secrets at the controller boundary', () => {
    process.env.LOAD_TEST_INTERNAL_SECRET = 'secret_123';
    const controller = new AuthController({
      bootstrapSession: jest.fn(),
    } as unknown as SessionBootstrapService);

    expect(() =>
      controller.bootstrapSession('wrong-secret', {
        accountKey: 'loadtest:node-local-user-01',
      }),
    ).toThrow(
      new UnauthorizedException('Load-test bootstrap secret is required.'),
    );
  });

  it('delegates bootstrap requests with a trimmed account key', async () => {
    process.env.LOAD_TEST_INTERNAL_SECRET = 'secret_123';
    const bootstrapSession = jest.fn().mockResolvedValue({
      token: 'session-token-123',
      customer: {
        accountKey: 'loadtest:node-local-user-01',
        id: 'cust_001',
      },
      expiresAt: '2026-04-24T09:30:00.000Z',
    });
    const controller = new AuthController({
      bootstrapSession,
    } as unknown as SessionBootstrapService);

    await expect(
      controller.bootstrapSession('secret_123', {
        accountKey: ' loadtest:node-local-user-01 ',
      }),
    ).resolves.toEqual({
      token: 'session-token-123',
      customer: {
        accountKey: 'loadtest:node-local-user-01',
        id: 'cust_001',
      },
      expiresAt: '2026-04-24T09:30:00.000Z',
    });
    expect(bootstrapSession).toHaveBeenCalledWith(
      'loadtest:node-local-user-01',
    );
  });
});
