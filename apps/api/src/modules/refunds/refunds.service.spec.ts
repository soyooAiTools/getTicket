import { BadRequestException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';

import { CustomerSessionGuard } from '../../common/auth/customer-session.guard';
import { PrismaService } from '../../common/prisma/prisma.service';
import { VendorCallbackSecretGuard } from '../../common/auth/vendor-callback-secret.guard';
import { UpstreamTicketingGateway } from '../../common/vendors/upstream-ticketing.gateway';
import { ORDER_STATUS } from '../orders/order-status';
import { RefundsController } from './refunds.controller';
import { RefundsService } from './refunds.service';

describe('RefundsService', () => {
  const txPrismaMock = {
    order: {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    payment: {
      updateMany: jest.fn(),
    },
    refundRequest: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  const prismaMock = {
    $transaction: jest.fn(),
    order: txPrismaMock.order,
    payment: txPrismaMock.payment,
    refundRequest: txPrismaMock.refundRequest,
  } as unknown as PrismaService;

  const upstreamGatewayMock = {
    submitRefund: jest.fn(),
  } as unknown as UpstreamTicketingGateway;

  beforeEach(() => {
    jest.clearAllMocks();
    txPrismaMock.order.findUnique.mockReset();
    txPrismaMock.order.update.mockReset();
    txPrismaMock.order.updateMany.mockReset();
    txPrismaMock.payment.updateMany.mockReset();
    txPrismaMock.refundRequest.create.mockReset();
    txPrismaMock.refundRequest.findFirst.mockReset();
    txPrismaMock.refundRequest.findMany.mockReset();
    txPrismaMock.refundRequest.findUnique.mockReset();
    txPrismaMock.refundRequest.updateMany.mockReset();
    (prismaMock.$transaction as jest.Mock).mockReset();
    (upstreamGatewayMock.submitRefund as jest.Mock).mockReset();
    (prismaMock.$transaction as jest.Mock).mockImplementation(
      async (callback: (tx: typeof txPrismaMock) => Promise<unknown>) =>
        callback(txPrismaMock),
    );
  });

  it('creates a persisted refund request, submits it upstream, and marks the order as refund processing', async () => {
    txPrismaMock.order.findUnique.mockResolvedValue({
      id: 'order_123',
      status: ORDER_STATUS.TICKET_ISSUED,
      totalAmount: 100000,
      userId: 'cust_123',
    });
    txPrismaMock.refundRequest.create.mockResolvedValue({
      refundNo: 'RFD-1713340800000-ab12cd34',
      serviceFee: 20000,
      refundAmount: 80000,
    });
    txPrismaMock.order.updateMany.mockResolvedValue({ count: 1 });
    txPrismaMock.refundRequest.updateMany.mockResolvedValue({ count: 1 });
    (upstreamGatewayMock.submitRefund as jest.Mock).mockResolvedValue({
      externalRef: 'vendor_refund_1',
    });

    const moduleRef = await Test.createTestingModule({
      providers: [
        RefundsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: UpstreamTicketingGateway, useValue: upstreamGatewayMock },
      ],
    }).compile();

    const service = moduleRef.get(RefundsService);

    const result = await service.requestRefund({
      customerId: 'cust_123',
      orderId: 'order_123',
      reasonCode: 'USER_IDENTITY_ERROR',
      daysBeforeStart: 2,
    });

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(txPrismaMock.order.findUnique).toHaveBeenCalledWith({
      select: {
        id: true,
        status: true,
        totalAmount: true,
        userId: true,
      },
      where: {
        id: 'order_123',
      },
    });
    expect(txPrismaMock.order.updateMany).toHaveBeenCalledWith({
      data: {
        status: ORDER_STATUS.REFUND_REVIEWING,
      },
      where: {
        id: 'order_123',
        status: {
          in: [
            ORDER_STATUS.PAID_PENDING_FULFILLMENT,
            ORDER_STATUS.SUBMITTED_TO_VENDOR,
            ORDER_STATUS.TICKET_ISSUED,
            ORDER_STATUS.TICKET_FAILED,
          ],
        },
      },
    });
    expect(txPrismaMock.refundRequest.create).toHaveBeenCalledWith({
      data: {
        orderId: 'order_123',
        reason: 'USER_IDENTITY_ERROR',
        refundAmount: 80000,
        refundNo: expect.stringMatching(/^RFD-\d+-[a-z0-9]+$/),
        requestedAmount: 100000,
        serviceFee: 20000,
        status: 'REVIEWING',
      },
      select: {
        refundAmount: true,
        refundNo: true,
        serviceFee: true,
      },
    });
    expect(upstreamGatewayMock.submitRefund).toHaveBeenCalledWith({
      amount: 80000,
      orderId: 'order_123',
      refundNo: expect.stringMatching(/^RFD-\d+-[a-z0-9]+$/),
    });
    expect(txPrismaMock.refundRequest.updateMany).toHaveBeenCalledWith({
      data: {
        status: 'PROCESSING',
      },
      where: {
        refundNo: expect.stringMatching(/^RFD-\d+-[a-z0-9]+$/),
        status: 'REVIEWING',
      },
    });
    expect(txPrismaMock.order.updateMany).toHaveBeenNthCalledWith(2, {
      data: {
        status: ORDER_STATUS.REFUND_PROCESSING,
      },
      where: {
        id: 'order_123',
        status: ORDER_STATUS.REFUND_REVIEWING,
      },
    });
    expect(result).toEqual({
      externalRef: 'vendor_refund_1',
      refundAmount: 80000,
      refundNo: expect.stringMatching(/^RFD-\d+-[a-z0-9]+$/),
      serviceFee: 20000,
    });
  });

  it('retries upstream submission for an existing reviewing refund request', async () => {
    txPrismaMock.order.findUnique.mockResolvedValue({
      id: 'order_123',
      status: ORDER_STATUS.REFUND_REVIEWING,
      totalAmount: 100000,
      userId: 'cust_123',
    });
    txPrismaMock.refundRequest.findFirst.mockResolvedValue({
      refundAmount: 80000,
      refundNo: 'RFD-1713340800000-ab12cd34',
      serviceFee: 20000,
    });
    txPrismaMock.order.updateMany.mockResolvedValue({ count: 1 });
    txPrismaMock.refundRequest.updateMany.mockResolvedValue({ count: 1 });
    (upstreamGatewayMock.submitRefund as jest.Mock).mockResolvedValue({
      externalRef: 'vendor_refund_retry_1',
    });

    const moduleRef = await Test.createTestingModule({
      providers: [
        RefundsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: UpstreamTicketingGateway, useValue: upstreamGatewayMock },
      ],
    }).compile();

    const service = moduleRef.get(RefundsService);

    const result = await service.requestRefund({
      customerId: 'cust_123',
      orderId: 'order_123',
      reasonCode: 'OTHER',
      daysBeforeStart: 5,
    });

    expect(txPrismaMock.refundRequest.create).not.toHaveBeenCalled();
    expect(txPrismaMock.refundRequest.findFirst).toHaveBeenCalledWith({
      orderBy: {
        requestedAt: 'desc',
      },
      select: {
        refundAmount: true,
        refundNo: true,
        serviceFee: true,
      },
      where: {
        orderId: 'order_123',
        status: 'REVIEWING',
      },
    });
    expect(upstreamGatewayMock.submitRefund).toHaveBeenCalledWith({
      amount: 80000,
      orderId: 'order_123',
      refundNo: 'RFD-1713340800000-ab12cd34',
    });
    expect(result).toEqual({
      externalRef: 'vendor_refund_retry_1',
      refundAmount: 80000,
      refundNo: 'RFD-1713340800000-ab12cd34',
      serviceFee: 20000,
    });
  });

  it('does not regress a refunded order back to refund processing after upstream submission succeeds', async () => {
    txPrismaMock.order.findUnique
      .mockResolvedValueOnce({
        id: 'order_123',
        status: ORDER_STATUS.TICKET_ISSUED,
        totalAmount: 100000,
        userId: 'cust_123',
      })
      .mockResolvedValueOnce({
        status: ORDER_STATUS.REFUNDED,
      });
    txPrismaMock.refundRequest.create.mockResolvedValue({
      refundNo: 'RFD-1713340800000-ab12cd34',
      serviceFee: 20000,
      refundAmount: 80000,
    });
    txPrismaMock.refundRequest.updateMany.mockResolvedValueOnce({ count: 0 });
    txPrismaMock.refundRequest.findUnique.mockResolvedValueOnce({
      orderId: 'order_123',
      refundAmount: 80000,
      refundNo: 'RFD-1713340800000-ab12cd34',
      status: 'COMPLETED',
    });
    txPrismaMock.order.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    (upstreamGatewayMock.submitRefund as jest.Mock).mockResolvedValue({
      externalRef: 'vendor_refund_1',
    });
    const moduleRef = await Test.createTestingModule({
      providers: [
        RefundsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: UpstreamTicketingGateway, useValue: upstreamGatewayMock },
      ],
    }).compile();

    const service = moduleRef.get(RefundsService);

    await expect(
      service.requestRefund({
        customerId: 'cust_123',
        orderId: 'order_123',
        reasonCode: 'USER_IDENTITY_ERROR',
        daysBeforeStart: 2,
      }),
    ).resolves.toEqual({
      externalRef: 'vendor_refund_1',
      refundAmount: 80000,
      refundNo: 'RFD-1713340800000-ab12cd34',
      serviceFee: 20000,
    });

    expect(txPrismaMock.order.updateMany).toHaveBeenNthCalledWith(2, {
      data: {
        status: ORDER_STATUS.REFUND_PROCESSING,
      },
      where: {
        id: 'order_123',
        status: ORDER_STATUS.REFUND_REVIEWING,
      },
    });
    expect(txPrismaMock.refundRequest.updateMany).toHaveBeenCalledWith({
      data: {
        status: 'PROCESSING',
      },
      where: {
        refundNo: 'RFD-1713340800000-ab12cd34',
        status: 'REVIEWING',
      },
    });
    expect(txPrismaMock.order.update).not.toHaveBeenCalled();
  });

  it('keeps a reviewing refund request retryable when upstream submission fails', async () => {
    txPrismaMock.order.findUnique.mockResolvedValue({
      id: 'order_123',
      status: ORDER_STATUS.TICKET_ISSUED,
      totalAmount: 100000,
      userId: 'cust_123',
    });
    txPrismaMock.refundRequest.create.mockResolvedValue({
      refundNo: 'RFD-1713340800000-ab12cd34',
      serviceFee: 20000,
      refundAmount: 80000,
    });
    txPrismaMock.order.updateMany.mockResolvedValue({ count: 1 });
    (upstreamGatewayMock.submitRefund as jest.Mock).mockRejectedValue(
      new BadRequestException('vendor unavailable'),
    );

    const moduleRef = await Test.createTestingModule({
      providers: [
        RefundsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: UpstreamTicketingGateway, useValue: upstreamGatewayMock },
      ],
    }).compile();

    const service = moduleRef.get(RefundsService);

    await expect(
      service.requestRefund({
        customerId: 'cust_123',
        orderId: 'order_123',
        reasonCode: 'USER_IDENTITY_ERROR',
        daysBeforeStart: 2,
      }),
    ).rejects.toThrow(new BadRequestException('vendor unavailable'));

    expect(prismaMock.order.update).not.toHaveBeenCalled();
  });

  it('rejects a refund request when the order does not exist', async () => {
    txPrismaMock.order.findUnique.mockResolvedValue(null);

    const moduleRef = await Test.createTestingModule({
      providers: [
        RefundsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: UpstreamTicketingGateway, useValue: upstreamGatewayMock },
      ],
    }).compile();

    const service = moduleRef.get(RefundsService);

    await expect(
      service.requestRefund({
        customerId: 'cust_123',
        orderId: 'missing_order',
        reasonCode: 'OTHER',
        daysBeforeStart: 5,
      }),
    ).rejects.toThrow(new BadRequestException('orderId does not exist.'));
    expect(txPrismaMock.order.updateMany).not.toHaveBeenCalled();
    expect(txPrismaMock.refundRequest.create).not.toHaveBeenCalled();
    expect(upstreamGatewayMock.submitRefund).not.toHaveBeenCalled();
  });

  it('rejects a refund request when the order status is not eligible for refunds', async () => {
    txPrismaMock.order.findUnique.mockResolvedValue({
      id: 'order_123',
      status: ORDER_STATUS.PENDING_PAYMENT,
      totalAmount: 100000,
      userId: 'cust_123',
    });

    const moduleRef = await Test.createTestingModule({
      providers: [
        RefundsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: UpstreamTicketingGateway, useValue: upstreamGatewayMock },
      ],
    }).compile();

    const service = moduleRef.get(RefundsService);

    await expect(
      service.requestRefund({
        customerId: 'cust_123',
        orderId: 'order_123',
        reasonCode: 'OTHER',
        daysBeforeStart: 5,
      }),
    ).rejects.toThrow(
      new BadRequestException('order is not eligible for refund request.'),
    );
    expect(txPrismaMock.order.updateMany).not.toHaveBeenCalled();
    expect(txPrismaMock.refundRequest.create).not.toHaveBeenCalled();
    expect(upstreamGatewayMock.submitRefund).not.toHaveBeenCalled();
  });

  it('rejects a refund request when the guarded order transition loses to an active refund in progress', async () => {
    txPrismaMock.order.findUnique
      .mockResolvedValueOnce({
        id: 'order_123',
        status: ORDER_STATUS.TICKET_ISSUED,
        totalAmount: 100000,
        userId: 'cust_123',
      })
      .mockResolvedValueOnce({
        id: 'order_123',
        status: ORDER_STATUS.REFUND_REVIEWING,
        totalAmount: 100000,
        userId: 'cust_123',
      });
    txPrismaMock.order.updateMany.mockResolvedValue({ count: 0 });

    const moduleRef = await Test.createTestingModule({
      providers: [
        RefundsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: UpstreamTicketingGateway, useValue: upstreamGatewayMock },
      ],
    }).compile();

    const service = moduleRef.get(RefundsService);

    await expect(
      service.requestRefund({
        customerId: 'cust_123',
        orderId: 'order_123',
        reasonCode: 'OTHER',
        daysBeforeStart: 5,
      }),
    ).rejects.toThrow(
      new BadRequestException('order already has an active refund request.'),
    );
    expect(txPrismaMock.order.updateMany).toHaveBeenCalledWith({
      data: {
        status: ORDER_STATUS.REFUND_REVIEWING,
      },
      where: {
        id: 'order_123',
        status: {
          in: [
            ORDER_STATUS.PAID_PENDING_FULFILLMENT,
            ORDER_STATUS.SUBMITTED_TO_VENDOR,
            ORDER_STATUS.TICKET_ISSUED,
            ORDER_STATUS.TICKET_FAILED,
          ],
        },
      },
    });
    expect(txPrismaMock.refundRequest.create).not.toHaveBeenCalled();
    expect(upstreamGatewayMock.submitRefund).not.toHaveBeenCalled();
  });

  it('rejects a refund request with an inconsistency error when the guarded transition loses but the order still looks refundable', async () => {
    txPrismaMock.order.findUnique
      .mockResolvedValueOnce({
        id: 'order_123',
        status: ORDER_STATUS.TICKET_ISSUED,
        totalAmount: 100000,
        userId: 'cust_123',
      })
      .mockResolvedValueOnce({
        id: 'order_123',
        status: ORDER_STATUS.TICKET_ISSUED,
        totalAmount: 100000,
        userId: 'cust_123',
      });
    txPrismaMock.order.updateMany.mockResolvedValue({ count: 0 });

    const moduleRef = await Test.createTestingModule({
      providers: [
        RefundsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: UpstreamTicketingGateway, useValue: upstreamGatewayMock },
      ],
    }).compile();

    const service = moduleRef.get(RefundsService);

    await expect(
      service.requestRefund({
        customerId: 'cust_123',
        orderId: 'order_123',
        reasonCode: 'OTHER',
        daysBeforeStart: 5,
      }),
    ).rejects.toThrow(
      new BadRequestException(
        'order refund request state changed unexpectedly.',
      ),
    );
    expect(txPrismaMock.refundRequest.create).not.toHaveBeenCalled();
    expect(upstreamGatewayMock.submitRefund).not.toHaveBeenCalled();
  });

  it('completes the refund request, updates the order, and returns the vendor callback payload', async () => {
    txPrismaMock.refundRequest.findUnique.mockResolvedValue({
      orderId: 'order_123',
      refundAmount: 80000,
      refundNo: 'RFD-1713340800000-ab12cd34',
      status: 'REVIEWING',
    });
    txPrismaMock.refundRequest.updateMany.mockResolvedValue({ count: 1 });
    txPrismaMock.payment.updateMany.mockResolvedValue({ count: 1 });
    txPrismaMock.order.update.mockResolvedValue({
      id: 'order_123',
      status: ORDER_STATUS.REFUNDED,
    });

    const moduleRef = await Test.createTestingModule({
      providers: [
        RefundsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: UpstreamTicketingGateway, useValue: upstreamGatewayMock },
      ],
    }).compile();

    const service = moduleRef.get(RefundsService);

    const result = await service.recordVendorRefund({
      amount: 78000,
      orderId: 'order_123',
      refundNo: 'RFD-1713340800000-ab12cd34',
    });

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(txPrismaMock.refundRequest.findUnique).toHaveBeenCalledWith({
      select: {
        orderId: true,
        refundAmount: true,
        refundNo: true,
        status: true,
      },
      where: {
        refundNo: 'RFD-1713340800000-ab12cd34',
      },
    });
    expect(txPrismaMock.refundRequest.updateMany).toHaveBeenCalledWith({
      data: {
        processedAt: expect.any(Date),
        refundAmount: 78000,
        status: 'COMPLETED',
      },
      where: {
        refundNo: 'RFD-1713340800000-ab12cd34',
        status: {
          in: ['REVIEWING', 'PROCESSING'],
        },
      },
    });
    expect(txPrismaMock.order.update).toHaveBeenCalledWith({
      data: {
        status: ORDER_STATUS.REFUNDED,
      },
      where: {
        id: 'order_123',
      },
    });
    expect(txPrismaMock.payment.updateMany).toHaveBeenCalledWith({
      data: {
        status: 'REFUNDED',
      },
      where: {
        orderId: 'order_123',
        status: 'SUCCEEDED',
      },
    });
    expect(result).toEqual({
      amount: 78000,
      nextStatus: ORDER_STATUS.REFUNDED,
      orderId: 'order_123',
      refundNo: 'RFD-1713340800000-ab12cd34',
      source: 'VENDOR_CALLBACK',
    });
  });

  it('treats a completed vendor callback replay with the same order and amount as idempotent without rewriting state', async () => {
    txPrismaMock.refundRequest.findUnique.mockResolvedValue({
      orderId: 'order_123',
      refundAmount: 78000,
      refundNo: 'RFD-1713340800000-ab12cd34',
      status: 'COMPLETED',
    });

    const moduleRef = await Test.createTestingModule({
      providers: [
        RefundsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: UpstreamTicketingGateway, useValue: upstreamGatewayMock },
      ],
    }).compile();

    const service = moduleRef.get(RefundsService);

    await expect(
      service.recordVendorRefund({
        amount: 78000,
        orderId: 'order_123',
        refundNo: 'RFD-1713340800000-ab12cd34',
      }),
    ).resolves.toEqual({
      amount: 78000,
      nextStatus: ORDER_STATUS.REFUNDED,
      orderId: 'order_123',
      refundNo: 'RFD-1713340800000-ab12cd34',
      source: 'VENDOR_CALLBACK',
    });
    expect(txPrismaMock.refundRequest.updateMany).not.toHaveBeenCalled();
    expect(txPrismaMock.order.update).not.toHaveBeenCalled();
    expect(txPrismaMock.payment.updateMany).not.toHaveBeenCalled();
  });

  it('rejects a conflicting vendor callback replay', async () => {
    txPrismaMock.refundRequest.findUnique.mockResolvedValue({
      orderId: 'order_123',
      refundAmount: 78000,
      refundNo: 'RFD-1713340800000-ab12cd34',
      status: 'COMPLETED',
    });

    const moduleRef = await Test.createTestingModule({
      providers: [
        RefundsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: UpstreamTicketingGateway, useValue: upstreamGatewayMock },
      ],
    }).compile();

    const service = moduleRef.get(RefundsService);

    await expect(
      service.recordVendorRefund({
        amount: 77000,
        orderId: 'wrong_order',
        refundNo: 'RFD-1713340800000-ab12cd34',
      }),
    ).rejects.toThrow(
      new BadRequestException(
        'refundNo is already associated with a different refund result.',
      ),
    );
    expect(txPrismaMock.refundRequest.updateMany).not.toHaveBeenCalled();
    expect(txPrismaMock.order.update).not.toHaveBeenCalled();
    expect(txPrismaMock.payment.updateMany).not.toHaveBeenCalled();
  });

  it('rejects a vendor callback when the refund number does not exist', async () => {
    txPrismaMock.refundRequest.findUnique.mockResolvedValue(null);

    const moduleRef = await Test.createTestingModule({
      providers: [
        RefundsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: UpstreamTicketingGateway, useValue: upstreamGatewayMock },
      ],
    }).compile();

    const service = moduleRef.get(RefundsService);

    await expect(
      service.recordVendorRefund({
        amount: 78000,
        orderId: 'order_123',
        refundNo: 'missing_refund',
      }),
    ).rejects.toThrow(new BadRequestException('refundNo does not exist.'));
    expect(txPrismaMock.refundRequest.updateMany).not.toHaveBeenCalled();
    expect(txPrismaMock.order.update).not.toHaveBeenCalled();
    expect(txPrismaMock.payment.updateMany).not.toHaveBeenCalled();
  });

  it('rejects a conflicting vendor callback after losing the completion race and re-reading the completed refund', async () => {
    txPrismaMock.refundRequest.findUnique
      .mockResolvedValueOnce({
        orderId: 'order_123',
        refundAmount: 80000,
        refundNo: 'RFD-1713340800000-ab12cd34',
        status: 'REVIEWING',
      })
      .mockResolvedValueOnce({
        orderId: 'order_123',
        refundAmount: 78000,
        refundNo: 'RFD-1713340800000-ab12cd34',
        status: 'COMPLETED',
      });
    txPrismaMock.refundRequest.updateMany.mockResolvedValue({ count: 0 });

    const moduleRef = await Test.createTestingModule({
      providers: [
        RefundsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: UpstreamTicketingGateway, useValue: upstreamGatewayMock },
      ],
    }).compile();

    const service = moduleRef.get(RefundsService);

    await expect(
      service.recordVendorRefund({
        amount: 77000,
        orderId: 'order_123',
        refundNo: 'RFD-1713340800000-ab12cd34',
      }),
    ).rejects.toThrow(
      new BadRequestException(
        'refundNo is already associated with a different refund result.',
      ),
    );
    expect(txPrismaMock.refundRequest.findUnique).toHaveBeenNthCalledWith(1, {
      select: {
        orderId: true,
        refundAmount: true,
        refundNo: true,
        status: true,
      },
      where: {
        refundNo: 'RFD-1713340800000-ab12cd34',
      },
    });
    expect(txPrismaMock.refundRequest.updateMany).toHaveBeenCalledWith({
      data: {
        processedAt: expect.any(Date),
        refundAmount: 77000,
        status: 'COMPLETED',
      },
      where: {
        refundNo: 'RFD-1713340800000-ab12cd34',
        status: {
          in: ['REVIEWING', 'PROCESSING'],
        },
      },
    });
    expect(txPrismaMock.refundRequest.findUnique).toHaveBeenNthCalledWith(2, {
      select: {
        orderId: true,
        refundAmount: true,
        refundNo: true,
        status: true,
      },
      where: {
        refundNo: 'RFD-1713340800000-ab12cd34',
      },
    });
    expect(txPrismaMock.order.update).not.toHaveBeenCalled();
    expect(txPrismaMock.payment.updateMany).not.toHaveBeenCalled();
  });

  it('lists admin refund requests with order and event context', async () => {
    txPrismaMock.refundRequest.findMany.mockResolvedValue([
      {
        id: 'refund_1',
        order: {
          id: 'ord_1',
          items: [
            {
              ticketTier: {
                session: {
                  event: {
                    city: 'Shanghai',
                    id: 'event_beta_1',
                    title: 'Beta Concert',
                    venueName: 'Expo Arena',
                  },
                  name: '2026-05-01 19:30',
                },
              },
            },
          ],
          orderNumber: 'ORD-001',
          status: ORDER_STATUS.REFUND_PROCESSING,
          userId: 'cust_1',
        },
        processedAt: new Date('2026-04-17T13:00:00.000Z'),
        reason: 'USER_IDENTITY_ERROR',
        refundAmount: 80000,
        refundNo: 'RFD-001',
        requestedAmount: 100000,
        requestedAt: new Date('2026-04-17T12:30:00.000Z'),
        serviceFee: 20000,
        status: 'PROCESSING',
      },
    ]);

    const moduleRef = await Test.createTestingModule({
      providers: [
        RefundsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: UpstreamTicketingGateway, useValue: upstreamGatewayMock },
      ],
    }).compile();

    const service = moduleRef.get(RefundsService);

    await expect(service.listAdminRequests()).resolves.toEqual([
      {
        event: {
          city: 'Shanghai',
          id: 'event_beta_1',
          title: 'Beta Concert',
          venueName: 'Expo Arena',
        },
        id: 'refund_1',
        orderId: 'ord_1',
        orderNumber: 'ORD-001',
        orderStatus: 'REFUND_PROCESSING',
        processedAt: '2026-04-17T13:00:00.000Z',
        reason: 'USER_IDENTITY_ERROR',
        refundAmount: 80000,
        refundNo: 'RFD-001',
        requestedAmount: 100000,
        requestedAt: '2026-04-17T12:30:00.000Z',
        serviceFee: 20000,
        sessionName: '2026-05-01 19:30',
        status: 'PROCESSING',
        userId: 'cust_1',
      },
    ]);

    expect(txPrismaMock.refundRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: {
          requestedAt: 'desc',
        },
      }),
    );
  });

  it('rejects refund requests for orders not owned by the authenticated customer', async () => {
    txPrismaMock.order.findUnique.mockResolvedValue({
      id: 'order_123',
      status: ORDER_STATUS.TICKET_ISSUED,
      totalAmount: 100000,
      userId: 'cust_other',
    });

    const moduleRef = await Test.createTestingModule({
      providers: [
        RefundsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: UpstreamTicketingGateway, useValue: upstreamGatewayMock },
      ],
    }).compile();

    const service = moduleRef.get(RefundsService);

    await expect(
      service.requestRefund({
        customerId: 'cust_123',
        orderId: 'order_123',
        reasonCode: 'OTHER',
        daysBeforeStart: 5,
      }),
    ).rejects.toThrow(
      new BadRequestException('orderId does not exist.'),
    );
    expect(txPrismaMock.order.updateMany).not.toHaveBeenCalled();
    expect(txPrismaMock.refundRequest.create).not.toHaveBeenCalled();
    expect(upstreamGatewayMock.submitRefund).not.toHaveBeenCalled();
  });

  it('rejects malformed refund request payloads at the controller boundary', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [RefundsController],
      providers: [
        RefundsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: UpstreamTicketingGateway, useValue: upstreamGatewayMock },
      ],
    }).compile();

    const controller = moduleRef.get(RefundsController);

    await expect(
      controller.requestRefund(
        {
          orderId: '',
          reasonCode: 'USER_IDENTITY_ERROR',
          daysBeforeStart: 2,
        },
        { id: 'cust_123', openId: 'openid_abc' },
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('passes the authenticated customer id into refund requests', async () => {
    const serviceMock = {
      requestRefund: jest.fn().mockResolvedValue({
        refundNo: 'RFD-001',
      }),
    } as never;
    const controller = new RefundsController(serviceMock);

    const result = await controller.requestRefund(
      {
        orderId: 'order_123',
        reasonCode: 'OTHER',
        daysBeforeStart: 5,
      },
      { id: 'cust_123', openId: 'openid_abc' },
    );

    expect(serviceMock.requestRefund).toHaveBeenCalledWith({
      customerId: 'cust_123',
      daysBeforeStart: 5,
      orderId: 'order_123',
      reasonCode: 'OTHER',
    });
    expect(result).toEqual({
      refundNo: 'RFD-001',
    });
  });

  it('routes a vendor refund callback through the refunds controller', async () => {
    const serviceMock = {
      recordVendorRefund: jest.fn().mockResolvedValue({
        amount: 78000,
        nextStatus: ORDER_STATUS.REFUNDED,
        orderId: 'order_123',
        refundNo: 'RFD-1713340800000-ab12cd34',
        source: 'VENDOR_CALLBACK',
      }),
    } as never;
    const controller = new RefundsController(serviceMock);

    const result = await controller.handleVendorCallback({
      amount: 78000,
      orderId: 'order_123',
      refundNo: 'RFD-1713340800000-ab12cd34',
    });

    expect(serviceMock.recordVendorRefund).toHaveBeenCalledWith({
      amount: 78000,
      orderId: 'order_123',
      refundNo: 'RFD-1713340800000-ab12cd34',
    });
    expect(result).toEqual({
      amount: 78000,
      nextStatus: ORDER_STATUS.REFUNDED,
      orderId: 'order_123',
      refundNo: 'RFD-1713340800000-ab12cd34',
      source: 'VENDOR_CALLBACK',
    });
  });

  it('protects refund request creation behind the customer session guard', () => {
    const guards =
      Reflect.getMetadata(
        GUARDS_METADATA,
        RefundsController.prototype.requestRefund,
      ) ?? [];

    expect(guards).toContain(CustomerSessionGuard);
  });

  it('protects vendor refund callbacks behind the vendor callback secret guard', () => {
    const guards =
      Reflect.getMetadata(
        GUARDS_METADATA,
        RefundsController.prototype.handleVendorCallback,
      ) ?? [];

    expect(guards).toContain(VendorCallbackSecretGuard);
  });
});
