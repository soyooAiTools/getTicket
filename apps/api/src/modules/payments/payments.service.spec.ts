import { BadRequestException } from '@nestjs/common';
import { createCipheriv, createSign, generateKeyPairSync } from 'crypto';
import { Test } from '@nestjs/testing';

import { PrismaService } from '../../common/prisma/prisma.service';
import { ORDER_STATUS } from '../orders/order-status';
import { PaymentsController } from './payments.controller';
import { WechatPayGateway } from './wechat-pay.gateway';
import { PaymentsService } from './wechat-pay.service';

function encryptWechatCallbackResource(
  payload: Record<string, unknown>,
  apiV3Key: string,
) {
  const associatedData = 'transaction';
  const nonce = 'nonce-123456';
  const cipher = createCipheriv(
    'aes-256-gcm',
    Buffer.from(apiV3Key, 'utf8'),
    Buffer.from(nonce, 'utf8'),
  );

  cipher.setAAD(Buffer.from(associatedData, 'utf8'));

  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(payload), 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return {
    algorithm: 'AEAD_AES_256_GCM',
    associated_data: associatedData,
    ciphertext: Buffer.concat([ciphertext, authTag]).toString('base64'),
    nonce,
  };
}

function buildWechatCallbackHeaders(
  privateKeyPem: string,
  rawBody: Buffer,
  overrides?: Partial<Record<string, string>>,
) {
  const timestamp = '1713355200';
  const nonce = 'wechat-callback-nonce';
  const signer = createSign('RSA-SHA256');

  signer.update(`${timestamp}\n${nonce}\n${rawBody.toString('utf8')}\n`);
  signer.end();

  return {
    'wechatpay-nonce': nonce,
    'wechatpay-serial': 'platform-serial-123',
    'wechatpay-signature': signer.sign(privateKeyPem, 'base64'),
    'wechatpay-timestamp': timestamp,
    ...overrides,
  };
}

describe('PaymentsService', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      WECHAT_NOTIFY_URL: 'https://beta.example.com/api/payments/wechat/callback',
    };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('creates a WeChat JSAPI payment intent for the current customer pending order', async () => {
    const prismaMock = {
      order: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'ord_1',
          items: [
            {
              ticketTier: {
                session: {
                  event: {
                    title: 'Beta Concert',
                  },
                },
              },
            },
          ],
          orderNumber: 'ORD-001',
          status: 'PENDING_PAYMENT',
          totalAmount: 159800,
        }),
      },
    } as never;

    const gatewayMock = {
      createJsapiIntent: jest.fn().mockResolvedValue({
        appId: 'wx-app-id',
        nonceStr: 'nonce',
        packageValue: 'prepay_id=wx123',
        paySign: 'signature',
        signType: 'RSA',
        timeStamp: '1713355200',
      }),
    } as never;

    const service = new (PaymentsService as any)(
      prismaMock,
      gatewayMock,
      { submitPaidOrder: jest.fn() } as never,
    );

    const result = await Promise.resolve().then(() =>
      (service as any).createWechatIntent({
        customerId: 'cust_1',
        orderId: 'ord_1',
        openId: 'openid_123',
      }),
    );

    expect((prismaMock as any).order.findFirst).toHaveBeenCalledWith({
      include: {
        items: {
          orderBy: {
            createdAt: 'asc',
          },
          include: {
            ticketTier: {
              include: {
                session: {
                  include: {
                    event: true,
                  },
                },
              },
            },
          },
        },
      },
      where: {
        id: 'ord_1',
        status: 'PENDING_PAYMENT',
        userId: 'cust_1',
      },
    });
    expect((gatewayMock as any).createJsapiIntent).toHaveBeenCalledWith({
      amount: 159800,
      description: 'Beta Concert',
      notifyUrl: 'https://beta.example.com/api/payments/wechat/callback',
      openId: 'openid_123',
      outTradeNo: 'ORD-001',
    });
    expect(result).toEqual({
      appId: 'wx-app-id',
      nonceStr: 'nonce',
      packageValue: 'prepay_id=wx123',
      paySign: 'signature',
      signType: 'RSA',
      timeStamp: '1713355200',
    });
  });

  it('routes a payment intent request through the payment service', async () => {
    const serviceMock = {
      createWechatIntent: jest.fn().mockResolvedValue({
        appId: 'wx-app-id',
        nonceStr: 'nonce',
        packageValue: 'prepay_id=wx123',
        paySign: 'signature',
        signType: 'RSA',
        timeStamp: '1713355200',
      }),
    } as never;
    const controller = new PaymentsController(serviceMock);

    const result = await Promise.resolve().then(() =>
      controller.createWechatIntent(
        {
          orderId: 'ord_1',
        } as never,
        {
          id: 'cust_1',
          openId: 'openid_123',
        } as never,
      ),
    );

    expect((serviceMock as any).createWechatIntent).toHaveBeenCalledWith({
      customerId: 'cust_1',
      openId: 'openid_123',
      orderId: 'ord_1',
    });
    expect(result).toEqual({
      appId: 'wx-app-id',
      nonceStr: 'nonce',
      packageValue: 'prepay_id=wx123',
      paySign: 'signature',
      signType: 'RSA',
      timeStamp: '1713355200',
    });
  });

  it('creates a real JSAPI prepay order and signs the returned payload with RSA', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      json: jest.fn().mockResolvedValue({
        prepay_id: 'wx123',
      }),
      ok: true,
    });
    const originalFetch = global.fetch;
    const { privateKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
    });

    process.env.WECHAT_APP_ID = 'wx-app-id';
    process.env.WECHAT_MCH_ID = 'mch-123';
    process.env.WECHAT_MCH_CERT_SERIAL_NO = 'serial-123';
    process.env.WECHAT_PRIVATE_KEY_PEM = privateKey
      .export({
        format: 'pem',
        type: 'pkcs8',
      })
      .toString();

    global.fetch = fetchMock as typeof global.fetch;

    try {
      const gateway = new WechatPayGateway();

      const result = await gateway.createJsapiIntent({
        amount: 159800,
        description: 'Beta Concert',
        notifyUrl: 'https://beta.example.com/api/payments/wechat/callback',
        openId: 'openid_123',
        outTradeNo: 'ORD-001',
      } as never);

      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.mch.weixin.qq.com/v3/pay/transactions/jsapi',
        expect.objectContaining({
          method: 'POST',
        }),
      );

      const requestInit = fetchMock.mock.calls[0]?.[1] as globalThis.RequestInit;
      expect(requestInit.headers).toMatchObject({
        'content-type': 'application/json',
        Authorization: expect.stringMatching(/^WECHATPAY2-SHA256-RSA2048 /),
      });
      const authorization = (requestInit.headers as Record<string, string>).Authorization;
      expect(authorization).toContain('mchid="mch-123"');
      expect(authorization).toContain('serial_no="serial-123"');
      expect(authorization).toContain('nonce_str="');
      expect(authorization).toContain('timestamp="');
      expect(authorization).toContain('signature="');
      expect(JSON.parse(String(requestInit.body))).toEqual({
        amount: {
          currency: 'CNY',
          total: 159800,
        },
        appid: 'wx-app-id',
        description: 'Beta Concert',
        mchid: 'mch-123',
        notify_url: 'https://beta.example.com/api/payments/wechat/callback',
        out_trade_no: 'ORD-001',
        payer: {
          openid: 'openid_123',
        },
      });
      expect(result.appId).toBe('wx-app-id');
      expect(result.packageValue).toBe('prepay_id=wx123');
      expect(result.signType).toBe('RSA');
      expect(result.paySign.length).toBeGreaterThan(0);
    } finally {
      global.fetch = originalFetch;
      process.env = originalEnv;
    }
  });

  it('maps a real WeChat payment callback payload into the paid-order transition', async () => {
    process.env.WECHAT_API_V3_KEY = '12345678901234567890123456789012';
    process.env.WECHAT_APP_ID = 'wx-app-id';
    process.env.WECHAT_MCH_ID = 'mch-123';
    const { privateKey, publicKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
    });
    process.env.WECHAT_PLATFORM_CERT_SERIAL_NO = 'platform-serial-123';
    process.env.WECHAT_PLATFORM_PUBLIC_KEY_PEM = publicKey
      .export({
        format: 'pem',
        type: 'spki',
      })
      .toString();

    const serviceMock = {
      buildPaidTransitionFromOutTradeNo: jest.fn().mockResolvedValue({
        amount: 19900,
        orderId: 'order_123',
        orderStatus: ORDER_STATUS.PAID_PENDING_FULFILLMENT,
        paidAt: '2026-04-17T09:30:00.000Z',
        providerTxnId: 'wx_txn_456',
      }),
    } as never;
    const controller = new PaymentsController(serviceMock);
    const body = {
      event_type: 'TRANSACTION.SUCCESS',
      resource: encryptWechatCallbackResource(
        {
          appid: 'wx-app-id',
          amount: {
            total: 19900,
          },
          mchid: 'mch-123',
          out_trade_no: 'ORD-001',
          trade_state: 'SUCCESS',
          transaction_id: 'wx_txn_456',
        },
        process.env.WECHAT_API_V3_KEY as string,
      ),
    };
    const rawBody = Buffer.from(JSON.stringify(body), 'utf8');

    const result = await Promise.resolve().then(() =>
      controller.handleWechatCallback({
        headers: buildWechatCallbackHeaders(
          privateKey
            .export({
              format: 'pem',
              type: 'pkcs8',
            })
            .toString(),
          rawBody,
        ),
        rawBody,
      } as never, body as never),
    );

    expect((serviceMock as any).buildPaidTransitionFromOutTradeNo).toHaveBeenCalledWith({
      amount: 19900,
      outTradeNo: 'ORD-001',
      providerTxnId: 'wx_txn_456',
    });
    expect(result).toEqual({
      code: 'SUCCESS',
      message: 'OK',
    });
  });

  it('rejects a WeChat callback whose signature cannot be verified', async () => {
    process.env.WECHAT_API_V3_KEY = '12345678901234567890123456789012';
    process.env.WECHAT_APP_ID = 'wx-app-id';
    process.env.WECHAT_MCH_ID = 'mch-123';
    const { privateKey, publicKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
    });
    process.env.WECHAT_PLATFORM_CERT_SERIAL_NO = 'platform-serial-123';
    process.env.WECHAT_PLATFORM_PUBLIC_KEY_PEM = publicKey
      .export({
        format: 'pem',
        type: 'spki',
      })
      .toString();

    const serviceMock = {
      buildPaidTransitionFromOutTradeNo: jest.fn(),
    } as never;
    const controller = new PaymentsController(serviceMock);
    const body = {
      event_type: 'TRANSACTION.SUCCESS',
      resource: encryptWechatCallbackResource(
        {
          appid: 'wx-app-id',
          amount: {
            total: 19900,
          },
          mchid: 'mch-123',
          out_trade_no: 'ORD-001',
          trade_state: 'SUCCESS',
          transaction_id: 'wx_txn_456',
        },
        process.env.WECHAT_API_V3_KEY as string,
      ),
    };
    const rawBody = Buffer.from(JSON.stringify(body), 'utf8');

    await expect(
      Promise.resolve().then(() =>
        controller.handleWechatCallback({
          headers: buildWechatCallbackHeaders(
            privateKey
              .export({
                format: 'pem',
                type: 'pkcs8',
              })
              .toString(),
            rawBody,
            {
              'wechatpay-signature': 'invalid-signature',
            },
          ),
          rawBody,
        } as never, body as never),
      ),
    ).rejects.toThrow(BadRequestException);
    expect((serviceMock as any).buildPaidTransitionFromOutTradeNo).not.toHaveBeenCalled();
  });

  it('rejects a WeChat callback whose decrypted app id or merchant id does not match this app', async () => {
    process.env.WECHAT_API_V3_KEY = '12345678901234567890123456789012';
    process.env.WECHAT_APP_ID = 'wx-app-id';
    process.env.WECHAT_MCH_ID = 'mch-123';
    const { privateKey, publicKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
    });
    process.env.WECHAT_PLATFORM_CERT_SERIAL_NO = 'platform-serial-123';
    process.env.WECHAT_PLATFORM_PUBLIC_KEY_PEM = publicKey
      .export({
        format: 'pem',
        type: 'spki',
      })
      .toString();

    const serviceMock = {
      buildPaidTransitionFromOutTradeNo: jest.fn(),
    } as never;
    const controller = new PaymentsController(serviceMock);
    const body = {
      event_type: 'TRANSACTION.SUCCESS',
      resource: encryptWechatCallbackResource(
        {
          appid: 'wx-other-app',
          amount: {
            total: 19900,
          },
          mchid: 'mch-other',
          out_trade_no: 'ORD-001',
          trade_state: 'SUCCESS',
          transaction_id: 'wx_txn_456',
        },
        process.env.WECHAT_API_V3_KEY as string,
      ),
    };
    const rawBody = Buffer.from(JSON.stringify(body), 'utf8');

    await expect(
      Promise.resolve().then(() =>
        controller.handleWechatCallback(
          {
            headers: buildWechatCallbackHeaders(
              privateKey
                .export({
                  format: 'pem',
                  type: 'pkcs8',
                })
                .toString(),
              rawBody,
            ),
            rawBody,
          } as never,
          body as never,
        ),
      ),
    ).rejects.toThrow(BadRequestException);
    expect((serviceMock as any).buildPaidTransitionFromOutTradeNo).not.toHaveBeenCalled();
  });

  it('rejects malformed encrypted callback resources with a bad-request error instead of a raw runtime failure', async () => {
    process.env.WECHAT_API_V3_KEY = '12345678901234567890123456789012';
    process.env.WECHAT_APP_ID = 'wx-app-id';
    process.env.WECHAT_MCH_ID = 'mch-123';
    const { privateKey, publicKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
    });
    process.env.WECHAT_PLATFORM_CERT_SERIAL_NO = 'platform-serial-123';
    process.env.WECHAT_PLATFORM_PUBLIC_KEY_PEM = publicKey
      .export({
        format: 'pem',
        type: 'spki',
      })
      .toString();

    const serviceMock = {
      buildPaidTransitionFromOutTradeNo: jest.fn(),
    } as never;
    const controller = new PaymentsController(serviceMock);
    const body = {
      event_type: 'TRANSACTION.SUCCESS',
      resource: {
        associated_data: 'transaction',
        ciphertext: Buffer.alloc(17, 1).toString('base64'),
        nonce: 'nonce-123456',
      },
    };
    const rawBody = Buffer.from(JSON.stringify(body), 'utf8');

    await expect(
      Promise.resolve().then(() =>
        controller.handleWechatCallback(
          {
            headers: buildWechatCallbackHeaders(
              privateKey
                .export({
                  format: 'pem',
                  type: 'pkcs8',
                })
                .toString(),
              rawBody,
            ),
            rawBody,
          } as never,
          body as never,
        ),
      ),
    ).rejects.toThrow(BadRequestException);
    expect((serviceMock as any).buildPaidTransitionFromOutTradeNo).not.toHaveBeenCalled();
  });

  it('resolves a WeChat callback order number before applying the paid transition', async () => {
    const prismaMock = {
      order: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'order_123',
        }),
      },
    } as never;
    const service = new (PaymentsService as any)(prismaMock);
    const buildPaidTransitionSpy = jest
      .spyOn(service, 'buildPaidTransition')
      .mockResolvedValue({
        amount: 19900,
        orderId: 'order_123',
        orderStatus: ORDER_STATUS.PAID_PENDING_FULFILLMENT,
        paidAt: '2026-04-17T09:30:00.000Z',
        providerTxnId: 'wx_txn_456',
      });

    const result = await Promise.resolve().then(() =>
      service.buildPaidTransitionFromOutTradeNo({
        amount: 19900,
        outTradeNo: 'ORD-001',
        providerTxnId: 'wx_txn_456',
      }),
    );

    expect((prismaMock as any).order.findUnique).toHaveBeenCalledWith({
      select: {
        id: true,
      },
      where: {
        orderNumber: 'ORD-001',
      },
    });
    expect(buildPaidTransitionSpy).toHaveBeenCalledWith({
      amount: 19900,
      orderId: 'order_123',
      providerTxnId: 'wx_txn_456',
    });
    expect(result).toEqual({
      amount: 19900,
      orderId: 'order_123',
      orderStatus: ORDER_STATUS.PAID_PENDING_FULFILLMENT,
      paidAt: '2026-04-17T09:30:00.000Z',
      providerTxnId: 'wx_txn_456',
    });
  });

  const rootPrismaMock = {
    order: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
    payment: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
  };

  const txPrismaMock = {
    order: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
    payment: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
  };

  const prismaMock = {
    $transaction: jest.fn(),
    order: rootPrismaMock.order,
    payment: rootPrismaMock.payment,
  } as unknown as PrismaService;

  beforeEach(() => {
    jest.clearAllMocks();
    rootPrismaMock.order.findUnique.mockReset();
    rootPrismaMock.order.updateMany.mockReset();
    rootPrismaMock.payment.findFirst.mockReset();
    rootPrismaMock.payment.findUnique.mockReset();
    rootPrismaMock.payment.upsert.mockReset();
    txPrismaMock.order.findUnique.mockReset();
    txPrismaMock.order.updateMany.mockReset();
    txPrismaMock.payment.findFirst.mockReset();
    txPrismaMock.payment.findUnique.mockReset();
    txPrismaMock.payment.upsert.mockReset();
    (prismaMock.$transaction as jest.Mock).mockReset();
    (prismaMock.$transaction as jest.Mock).mockImplementation(
      async (callback: (tx: typeof txPrismaMock) => Promise<unknown>) =>
        callback(txPrismaMock),
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('persists a succeeded WeChat payment and advances a pending order inside a transaction', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-17T09:30:00.000Z'));

    txPrismaMock.payment.findUnique.mockResolvedValue(null);
    txPrismaMock.order.findUnique.mockResolvedValue({
      id: 'order_123',
      status: ORDER_STATUS.PENDING_PAYMENT,
      totalAmount: 19900,
    });
    txPrismaMock.payment.findFirst.mockResolvedValue(null);
    txPrismaMock.payment.upsert.mockResolvedValue({
      paidAt: new Date('2026-04-17T09:30:00.000Z'),
    });
    txPrismaMock.order.updateMany.mockResolvedValue({ count: 1 });

    const moduleRef = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: prismaMock },
        {
          provide: (require('../fulfillment/fulfillment-events.service') as typeof import('../fulfillment/fulfillment-events.service')).FulfillmentEventsService,
          useValue: { submitPaidOrder: jest.fn() },
        },
      ],
    }).compile();

    const service = moduleRef.get(PaymentsService);
    const fulfillmentEventsService = moduleRef.get(
      (require('../fulfillment/fulfillment-events.service') as typeof import('../fulfillment/fulfillment-events.service')).FulfillmentEventsService,
    ) as { submitPaidOrder: jest.Mock };

    const result = await service.buildPaidTransition({
      orderId: 'order_123',
      providerTxnId: 'wx_txn_456',
      amount: 19900,
    });

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(rootPrismaMock.payment.findUnique).not.toHaveBeenCalled();
    expect(rootPrismaMock.payment.findFirst).not.toHaveBeenCalled();
    expect(rootPrismaMock.order.findUnique).not.toHaveBeenCalled();
    expect(rootPrismaMock.payment.upsert).not.toHaveBeenCalled();
    expect(rootPrismaMock.order.updateMany).not.toHaveBeenCalled();
    expect(txPrismaMock.payment.findUnique).toHaveBeenCalledWith({
      where: {
        providerTxnId: 'wx_txn_456',
      },
      select: {
        amount: true,
        orderId: true,
        paidAt: true,
        status: true,
      },
    });
    expect(txPrismaMock.order.findUnique).toHaveBeenCalledWith({
      where: {
        id: 'order_123',
      },
      select: {
        id: true,
        status: true,
        totalAmount: true,
      },
    });
    expect(txPrismaMock.payment.findFirst).toHaveBeenCalledWith({
      where: {
        orderId: 'order_123',
        status: 'SUCCEEDED',
      },
      select: {
        providerTxnId: true,
      },
    });
    expect(txPrismaMock.payment.upsert).toHaveBeenCalledWith({
      where: {
        providerTxnId: 'wx_txn_456',
      },
      create: {
        amount: 19900,
        method: 'WECHAT_PAY',
        orderId: 'order_123',
        paidAt: expect.any(Date),
        providerTxnId: 'wx_txn_456',
        status: 'SUCCEEDED',
      },
      update: {
        amount: 19900,
        method: 'WECHAT_PAY',
        paidAt: expect.any(Date),
        status: 'SUCCEEDED',
      },
    });
    expect(txPrismaMock.order.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'order_123',
        status: ORDER_STATUS.PENDING_PAYMENT,
      },
      data: {
        status: ORDER_STATUS.PAID_PENDING_FULFILLMENT,
      },
    });
    expect(result).toEqual({
      amount: 19900,
      orderId: 'order_123',
      orderStatus: ORDER_STATUS.PAID_PENDING_FULFILLMENT,
      paidAt: '2026-04-17T09:30:00.000Z',
      providerTxnId: 'wx_txn_456',
    });
    expect(fulfillmentEventsService.submitPaidOrder).toHaveBeenCalledWith(
      'order_123',
    );
  });

  it('preserves an already-advanced order on a replayed callback for the same payment', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-17T09:30:00.000Z'));

    const existingPaidAt = new Date('2026-04-17T09:30:00.000Z');

    txPrismaMock.payment.findUnique.mockResolvedValue({
      amount: 19900,
      orderId: 'order_123',
      paidAt: existingPaidAt,
      status: 'SUCCEEDED',
    });
    txPrismaMock.order.findUnique.mockResolvedValue({
      id: 'order_123',
      status: ORDER_STATUS.SUBMITTED_TO_VENDOR,
      totalAmount: 19900,
    });
    txPrismaMock.payment.findFirst.mockResolvedValue({
      providerTxnId: 'wx_txn_456',
    });
    txPrismaMock.payment.upsert.mockResolvedValue({
      paidAt: existingPaidAt,
    });

    const moduleRef = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    const service = moduleRef.get(PaymentsService);

    const result = await service.buildPaidTransition({
      orderId: 'order_123',
      providerTxnId: 'wx_txn_456',
      amount: 19900,
    });

    expect(txPrismaMock.payment.upsert).toHaveBeenCalledWith({
      where: {
        providerTxnId: 'wx_txn_456',
      },
      create: {
        amount: 19900,
        method: 'WECHAT_PAY',
        orderId: 'order_123',
        paidAt: expect.any(Date),
        providerTxnId: 'wx_txn_456',
        status: 'SUCCEEDED',
      },
      update: {
        amount: 19900,
        method: 'WECHAT_PAY',
        paidAt: existingPaidAt,
        status: 'SUCCEEDED',
      },
    });
    expect(txPrismaMock.order.updateMany).not.toHaveBeenCalled();
    expect(result).toEqual({
      amount: 19900,
      orderId: 'order_123',
      orderStatus: ORDER_STATUS.SUBMITTED_TO_VENDOR,
      paidAt: '2026-04-17T09:30:00.000Z',
      providerTxnId: 'wx_txn_456',
    });
  });

  it('retries upstream fulfillment submission for a replayed callback when the order is still paid pending fulfillment', async () => {
    const existingPaidAt = new Date('2026-04-17T09:30:00.000Z');
    const fulfillmentEventsService = {
      submitPaidOrder: jest.fn().mockResolvedValue({
        externalRef: 'vendor_submit_1',
        nextStatus: ORDER_STATUS.SUBMITTED_TO_VENDOR,
        orderId: 'order_123',
      }),
    };

    txPrismaMock.payment.findUnique.mockResolvedValue({
      amount: 19900,
      orderId: 'order_123',
      paidAt: existingPaidAt,
      status: 'SUCCEEDED',
    });
    txPrismaMock.order.findUnique.mockResolvedValue({
      id: 'order_123',
      status: ORDER_STATUS.PAID_PENDING_FULFILLMENT,
      totalAmount: 19900,
    });
    txPrismaMock.payment.findFirst.mockResolvedValue({
      providerTxnId: 'wx_txn_456',
    });
    txPrismaMock.payment.upsert.mockResolvedValue({
      paidAt: existingPaidAt,
    });

    const service = new PaymentsService(
      prismaMock,
      undefined,
      fulfillmentEventsService as never,
    );

    const result = await service.buildPaidTransition({
      amount: 19900,
      orderId: 'order_123',
      providerTxnId: 'wx_txn_456',
    });

    expect(fulfillmentEventsService.submitPaidOrder).toHaveBeenCalledWith(
      'order_123',
    );
    expect(result).toEqual({
      amount: 19900,
      orderId: 'order_123',
      orderStatus: ORDER_STATUS.PAID_PENDING_FULFILLMENT,
      paidAt: '2026-04-17T09:30:00.000Z',
      providerTxnId: 'wx_txn_456',
    });
  });

  it('preserves a later payment status on replay instead of regressing it to succeeded', async () => {
    txPrismaMock.payment.findUnique.mockResolvedValue({
      amount: 19900,
      orderId: 'order_123',
      paidAt: new Date('2026-04-17T09:30:00.000Z'),
      status: 'REFUNDED',
    });
    txPrismaMock.order.findUnique.mockResolvedValue({
      id: 'order_123',
      status: ORDER_STATUS.PAID_PENDING_FULFILLMENT,
      totalAmount: 19900,
    });
    txPrismaMock.payment.findFirst.mockResolvedValue({
      providerTxnId: 'wx_txn_456',
    });

    const moduleRef = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    const service = moduleRef.get(PaymentsService);

    await service.buildPaidTransition({
      orderId: 'order_123',
      providerTxnId: 'wx_txn_456',
      amount: 19900,
    });

    expect(txPrismaMock.payment.upsert).toHaveBeenCalledWith({
      where: {
        providerTxnId: 'wx_txn_456',
      },
      create: {
        amount: 19900,
        method: 'WECHAT_PAY',
        orderId: 'order_123',
        paidAt: expect.any(Date),
        providerTxnId: 'wx_txn_456',
        status: 'SUCCEEDED',
      },
      update: {
        amount: 19900,
        method: 'WECHAT_PAY',
        paidAt: expect.any(Date),
        status: 'REFUNDED',
      },
    });
    expect(txPrismaMock.order.updateMany).not.toHaveBeenCalled();
  });

  it('returns the re-read advanced order status when the conditional update loses the race', async () => {
    txPrismaMock.payment.findUnique.mockResolvedValue({
      amount: 19900,
      orderId: 'order_123',
      paidAt: new Date('2026-04-17T09:30:00.000Z'),
      status: 'SUCCEEDED',
    });
    txPrismaMock.order.findUnique
      .mockResolvedValueOnce({
        id: 'order_123',
        status: ORDER_STATUS.PENDING_PAYMENT,
        totalAmount: 19900,
      })
      .mockResolvedValueOnce({
        id: 'order_123',
        status: ORDER_STATUS.SUBMITTED_TO_VENDOR,
        totalAmount: 19900,
      });
    txPrismaMock.payment.findFirst.mockResolvedValue({
      providerTxnId: 'wx_txn_456',
    });
    txPrismaMock.order.updateMany.mockResolvedValue({ count: 0 });

    const moduleRef = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    const service = moduleRef.get(PaymentsService);

    const result = await service.buildPaidTransition({
      orderId: 'order_123',
      providerTxnId: 'wx_txn_456',
      amount: 19900,
    });

    expect(txPrismaMock.order.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'order_123',
        status: ORDER_STATUS.PENDING_PAYMENT,
      },
      data: {
        status: ORDER_STATUS.PAID_PENDING_FULFILLMENT,
      },
    });
    expect(txPrismaMock.order.findUnique).toHaveBeenNthCalledWith(1, {
      where: {
        id: 'order_123',
      },
      select: {
        id: true,
        status: true,
        totalAmount: true,
      },
    });
    expect(txPrismaMock.order.findUnique).toHaveBeenNthCalledWith(2, {
      where: {
        id: 'order_123',
      },
      select: {
        status: true,
      },
    });
    expect(txPrismaMock.payment.findFirst).toHaveBeenCalledWith({
      where: {
        orderId: 'order_123',
        status: 'SUCCEEDED',
      },
      select: {
        providerTxnId: true,
      },
    });
    expect(result).toEqual({
      amount: 19900,
      orderId: 'order_123',
      orderStatus: ORDER_STATUS.SUBMITTED_TO_VENDOR,
      paidAt: '2026-04-17T09:30:00.000Z',
      providerTxnId: 'wx_txn_456',
    });
  });

  it('rejects a replay when providerTxnId is already bound to a different order or amount', async () => {
    txPrismaMock.payment.findUnique.mockResolvedValue({
      amount: 20000,
      orderId: 'order_other',
      paidAt: new Date('2026-04-17T09:30:00.000Z'),
      status: 'SUCCEEDED',
    });

    const moduleRef = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    const service = moduleRef.get(PaymentsService);

    await expect(
      service.buildPaidTransition({
        orderId: 'order_123',
        providerTxnId: 'wx_txn_456',
        amount: 19900,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(txPrismaMock.order.findUnique).not.toHaveBeenCalled();
    expect(txPrismaMock.payment.findFirst).not.toHaveBeenCalled();
    expect(txPrismaMock.payment.upsert).not.toHaveBeenCalled();
    expect(txPrismaMock.order.updateMany).not.toHaveBeenCalled();
  });

  it('rejects a callback whose amount does not match the stored order total', async () => {
    txPrismaMock.payment.findUnique.mockResolvedValue(null);
    txPrismaMock.order.findUnique.mockResolvedValue({
      id: 'order_123',
      status: ORDER_STATUS.PENDING_PAYMENT,
      totalAmount: 19900,
    });

    const moduleRef = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    const service = moduleRef.get(PaymentsService);

    await expect(
      service.buildPaidTransition({
        orderId: 'order_123',
        providerTxnId: 'wx_txn_456',
        amount: 18800,
      }),
    ).rejects.toThrow('Callback amount does not match order total.');
    expect(txPrismaMock.payment.findFirst).not.toHaveBeenCalled();
    expect(txPrismaMock.payment.upsert).not.toHaveBeenCalled();
    expect(txPrismaMock.order.updateMany).not.toHaveBeenCalled();
  });

  it('rejects a second successful payment for the same order under a different txn id', async () => {
    txPrismaMock.payment.findUnique.mockResolvedValue(null);
    txPrismaMock.order.findUnique.mockResolvedValue({
      id: 'order_123',
      status: ORDER_STATUS.PENDING_PAYMENT,
      totalAmount: 19900,
    });
    txPrismaMock.payment.findFirst.mockResolvedValue({
      providerTxnId: 'wx_txn_existing',
    });
    txPrismaMock.order.updateMany.mockResolvedValue({ count: 0 });
    txPrismaMock.order.findUnique
      .mockResolvedValueOnce({
        id: 'order_123',
        status: ORDER_STATUS.PENDING_PAYMENT,
        totalAmount: 19900,
      })
      .mockResolvedValueOnce({
        status: ORDER_STATUS.PAID_PENDING_FULFILLMENT,
      });

    const moduleRef = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    const service = moduleRef.get(PaymentsService);

    await expect(
      service.buildPaidTransition({
        orderId: 'order_123',
        providerTxnId: 'wx_txn_456',
        amount: 19900,
      }),
    ).rejects.toThrow(
      'Order already has a successful payment with a different transaction id.',
    );
    expect(txPrismaMock.payment.findFirst).toHaveBeenCalledWith({
      where: {
        orderId: 'order_123',
        status: 'SUCCEEDED',
      },
      select: {
        providerTxnId: true,
      },
    });
    expect(txPrismaMock.payment.upsert).not.toHaveBeenCalled();
    expect(txPrismaMock.order.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'order_123',
        status: ORDER_STATUS.PENDING_PAYMENT,
      },
      data: {
        status: ORDER_STATUS.PAID_PENDING_FULFILLMENT,
      },
    });
  });

  it('rejects when the guarded transition loses the race and a different txn already owns the successful payment', async () => {
    txPrismaMock.payment.findUnique.mockResolvedValue(null);
    txPrismaMock.order.findUnique
      .mockResolvedValueOnce({
        id: 'order_123',
        status: ORDER_STATUS.PENDING_PAYMENT,
        totalAmount: 19900,
      })
      .mockResolvedValueOnce({
        status: ORDER_STATUS.PAID_PENDING_FULFILLMENT,
      });
    txPrismaMock.order.updateMany.mockResolvedValue({ count: 0 });
    txPrismaMock.payment.findFirst.mockResolvedValue({
      providerTxnId: 'wx_txn_existing',
    });

    const moduleRef = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    const service = moduleRef.get(PaymentsService);

    await expect(
      service.buildPaidTransition({
        orderId: 'order_123',
        providerTxnId: 'wx_txn_456',
        amount: 19900,
      }),
    ).rejects.toThrow(
      'Order already has a successful payment with a different transaction id.',
    );
    expect(txPrismaMock.order.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'order_123',
        status: ORDER_STATUS.PENDING_PAYMENT,
      },
      data: {
        status: ORDER_STATUS.PAID_PENDING_FULFILLMENT,
      },
    });
    expect(txPrismaMock.payment.findFirst).toHaveBeenCalledWith({
      where: {
        orderId: 'order_123',
        status: 'SUCCEEDED',
      },
      select: {
        providerTxnId: true,
      },
    });
    expect(txPrismaMock.payment.upsert).not.toHaveBeenCalled();
  });

  it('treats a lost guarded transition as idempotent when the same txn already owns the successful payment', async () => {
    const existingPaidAt = new Date('2026-04-17T09:30:00.000Z');

    txPrismaMock.payment.findUnique.mockResolvedValue({
      amount: 19900,
      orderId: 'order_123',
      paidAt: existingPaidAt,
      status: 'SUCCEEDED',
    });
    txPrismaMock.order.findUnique
      .mockResolvedValueOnce({
        id: 'order_123',
        status: ORDER_STATUS.PENDING_PAYMENT,
        totalAmount: 19900,
      })
      .mockResolvedValueOnce({
        status: ORDER_STATUS.PAID_PENDING_FULFILLMENT,
      });
    txPrismaMock.order.updateMany.mockResolvedValue({ count: 0 });
    txPrismaMock.payment.findFirst.mockResolvedValue({
      providerTxnId: 'wx_txn_456',
    });
    txPrismaMock.payment.upsert.mockResolvedValue({
      paidAt: existingPaidAt,
    });

    const moduleRef = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    const service = moduleRef.get(PaymentsService);

    const result = await service.buildPaidTransition({
      orderId: 'order_123',
      providerTxnId: 'wx_txn_456',
      amount: 19900,
    });

    expect(txPrismaMock.order.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'order_123',
        status: ORDER_STATUS.PENDING_PAYMENT,
      },
      data: {
        status: ORDER_STATUS.PAID_PENDING_FULFILLMENT,
      },
    });
    expect(txPrismaMock.payment.findFirst).toHaveBeenCalledWith({
      where: {
        orderId: 'order_123',
        status: 'SUCCEEDED',
      },
      select: {
        providerTxnId: true,
      },
    });
    expect(txPrismaMock.payment.upsert).toHaveBeenCalledWith({
      where: {
        providerTxnId: 'wx_txn_456',
      },
      create: {
        amount: 19900,
        method: 'WECHAT_PAY',
        orderId: 'order_123',
        paidAt: expect.any(Date),
        providerTxnId: 'wx_txn_456',
        status: 'SUCCEEDED',
      },
      update: {
        amount: 19900,
        method: 'WECHAT_PAY',
        paidAt: existingPaidAt,
        status: 'SUCCEEDED',
      },
    });
    expect(result).toEqual({
      amount: 19900,
      orderId: 'order_123',
      orderStatus: ORDER_STATUS.PAID_PENDING_FULFILLMENT,
      paidAt: '2026-04-17T09:30:00.000Z',
      providerTxnId: 'wx_txn_456',
    });
  });

  it('rejects malformed callback payloads at the controller boundary', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    const controller = new PaymentsController(moduleRef.get(PaymentsService));

    await expect(
      Promise.resolve().then(() =>
        controller.handleWechatCallback(
          {
            headers: {},
            rawBody: Buffer.from('{}', 'utf8'),
          } as never,
          {
            orderId: '',
            providerTxnId: 'wx_txn_456',
            amount: Number.NaN,
          } as never,
        ),
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
