import { BadRequestException } from '@nestjs/common';

import { CheckoutService } from '../checkout/checkout.service';
import { OrdersService } from './orders.service';

import { OrdersController } from './orders.controller';

describe('OrdersController', () => {
  const checkoutServiceMock = {
    createDraftOrder: jest.fn(),
  } as unknown as CheckoutService;
  const ordersServiceMock = {
    getCustomerOrderDetail: jest.fn(),
    listCustomerOrders: jest.fn(),
  } as unknown as OrdersService;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses the authenticated customer id when creating a draft order', async () => {
    (checkoutServiceMock.createDraftOrder as jest.Mock).mockResolvedValue({
      createdAt: '2026-04-17T09:30:00.000Z',
      id: 'order_123',
      inventoryLockExpiresAt: '2026-04-17T09:45:00.000Z',
      quantity: 2,
      status: 'PENDING_PAYMENT',
      tierId: 'tier_vip',
      ticketType: 'E_TICKET',
      userId: 'cust_123',
      viewerIds: ['viewer_1', 'viewer_2'],
    });

    const controller = new OrdersController(
      checkoutServiceMock,
      ordersServiceMock,
    );
    const result = await controller.createDraftOrder(
      {
        tierId: 'tier_vip',
        viewerIds: ['viewer_1', 'viewer_2'],
        quantity: 2,
        ticketType: 'E_TICKET',
      },
      { id: 'cust_123', openId: 'openid_abc' },
    );

    expect(checkoutServiceMock.createDraftOrder).toHaveBeenCalledWith({
      tierId: 'tier_vip',
      viewerIds: ['viewer_1', 'viewer_2'],
      quantity: 2,
      ticketType: 'E_TICKET',
      userId: 'cust_123',
    });
    expect(result).toEqual({
      createdAt: '2026-04-17T09:30:00.000Z',
      id: 'order_123',
      inventoryLockExpiresAt: '2026-04-17T09:45:00.000Z',
      quantity: 2,
      status: 'PENDING_PAYMENT',
      tierId: 'tier_vip',
      ticketType: 'E_TICKET',
      userId: 'cust_123',
      viewerIds: ['viewer_1', 'viewer_2'],
    });
  });

  it('rejects malformed draft order payloads before delegating', async () => {
    const controller = new OrdersController(
      checkoutServiceMock,
      ordersServiceMock,
    );

    await expect(
      controller.createDraftOrder(
        {
          tierId: '',
          viewerIds: ['viewer_1'],
          quantity: 1,
          ticketType: 'BAD_TICKET_TYPE',
        } as never,
        { id: 'cust_123', openId: 'openid_abc' },
      ),
    ).rejects.toThrow(BadRequestException);
    expect(checkoutServiceMock.createDraftOrder).not.toHaveBeenCalled();
  });

  it('lists the current customer orders through the orders service', async () => {
    (ordersServiceMock.listCustomerOrders as jest.Mock).mockResolvedValue([
      { id: 'ord_1' },
    ]);

    const controller = new OrdersController(
      checkoutServiceMock,
      ordersServiceMock,
    );

    await expect(controller.listMyOrders({ id: 'cust_123', openId: 'openid_abc' })).resolves.toEqual({
      items: [{ id: 'ord_1' }],
    });
    expect(ordersServiceMock.listCustomerOrders).toHaveBeenCalledWith('cust_123');
  });

  it('loads a current customer order detail through the orders service', async () => {
    (ordersServiceMock.getCustomerOrderDetail as jest.Mock).mockResolvedValue({
      id: 'ord_1',
    });

    const controller = new OrdersController(
      checkoutServiceMock,
      ordersServiceMock,
    );

    await expect(
      controller.getMyOrder({ id: 'cust_123', openId: 'openid_abc' }, 'ord_1'),
    ).resolves.toEqual({ id: 'ord_1' });
    expect(ordersServiceMock.getCustomerOrderDetail).toHaveBeenCalledWith(
      'cust_123',
      'ord_1',
    );
  });
});
