import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { PrismaService } from '../../common/prisma/prisma.service';
import { OrdersController } from '../orders/orders.controller';
import { OrdersService } from '../orders/orders.service';
import {
  CheckoutService,
  DRAFT_ORDER_HOLD_WINDOW_MS,
} from './checkout.service';

describe('CheckoutService', () => {
  const ORDER_NUMBER_PATTERN = /^draft_\d+_[a-z0-9]+$/;

  const txPrismaMock = {
    order: {
      create: jest.fn(),
    },
    orderItem: {
      createMany: jest.fn(),
    },
    ticketTier: {
      findUnique: jest.fn(),
    },
    viewer: {
      findMany: jest.fn(),
    },
  };

  const prismaMock = {
    $transaction: jest.fn(),
    order: txPrismaMock.order,
    orderItem: txPrismaMock.orderItem,
    ticketTier: txPrismaMock.ticketTier,
    viewer: txPrismaMock.viewer,
  } as unknown as PrismaService;

  const ordersServiceMock = {
    getCustomerOrderDetail: jest.fn(),
    listCustomerOrders: jest.fn(),
  } as unknown as OrdersService;

  beforeEach(() => {
    jest.clearAllMocks();
    txPrismaMock.order.create.mockReset();
    txPrismaMock.orderItem.createMany.mockReset();
    txPrismaMock.ticketTier.findUnique.mockReset();
    txPrismaMock.viewer.findMany.mockReset();
    (prismaMock.$transaction as jest.Mock).mockReset();
    (prismaMock.$transaction as jest.Mock).mockImplementation(
      async (callback: (tx: typeof txPrismaMock) => Promise<unknown>) =>
        callback(txPrismaMock),
    );
  });

  it('creates a persisted draft order with one order item per viewer', async () => {
    const createdAt = new Date('2026-04-17T09:30:00.000Z');

    txPrismaMock.ticketTier.findUnique.mockResolvedValue({
      id: 'tier_vip',
      price: 880,
      ticketType: 'E_TICKET',
    });
    txPrismaMock.viewer.findMany.mockResolvedValue([
      { id: 'viewer_1' },
      { id: 'viewer_2' },
    ]);
    txPrismaMock.order.create.mockResolvedValue({
      createdAt,
      id: 'order_123',
    });
    txPrismaMock.orderItem.createMany.mockResolvedValue({ count: 2 });

    const moduleRef = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [
        CheckoutService,
        { provide: OrdersService, useValue: ordersServiceMock },
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    const service = moduleRef.get(CheckoutService);

    const result = await service.createDraftOrder({
      userId: 'user_123',
      tierId: 'tier_vip',
      viewerIds: ['viewer_1', 'viewer_2'],
      quantity: 2,
      ticketType: 'E_TICKET',
    });

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(txPrismaMock.ticketTier.findUnique).toHaveBeenCalledWith({
      select: {
        id: true,
        price: true,
        ticketType: true,
      },
      where: { id: 'tier_vip' },
    });
    expect(txPrismaMock.viewer.findMany).toHaveBeenCalledWith({
      select: { id: true },
      where: {
        id: { in: ['viewer_1', 'viewer_2'] },
        userId: 'user_123',
      },
    });
    expect(txPrismaMock.order.create).toHaveBeenCalledWith({
      data: {
        orderNumber: expect.stringMatching(ORDER_NUMBER_PATTERN),
        status: 'PENDING_PAYMENT',
        ticketType: 'E_TICKET',
        totalAmount: 1760,
        userId: 'user_123',
      },
      select: {
        createdAt: true,
        id: true,
      },
    });
    expect(txPrismaMock.orderItem.createMany).toHaveBeenCalledWith({
      data: [
        {
          orderId: 'order_123',
          quantity: 1,
          ticketTierId: 'tier_vip',
          totalAmount: 880,
          unitPrice: 880,
          viewerId: 'viewer_1',
        },
        {
          orderId: 'order_123',
          quantity: 1,
          ticketTierId: 'tier_vip',
          totalAmount: 880,
          unitPrice: 880,
          viewerId: 'viewer_2',
        },
      ],
    });
    expect(result).toEqual({
      createdAt: createdAt.toISOString(),
      id: 'order_123',
      inventoryLockExpiresAt: new Date(
        createdAt.getTime() + DRAFT_ORDER_HOLD_WINDOW_MS,
      ).toISOString(),
      quantity: 2,
      status: 'PENDING_PAYMENT',
      tierId: 'tier_vip',
      ticketType: 'E_TICKET',
      userId: 'user_123',
      viewerIds: ['viewer_1', 'viewer_2'],
    });
  });

  it('rejects a draft order when the tier does not exist', async () => {
    txPrismaMock.ticketTier.findUnique.mockResolvedValue(null);

    const moduleRef = await Test.createTestingModule({
      providers: [
        CheckoutService,
        { provide: OrdersService, useValue: ordersServiceMock },
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    const service = moduleRef.get(CheckoutService);

    await expect(
      service.createDraftOrder({
        userId: 'user_123',
        tierId: 'missing_tier',
        viewerIds: ['viewer_1'],
        quantity: 1,
        ticketType: 'E_TICKET',
      }),
    ).rejects.toThrow(new BadRequestException('tierId does not exist.'));
    expect(txPrismaMock.viewer.findMany).not.toHaveBeenCalled();
    expect(txPrismaMock.order.create).not.toHaveBeenCalled();
    expect(txPrismaMock.orderItem.createMany).not.toHaveBeenCalled();
  });

  it('rejects a draft order when the requested ticket type does not match the tier', async () => {
    txPrismaMock.ticketTier.findUnique.mockResolvedValue({
      id: 'tier_vip',
      price: 880,
      ticketType: 'PAPER_TICKET',
    });

    const moduleRef = await Test.createTestingModule({
      providers: [
        CheckoutService,
        { provide: OrdersService, useValue: ordersServiceMock },
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    const service = moduleRef.get(CheckoutService);

    await expect(
      service.createDraftOrder({
        userId: 'user_123',
        tierId: 'tier_vip',
        viewerIds: ['viewer_1'],
        quantity: 1,
        ticketType: 'E_TICKET',
      }),
    ).rejects.toThrow(
      new BadRequestException('ticketType does not match tier.'),
    );
    expect(txPrismaMock.viewer.findMany).not.toHaveBeenCalled();
    expect(txPrismaMock.order.create).not.toHaveBeenCalled();
    expect(txPrismaMock.orderItem.createMany).not.toHaveBeenCalled();
  });

  it('rejects quantity mismatches inside the service before persistence', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        CheckoutService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    const service = moduleRef.get(CheckoutService);

    await expect(
      service.createDraftOrder({
        userId: 'user_123',
        tierId: 'tier_vip',
        viewerIds: ['viewer_1'],
        quantity: 2,
        ticketType: 'E_TICKET',
      }),
    ).rejects.toThrow(
      new BadRequestException(
        'viewerIds length must match quantity for draft orders.',
      ),
    );
    expect(txPrismaMock.ticketTier.findUnique).not.toHaveBeenCalled();
    expect(txPrismaMock.viewer.findMany).not.toHaveBeenCalled();
    expect(txPrismaMock.order.create).not.toHaveBeenCalled();
    expect(txPrismaMock.orderItem.createMany).not.toHaveBeenCalled();
  });

  it('rejects empty viewer ids inside the service before persistence', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        CheckoutService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    const service = moduleRef.get(CheckoutService);

    await expect(
      service.createDraftOrder({
        userId: 'user_123',
        tierId: 'tier_vip',
        viewerIds: [],
        quantity: 0,
        ticketType: 'E_TICKET',
      }),
    ).rejects.toThrow(
      new BadRequestException(
        'viewerIds must be a non-empty array of non-empty strings.',
      ),
    );
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(txPrismaMock.ticketTier.findUnique).not.toHaveBeenCalled();
    expect(txPrismaMock.viewer.findMany).not.toHaveBeenCalled();
    expect(txPrismaMock.order.create).not.toHaveBeenCalled();
    expect(txPrismaMock.orderItem.createMany).not.toHaveBeenCalled();
  });

  it('rejects non-positive quantity inside the service before persistence', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        CheckoutService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    const service = moduleRef.get(CheckoutService);

    await expect(
      service.createDraftOrder({
        userId: 'user_123',
        tierId: 'tier_vip',
        viewerIds: ['viewer_1'],
        quantity: 0,
        ticketType: 'E_TICKET',
      }),
    ).rejects.toThrow(
      new BadRequestException('quantity must be a positive integer.'),
    );
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(txPrismaMock.ticketTier.findUnique).not.toHaveBeenCalled();
    expect(txPrismaMock.viewer.findMany).not.toHaveBeenCalled();
    expect(txPrismaMock.order.create).not.toHaveBeenCalled();
    expect(txPrismaMock.orderItem.createMany).not.toHaveBeenCalled();
  });

  it('rejects viewer ids that do not belong to the submitting user', async () => {
    txPrismaMock.ticketTier.findUnique.mockResolvedValue({
      id: 'tier_vip',
      price: 880,
      ticketType: 'E_TICKET',
    });
    txPrismaMock.viewer.findMany.mockResolvedValue([{ id: 'viewer_1' }]);

    const moduleRef = await Test.createTestingModule({
      providers: [
        CheckoutService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    const service = moduleRef.get(CheckoutService);

    await expect(
      service.createDraftOrder({
        userId: 'user_123',
        tierId: 'tier_vip',
        viewerIds: ['viewer_1', 'viewer_2'],
        quantity: 2,
        ticketType: 'E_TICKET',
      }),
    ).rejects.toThrow(
      new BadRequestException(
        'viewerIds must belong to the submitting user.',
      ),
    );
    expect(txPrismaMock.order.create).not.toHaveBeenCalled();
    expect(txPrismaMock.orderItem.createMany).not.toHaveBeenCalled();
  });

  it('rejects malformed draft order payloads at the controller boundary', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [
        CheckoutService,
        { provide: OrdersService, useValue: ordersServiceMock },
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    const controller = moduleRef.get(OrdersController);

    await expect(
      controller.createDraftOrder({
        tierId: '',
        viewerIds: ['viewer_1'],
        quantity: 2,
        ticketType: 'BAD_TICKET_TYPE',
      } as never, { id: 'user_123', openId: 'openid_abc123' }),
    ).rejects.toThrow(BadRequestException);
  });
});
