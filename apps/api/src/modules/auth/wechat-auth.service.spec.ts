import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createHash } from 'crypto';

import { PrismaService } from '../../common/prisma/prisma.service';
import { AuthController } from './auth.controller';
import { WechatAuthService } from './wechat-auth.service';

describe('WechatAuthService', () => {
  const fetchMock = jest.fn();
  const randomBytesMock = jest.spyOn(require('crypto'), 'randomBytes');

  const prismaMock = {
    customerAccount: {
      upsert: jest.fn(),
    },
    customerSession: {
      create: jest.fn(),
    },
  } as unknown as PrismaService;

  beforeEach(() => {
    process.env.WECHAT_APP_ID = 'miniapp-app-id';
    process.env.WECHAT_APP_SECRET = 'miniapp-secret';
    jest.clearAllMocks();
    fetchMock.mockReset();
    randomBytesMock.mockReset();
    randomBytesMock.mockReturnValue(Buffer.from('abcdefghijklmnopqrstuvwx'));
    prismaMock.customerAccount.upsert = jest.fn();
    prismaMock.customerSession.create = jest.fn();
    (globalThis as typeof globalThis & { fetch: typeof fetchMock }).fetch =
      fetchMock;
  });

  afterEach(() => {
    delete process.env.WECHAT_APP_ID;
    delete process.env.WECHAT_APP_SECRET;
    jest.useRealTimers();
  });

  it('exchanges a code with WeChat, persists the customer session, and returns a miniapp session payload', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-17T09:30:00.000Z'));

    fetchMock.mockResolvedValue({
      json: jest.fn().mockResolvedValue({
        openid: 'openid_abc123',
        session_key: 'wechat-session-key',
      }),
      ok: true,
    });
    prismaMock.customerAccount.upsert = jest.fn().mockResolvedValue({
      id: 'cust_001',
      wechatOpenId: 'openid_abc123',
    });
    prismaMock.customerSession.create = jest.fn().mockResolvedValue({
      id: 'session_001',
    });

    const moduleRef = await Test.createTestingModule({
      providers: [
        WechatAuthService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    const service = moduleRef.get(WechatAuthService);
    const result = await service.loginWithCode('auth code+123&x=y');

    const rawToken = Buffer.from('abcdefghijklmnopqrstuvwx').toString('hex');
    const expectedExpiresAt = new Date(
      Date.parse('2026-04-17T09:30:00.000Z') + 7 * 24 * 60 * 60 * 1000,
    ).toISOString();

    const [requestUrl] = fetchMock.mock.calls[0] as [string];
    const parsedUrl = new URL(requestUrl);

    expect(parsedUrl.origin + parsedUrl.pathname).toBe(
      'https://api.weixin.qq.com/sns/jscode2session',
    );
    expect(parsedUrl.searchParams.get('appid')).toBe('miniapp-app-id');
    expect(parsedUrl.searchParams.get('secret')).toBe('miniapp-secret');
    expect(parsedUrl.searchParams.get('js_code')).toBe('auth code+123&x=y');
    expect(parsedUrl.searchParams.get('grant_type')).toBe('authorization_code');
    expect(prismaMock.customerAccount.upsert).toHaveBeenCalledWith({
      where: {
        wechatOpenId: 'openid_abc123',
      },
      update: {},
      create: {
        wechatOpenId: 'openid_abc123',
      },
      select: {
        id: true,
        wechatOpenId: true,
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
        id: 'cust_001',
        openId: 'openid_abc123',
      },
      expiresAt: expectedExpiresAt,
    });
  });

  it('rejects a WeChat transport failure before creating persistence records', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));

    const moduleRef = await Test.createTestingModule({
      providers: [
        WechatAuthService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    const service = moduleRef.get(WechatAuthService);

    await expect(service.loginWithCode('bad-code')).rejects.toThrow(
      new BadRequestException('WeChat login exchange failed.'),
    );
    expect(prismaMock.customerAccount.upsert).not.toHaveBeenCalled();
    expect(prismaMock.customerSession.create).not.toHaveBeenCalled();
  });

  it('rejects a WeChat JSON parse failure before creating persistence records', async () => {
    fetchMock.mockResolvedValue({
      json: jest.fn().mockRejectedValue(new Error('bad json')),
      ok: true,
    });

    const moduleRef = await Test.createTestingModule({
      providers: [
        WechatAuthService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    const service = moduleRef.get(WechatAuthService);

    await expect(service.loginWithCode('bad-code')).rejects.toThrow(
      new BadRequestException('WeChat login exchange failed.'),
    );
    expect(prismaMock.customerAccount.upsert).not.toHaveBeenCalled();
    expect(prismaMock.customerSession.create).not.toHaveBeenCalled();
  });

  it('rejects empty login codes at the controller boundary', () => {
    const controller = new AuthController({
      loginWithCode: jest.fn(),
    } as unknown as WechatAuthService);

    expect(() => controller.login({ code: '   ' })).toThrow(
      new BadRequestException('code is required.'),
    );
  });

  it('trims the code and returns the service payload at the controller boundary', async () => {
    const loginWithCode = jest.fn().mockResolvedValue({
      token: 'session-token-123',
      customer: {
        id: 'cust_001',
        openId: 'openid_abc123',
      },
      expiresAt: '2026-04-24T09:30:00.000Z',
    });
    const controller = new AuthController({
      loginWithCode,
    } as unknown as WechatAuthService);

    await expect(controller.login({ code: ' auth-code-123 ' })).resolves.toEqual({
      customer: {
        id: 'cust_001',
        openId: 'openid_abc123',
      },
      expiresAt: '2026-04-24T09:30:00.000Z',
      token: 'session-token-123',
    });
    expect(loginWithCode).toHaveBeenCalledWith('auth-code-123');
  });
});
