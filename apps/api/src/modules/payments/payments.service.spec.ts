import { BadRequestException } from '@nestjs/common';

import { ORDER_STATUS } from '../orders/order-status';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

describe('PaymentsService', () => {
  const prismaMock: any = {
    order: {
      findFirst: jest.fn(),
    },
    payment: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const fulfillmentEventsServiceMock: any = {
    submitPaidOrder: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.order.findFirst.mockReset();
    prismaMock.payment.create.mockReset();
    prismaMock.payment.findUnique.mockReset();
    prismaMock.payment.update.mockReset();
    prismaMock.$transaction.mockReset();
    fulfillmentEventsServiceMock.submitPaidOrder.mockReset();
  });

  it('creates a generic payment intent for a pending order', async () => {
    prismaMock.order.findFirst.mockResolvedValue({
      id: 'ord_1',
      totalAmount: 159800,
    });
    prismaMock.payment.create.mockResolvedValue({
      id: 'pay_1',
      orderId: 'ord_1',
    });

    const service = new PaymentsService(
      prismaMock,
      fulfillmentEventsServiceMock,
    );

    const result = await service.createPaymentIntent({
      customerId: 'cust_1',
      orderId: 'ord_1',
    });

    expect(prismaMock.order.findFirst).toHaveBeenCalledWith({
      select: {
        id: true,
        totalAmount: true,
      },
      where: {
        id: 'ord_1',
        status: ORDER_STATUS.PENDING_PAYMENT,
        userId: 'cust_1',
      },
    });
    expect(prismaMock.payment.create).toHaveBeenCalledWith({
      data: {
        amount: 159800,
        method: 'EXTERNAL_PROVIDER',
        orderId: 'ord_1',
        status: 'PENDING',
      },
      select: {
        id: true,
        orderId: true,
      },
    });
    expect(result).toMatchObject({
      paymentId: 'pay_1',
      orderId: 'ord_1',
      method: 'EXTERNAL_PROVIDER',
      status: 'PENDING',
    });
    expect(result.intentToken).toBeTruthy();
    expect(result.expiresAt).toBeTruthy();
  });

  it('rejects payment intent creation when the order is missing', async () => {
    prismaMock.order.findFirst.mockResolvedValue(null);

    const service = new PaymentsService(
      prismaMock,
      fulfillmentEventsServiceMock,
    );

    await expect(
      service.createPaymentIntent({
        customerId: 'cust_1',
        orderId: 'missing_order',
      }),
    ).rejects.toThrow(new BadRequestException('Pending order not found.'));
    expect(prismaMock.payment.create).not.toHaveBeenCalled();
  });

  it('confirms a payment intent and advances the order state', async () => {
    const txMock: any = {
      order: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      payment: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'pay_1',
          paidAt: null,
          order: {
            id: 'ord_1',
            status: ORDER_STATUS.PENDING_PAYMENT,
            totalAmount: 159800,
          },
        }),
        update: jest.fn().mockResolvedValue(undefined),
      },
    };
    prismaMock.$transaction.mockImplementation(
      async (callback: (tx: typeof txMock) => Promise<unknown>) => callback(txMock),
    );

    const service = new PaymentsService(
      prismaMock,
      fulfillmentEventsServiceMock,
    );

    const result = await service.confirmPaymentIntent({
      amount: 159800,
      paymentId: 'pay_1',
    });

    expect(txMock.payment.findUnique).toHaveBeenCalledWith({
      where: {
        id: 'pay_1',
      },
      include: {
        order: {
          select: {
            id: true,
            status: true,
            totalAmount: true,
          },
        },
      },
    });
    expect(txMock.payment.update).toHaveBeenCalledWith({
      where: {
        id: 'pay_1',
      },
      data: {
        method: 'EXTERNAL_PROVIDER',
        paidAt: expect.any(Date),
        status: 'SUCCEEDED',
      },
    });
    expect(txMock.order.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'ord_1',
        status: ORDER_STATUS.PENDING_PAYMENT,
      },
      data: {
        status: ORDER_STATUS.PAID_PENDING_FULFILLMENT,
      },
    });
    expect(fulfillmentEventsServiceMock.submitPaidOrder).toHaveBeenCalledWith(
      'ord_1',
    );
    expect(result).toMatchObject({
      paymentId: 'pay_1',
      orderId: 'ord_1',
      orderStatus: ORDER_STATUS.PAID_PENDING_FULFILLMENT,
    });
  });

  it('routes payment intent creation through the controller', async () => {
    const serviceMock: any = {
      createPaymentIntent: jest.fn().mockResolvedValue({
        paymentId: 'pay_1',
        orderId: 'ord_1',
        method: 'EXTERNAL_PROVIDER',
        status: 'PENDING',
        intentToken: 'intent_123',
        expiresAt: '2026-04-24T09:30:00.000Z',
      }),
      confirmPaymentIntent: jest.fn(),
    };
    const controller = new PaymentsController(serviceMock);

    const result = await controller.createIntent(
      {
        orderId: 'ord_1',
      },
      {
        id: 'cust_1',
        accountKey: 'account_1',
      },
    );

    expect(serviceMock.createPaymentIntent).toHaveBeenCalledWith({
      customerId: 'cust_1',
      orderId: 'ord_1',
    });
    expect(result).toEqual({
      paymentId: 'pay_1',
      orderId: 'ord_1',
      method: 'EXTERNAL_PROVIDER',
      status: 'PENDING',
      intentToken: 'intent_123',
      expiresAt: '2026-04-24T09:30:00.000Z',
    });
  });

  it('routes payment intent confirmation through the controller', async () => {
    const serviceMock: any = {
      createPaymentIntent: jest.fn(),
      confirmPaymentIntent: jest.fn().mockResolvedValue({
        paymentId: 'pay_1',
        orderId: 'ord_1',
        orderStatus: ORDER_STATUS.PAID_PENDING_FULFILLMENT,
        paidAt: '2026-04-24T09:30:00.000Z',
      }),
    };
    const controller = new PaymentsController(serviceMock);

    const result = await controller.confirmIntent('pay_1', {
      amount: 159800,
    });

    expect(serviceMock.confirmPaymentIntent).toHaveBeenCalledWith({
      amount: 159800,
      paymentId: 'pay_1',
    });
    expect(result).toEqual({
      paymentId: 'pay_1',
      orderId: 'ord_1',
      orderStatus: ORDER_STATUS.PAID_PENDING_FULFILLMENT,
      paidAt: '2026-04-24T09:30:00.000Z',
    });
  });
});
