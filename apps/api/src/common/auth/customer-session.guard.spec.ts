import { UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createHash } from 'crypto';

import { PrismaService } from '../prisma/prisma.service';

import { CustomerSessionGuard } from './customer-session.guard';

describe('CustomerSessionGuard', () => {
  const prismaMock = {
    customerSession: {
      findFirst: jest.fn(),
    },
  } as unknown as PrismaService;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('accepts a valid bearer token and attaches the authenticated customer to the request', async () => {
    prismaMock.customerSession.findFirst = jest.fn().mockResolvedValue({
      customer: {
        id: 'cust_123',
        wechatOpenId: 'openid_abc123',
      },
      expiresAt: new Date('2026-04-24T09:30:00.000Z'),
      id: 'session_123',
      tokenHash: createHash('sha256').update('session-token').digest('hex'),
    });

    const guard = await Test.createTestingModule({
      providers: [
        CustomerSessionGuard,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    const instance = guard.get(CustomerSessionGuard);
    const request = {
      customer: undefined,
      headers: {
        authorization: 'Bearer session-token',
      },
    };
    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as never;

    await expect(instance.canActivate(context)).resolves.toBe(true);
    expect(prismaMock.customerSession.findFirst).toHaveBeenCalledWith({
      include: {
        customer: {
          select: {
            id: true,
            wechatOpenId: true,
          },
        },
      },
      where: {
        expiresAt: {
          gt: expect.any(Date),
        },
        tokenHash: createHash('sha256').update('session-token').digest('hex'),
      },
    });
    expect(request.customer).toEqual({
      id: 'cust_123',
      openId: 'openid_abc123',
    });
  });

  it('rejects requests without a bearer token', async () => {
    const guard = await Test.createTestingModule({
      providers: [
        CustomerSessionGuard,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    const instance = guard.get(CustomerSessionGuard);
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: {},
        }),
      }),
    } as never;

    await expect(instance.canActivate(context)).rejects.toThrow(
      new UnauthorizedException('Authorization bearer token is required.'),
    );
    expect(prismaMock.customerSession.findFirst).not.toHaveBeenCalled();
  });
});
