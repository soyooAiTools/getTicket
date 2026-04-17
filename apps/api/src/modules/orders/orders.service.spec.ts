import { NotFoundException } from '@nestjs/common';

import { OrderTimelineService } from './order-timeline.service';
import { OrdersService } from './orders.service';

describe('OrdersService', () => {
  const prismaMock = {
    order: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
  } as never;

  const orderTimelineServiceMock = {
    toTimelineItem: jest.fn(),
  } as never;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists the current customer orders in reverse chronological order', async () => {
    (prismaMock.order.findMany as jest.Mock).mockResolvedValue([
      {
        createdAt: new Date('2026-04-17T12:00:00.000Z'),
        currency: 'CNY',
        id: 'ord_1',
        items: [
          {
            ticketTier: {
              session: {
                event: {
                  city: 'Shanghai',
                  coverImageUrl: null,
                  id: 'event_beta_1',
                  minPrice: 79900,
                  refundEntryEnabled: true,
                  saleStatus: 'ON_SALE',
                  title: 'Beta Concert',
                  venueName: 'Expo Arena',
                },
              },
            },
          },
        ],
        orderNumber: 'ORD-001',
        status: 'PAID_PENDING_FULFILLMENT',
        ticketType: 'E_TICKET',
        totalAmount: 159800,
      },
    ]);
    (orderTimelineServiceMock.toTimelineItem as jest.Mock).mockReturnValue({
      description:
        'E-ticket confirmation arrives no later than 3 days before the show.',
      title: 'Pending Fulfillment',
    });

    const service = new OrdersService(
      prismaMock,
      orderTimelineServiceMock as unknown as OrderTimelineService,
    );

    await expect(service.listCustomerOrders('cust_1')).resolves.toEqual([
      {
        createdAt: '2026-04-17T12:00:00.000Z',
        currency: 'CNY',
        event: {
          city: 'Shanghai',
          id: 'event_beta_1',
          minPrice: 79900,
          saleStatus: 'ON_SALE',
          title: 'Beta Concert',
          venueName: 'Expo Arena',
        },
        id: 'ord_1',
        orderNumber: 'ORD-001',
        refundEntryEnabled: true,
        status: 'PAID_PENDING_FULFILLMENT',
        ticketType: 'E_TICKET',
        timeline: {
          description:
            'E-ticket confirmation arrives no later than 3 days before the show.',
          title: 'Pending Fulfillment',
        },
        totalAmount: 159800,
      },
    ]);

    expect(prismaMock.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: 'desc' },
        where: { userId: 'cust_1' },
      }),
    );
    expect(orderTimelineServiceMock.toTimelineItem).toHaveBeenCalledWith(
      'PAID_PENDING_FULFILLMENT',
      'E_TICKET',
    );
  });

  it('returns a current customer order detail payload', async () => {
    (prismaMock.order.findFirst as jest.Mock).mockResolvedValue({
      createdAt: new Date('2026-04-17T12:00:00.000Z'),
      currency: 'CNY',
      id: 'ord_1',
      items: [
        {
          id: 'item_1',
          quantity: 2,
          ticketTier: {
            name: 'Inner Field',
            session: {
              id: 'session_1',
              name: '2026-05-01 19:30',
              event: {
                city: 'Shanghai',
                coverImageUrl: null,
                id: 'event_beta_1',
                minPrice: 79900,
                refundEntryEnabled: true,
                saleStatus: 'ON_SALE',
                title: 'Beta Concert',
                venueName: 'Expo Arena',
              },
            },
          },
          totalAmount: 159800,
          unitPrice: 79900,
          viewer: {
            id: 'viewer_1',
            mobile: '13800138000',
            name: 'Zhang San',
          },
        },
      ],
      orderNumber: 'ORD-001',
      status: 'PAID_PENDING_FULFILLMENT',
      ticketType: 'E_TICKET',
      totalAmount: 159800,
      userId: 'cust_1',
    });
    (orderTimelineServiceMock.toTimelineItem as jest.Mock).mockReturnValue({
      description:
        'E-ticket confirmation arrives no later than 3 days before the show.',
      title: 'Pending Fulfillment',
    });

    const service = new OrdersService(
      prismaMock,
      orderTimelineServiceMock as unknown as OrderTimelineService,
    );

    await expect(
      service.getCustomerOrderDetail('cust_1', 'ord_1'),
    ).resolves.toEqual({
      createdAt: '2026-04-17T12:00:00.000Z',
      currency: 'CNY',
      event: {
        city: 'Shanghai',
        id: 'event_beta_1',
        minPrice: 79900,
        saleStatus: 'ON_SALE',
        title: 'Beta Concert',
        venueName: 'Expo Arena',
      },
      id: 'ord_1',
      items: [
        {
          id: 'item_1',
          quantity: 2,
          sessionId: 'session_1',
          sessionName: '2026-05-01 19:30',
          tierName: 'Inner Field',
          totalAmount: 159800,
          unitPrice: 79900,
          viewer: {
            id: 'viewer_1',
            mobile: '13800138000',
            name: 'Zhang San',
          },
        },
      ],
      orderNumber: 'ORD-001',
      refundEntryEnabled: true,
      status: 'PAID_PENDING_FULFILLMENT',
      ticketType: 'E_TICKET',
      timeline: {
        description:
          'E-ticket confirmation arrives no later than 3 days before the show.',
        title: 'Pending Fulfillment',
      },
      totalAmount: 159800,
    });
    expect(prismaMock.order.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'ord_1',
          userId: 'cust_1',
        },
      }),
    );
  });

  it('throws NotFoundException when the customer does not own the order', async () => {
    (prismaMock.order.findFirst as jest.Mock).mockResolvedValue(null);

    const service = new OrdersService(
      prismaMock,
      orderTimelineServiceMock as unknown as OrderTimelineService,
    );

    await expect(
      service.getCustomerOrderDetail('cust_1', 'ord_missing'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lists admin orders with event, payment, and refund summaries', async () => {
    (prismaMock.order.findMany as jest.Mock).mockResolvedValue([
      {
        createdAt: new Date('2026-04-17T12:00:00.000Z'),
        currency: 'CNY',
        id: 'ord_admin_1',
        items: [
          {
            quantity: 2,
            ticketTier: {
              name: 'Inner Field',
              session: {
                id: 'session_1',
                name: '2026-05-01 19:30',
                event: {
                  city: 'Shanghai',
                  coverImageUrl: null,
                  id: 'event_beta_1',
                  minPrice: 79900,
                  refundEntryEnabled: true,
                  saleStatus: 'ON_SALE',
                  title: 'Beta Concert',
                  venueName: 'Expo Arena',
                },
              },
            },
          },
        ],
        orderNumber: 'ORD-001',
        payments: [
          {
            paidAt: new Date('2026-04-17T12:05:00.000Z'),
            providerTxnId: 'wx_txn_1',
            status: 'SUCCEEDED',
          },
        ],
        refundRequests: [
          {
            refundNo: 'RFD-001',
            status: 'PROCESSING',
          },
        ],
        status: 'PAID_PENDING_FULFILLMENT',
        ticketType: 'E_TICKET',
        totalAmount: 159800,
        userId: 'cust_1',
      },
    ]);

    const service = new OrdersService(
      prismaMock,
      orderTimelineServiceMock as unknown as OrderTimelineService,
    );

    await expect(service.listAdminOrders()).resolves.toEqual([
      {
        createdAt: '2026-04-17T12:00:00.000Z',
        currency: 'CNY',
        event: {
          city: 'Shanghai',
          id: 'event_beta_1',
          title: 'Beta Concert',
          venueName: 'Expo Arena',
        },
        id: 'ord_admin_1',
        itemCount: 2,
        latestPayment: {
          paidAt: '2026-04-17T12:05:00.000Z',
          providerTxnId: 'wx_txn_1',
          status: 'SUCCEEDED',
        },
        latestRefundRequest: {
          refundNo: 'RFD-001',
          status: 'PROCESSING',
        },
        orderNumber: 'ORD-001',
        sessionName: '2026-05-01 19:30',
        status: 'PAID_PENDING_FULFILLMENT',
        ticketType: 'E_TICKET',
        totalAmount: 159800,
        userId: 'cust_1',
      },
    ]);

    expect(prismaMock.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: 'desc' },
      }),
    );
  });
});
