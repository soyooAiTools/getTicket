import { Test } from '@nestjs/testing';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Prisma } from '@prisma/client';

import { AdminApiSecretGuard } from '../../common/auth/admin-api-secret.guard';
import { PrismaService } from '../../common/prisma/prisma.service';
import { VendorCallbackSecretGuard } from '../../common/auth/vendor-callback-secret.guard';
import { UpstreamTicketingGateway } from '../../common/vendors/upstream-ticketing.gateway';
import { FulfillmentController } from './fulfillment.controller';
import { FulfillmentEventsService } from './fulfillment-events.service';
import {
  assertManualIssuedRequest,
  assertVendorCallbackIssuedRequest,
} from './fulfillment.controller';

describe('FulfillmentEventsService', () => {
  const txPrismaMock = {
    fulfillmentEvent: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    order: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  const prismaMock = {
    $transaction: jest.fn(),
    fulfillmentEvent: txPrismaMock.fulfillmentEvent,
  } as unknown as PrismaService;

  const upstreamGatewayMock = {
    submitOrder: jest.fn(),
  } as unknown as UpstreamTicketingGateway;

  beforeEach(() => {
    jest.clearAllMocks();
    txPrismaMock.fulfillmentEvent.create.mockReset();
    txPrismaMock.fulfillmentEvent.findMany.mockReset();
    txPrismaMock.fulfillmentEvent.findUnique.mockReset();
    txPrismaMock.order.findUnique.mockReset();
    txPrismaMock.order.updateMany.mockReset();
    (prismaMock.$transaction as jest.Mock).mockReset();
    (upstreamGatewayMock.submitOrder as jest.Mock).mockReset();
    (prismaMock.$transaction as jest.Mock).mockImplementation(
      async (callback: (tx: typeof txPrismaMock) => Promise<unknown>) =>
        callback(txPrismaMock),
    );
  });

  it('submits a newly paid order upstream and advances it to SUBMITTED_TO_VENDOR', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        FulfillmentEventsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: UpstreamTicketingGateway, useValue: upstreamGatewayMock },
      ],
    }).compile();

    const service = moduleRef.get(FulfillmentEventsService);

    txPrismaMock.order.findUnique.mockResolvedValue({
      status: 'PAID_PENDING_FULFILLMENT',
    });
    txPrismaMock.order.updateMany.mockResolvedValue({ count: 1 });
    (upstreamGatewayMock.submitOrder as jest.Mock).mockResolvedValue({
      externalRef: 'vendor_submit_1',
    });

    await expect(service.submitPaidOrder('order_paid_1')).resolves.toEqual({
      externalRef: 'vendor_submit_1',
      nextStatus: 'SUBMITTED_TO_VENDOR',
      orderId: 'order_paid_1',
    });

    expect(upstreamGatewayMock.submitOrder).toHaveBeenCalledWith({
      orderId: 'order_paid_1',
    });
    expect(txPrismaMock.fulfillmentEvent.create).toHaveBeenCalledWith({
      data: {
        externalRef: 'vendor_submit_1',
        orderId: 'order_paid_1',
        payload: {
          source: 'UPSTREAM_SUBMISSION',
        },
        status: 'SUBMITTED',
      },
    });
    expect(txPrismaMock.order.updateMany).toHaveBeenCalledWith({
      data: {
        status: 'SUBMITTED_TO_VENDOR',
      },
      where: {
        id: 'order_paid_1',
        status: 'PAID_PENDING_FULFILLMENT',
      },
    });
  });

  it('treats upstream submission as idempotent when the order is already submitted to vendor', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        FulfillmentEventsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: UpstreamTicketingGateway, useValue: upstreamGatewayMock },
      ],
    }).compile();

    const service = moduleRef.get(FulfillmentEventsService);

    txPrismaMock.order.findUnique.mockResolvedValue({
      status: 'SUBMITTED_TO_VENDOR',
    });

    await expect(service.submitPaidOrder('order_paid_2')).resolves.toEqual({
      nextStatus: 'SUBMITTED_TO_VENDOR',
      orderId: 'order_paid_2',
    });

    expect(upstreamGatewayMock.submitOrder).not.toHaveBeenCalled();
    expect(txPrismaMock.fulfillmentEvent.create).not.toHaveBeenCalled();
    expect(txPrismaMock.order.updateMany).not.toHaveBeenCalled();
  });

  it('does not double-post upstream when a concurrent caller already advanced the order', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        FulfillmentEventsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: UpstreamTicketingGateway, useValue: upstreamGatewayMock },
      ],
    }).compile();

    const service = moduleRef.get(FulfillmentEventsService);

    txPrismaMock.order.findUnique
      .mockResolvedValueOnce({
        status: 'PAID_PENDING_FULFILLMENT',
      })
      .mockResolvedValueOnce({
        status: 'SUBMITTED_TO_VENDOR',
      });
    txPrismaMock.order.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.submitPaidOrder('order_paid_4')).resolves.toEqual({
      nextStatus: 'SUBMITTED_TO_VENDOR',
      orderId: 'order_paid_4',
    });

    expect(upstreamGatewayMock.submitOrder).not.toHaveBeenCalled();
    expect(txPrismaMock.fulfillmentEvent.create).not.toHaveBeenCalled();
    expect(txPrismaMock.order.updateMany).toHaveBeenCalledWith({
      data: {
        status: 'SUBMITTED_TO_VENDOR',
      },
      where: {
        id: 'order_paid_4',
        status: 'PAID_PENDING_FULFILLMENT',
      },
    });
  });

  it('rejects upstream submission when the order is not in a payable fulfillment state', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        FulfillmentEventsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: UpstreamTicketingGateway, useValue: upstreamGatewayMock },
      ],
    }).compile();

    const service = moduleRef.get(FulfillmentEventsService);

    txPrismaMock.order.findUnique.mockResolvedValue({
      status: 'REFUNDED',
    });

    await expect(service.submitPaidOrder('order_paid_3')).rejects.toThrow(
      'order status REFUNDED is not eligible for upstream submission.',
    );

    expect(upstreamGatewayMock.submitOrder).not.toHaveBeenCalled();
    expect(txPrismaMock.fulfillmentEvent.create).not.toHaveBeenCalled();
    expect(txPrismaMock.order.updateMany).not.toHaveBeenCalled();
  });

  it('persists a manual issued fulfillment event and advances the order to TICKET_ISSUED', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        FulfillmentEventsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: UpstreamTicketingGateway, useValue: upstreamGatewayMock },
      ],
    }).compile();

    const service = moduleRef.get(FulfillmentEventsService);

    txPrismaMock.order.findUnique.mockResolvedValue({
      status: 'PAID_PENDING_FULFILLMENT',
    });
    txPrismaMock.order.updateMany.mockResolvedValue({ count: 1 });

    await expect(
      service.recordManualIssued({
        orderId: 'order_1001',
        operatorId: 'operator_9001',
        ticketCode: 'TK-7788',
      }),
    ).resolves.toEqual({
      orderId: 'order_1001',
      operatorId: 'operator_9001',
      ticketCode: 'TK-7788',
      nextStatus: 'TICKET_ISSUED',
      source: 'MANUAL',
    });

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(txPrismaMock.fulfillmentEvent.create).toHaveBeenCalledWith({
      data: {
        orderId: 'order_1001',
        status: 'ISSUED',
        payload: {
          operatorId: 'operator_9001',
          source: 'MANUAL',
          ticketCode: 'TK-7788',
        },
      },
    });
    expect(txPrismaMock.order.findUnique).toHaveBeenCalledWith({
      select: {
        status: true,
      },
      where: {
        id: 'order_1001',
      },
    });
    expect(txPrismaMock.order.updateMany).toHaveBeenCalledWith({
      data: {
        status: 'TICKET_ISSUED',
      },
      where: {
        id: 'order_1001',
        status: 'PAID_PENDING_FULFILLMENT',
      },
    });
  });

  it('rejects a manual issued request when the order does not exist', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        FulfillmentEventsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: UpstreamTicketingGateway, useValue: upstreamGatewayMock },
      ],
    }).compile();

    const service = moduleRef.get(FulfillmentEventsService);

    txPrismaMock.order.findUnique.mockResolvedValue(null);

    await expect(
      service.recordManualIssued({
        orderId: 'missing_manual_order',
        operatorId: 'operator_unpaid',
        ticketCode: 'TK-UNPAID',
      }),
    ).rejects.toThrow('Order not found.');

    expect(txPrismaMock.fulfillmentEvent.create).not.toHaveBeenCalled();
    expect(txPrismaMock.order.updateMany).not.toHaveBeenCalled();
  });

  it('rejects a manual issued request for an ineligible refunded order without creating an event', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        FulfillmentEventsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: UpstreamTicketingGateway, useValue: upstreamGatewayMock },
      ],
    }).compile();

    const service = moduleRef.get(FulfillmentEventsService);

    txPrismaMock.order.findUnique.mockResolvedValue({
      status: 'REFUNDED',
    });

    await expect(
      service.recordManualIssued({
        orderId: 'order_refunded',
        operatorId: 'operator_refunded',
        ticketCode: 'TK-REFUNDED',
      }),
    ).rejects.toThrow('order status REFUNDED is not eligible for ticket issuance.');

    expect(txPrismaMock.fulfillmentEvent.create).not.toHaveBeenCalled();
    expect(txPrismaMock.order.updateMany).not.toHaveBeenCalled();
  });

  it('does not create a manual issued fulfillment event when the guarded transition loses the race', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        FulfillmentEventsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: UpstreamTicketingGateway, useValue: upstreamGatewayMock },
      ],
    }).compile();

    const service = moduleRef.get(FulfillmentEventsService);

    txPrismaMock.order.findUnique
      .mockResolvedValueOnce({
        status: 'PAID_PENDING_FULFILLMENT',
      })
      .mockResolvedValueOnce({
        status: 'REFUNDED',
      });
    txPrismaMock.order.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.recordManualIssued({
        orderId: 'order_race_lost',
        operatorId: 'operator_race_lost',
        ticketCode: 'TK-RACE-LOST',
      }),
    ).rejects.toThrow(
      'order status REFUNDED is not eligible for ticket issuance.',
    );

    expect(txPrismaMock.fulfillmentEvent.create).not.toHaveBeenCalled();
    expect(txPrismaMock.order.updateMany).toHaveBeenCalledWith({
      data: {
        status: 'TICKET_ISSUED',
      },
      where: {
        id: 'order_race_lost',
        status: 'PAID_PENDING_FULFILLMENT',
      },
    });
  });

  it('treats a manual issued request for an already issued order as idempotent without creating another event', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        FulfillmentEventsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: UpstreamTicketingGateway, useValue: upstreamGatewayMock },
      ],
    }).compile();

    const service = moduleRef.get(FulfillmentEventsService);

    txPrismaMock.order.findUnique.mockResolvedValue({
      status: 'TICKET_ISSUED',
    });

    await expect(
      service.recordManualIssued({
        orderId: 'order_issued',
        operatorId: 'operator_issued',
        ticketCode: 'TK-ISSUED',
      }),
    ).resolves.toEqual({
      orderId: 'order_issued',
      operatorId: 'operator_issued',
      ticketCode: 'TK-ISSUED',
      nextStatus: 'TICKET_ISSUED',
      source: 'MANUAL',
    });

    expect(txPrismaMock.fulfillmentEvent.create).not.toHaveBeenCalled();
    expect(txPrismaMock.order.updateMany).not.toHaveBeenCalled();
  });

  it('persists a vendor callback fulfillment event and advances the order to TICKET_ISSUED', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        FulfillmentEventsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: UpstreamTicketingGateway, useValue: upstreamGatewayMock },
      ],
    }).compile();

    const service = moduleRef.get(FulfillmentEventsService);

    txPrismaMock.fulfillmentEvent.findUnique.mockResolvedValue(null);
    txPrismaMock.order.findUnique.mockResolvedValue({
      status: 'SUBMITTED_TO_VENDOR',
    });
    txPrismaMock.order.updateMany.mockResolvedValue({ count: 1 });

    await expect(
      service.recordVendorCallbackIssued({
        orderId: 'order_1002',
        vendorEventId: 'vendor_evt_01',
        ticketCode: 'TK-8899',
      }),
    ).resolves.toEqual({
      orderId: 'order_1002',
      ticketCode: 'TK-8899',
      vendorEventId: 'vendor_evt_01',
      nextStatus: 'TICKET_ISSUED',
      source: 'VENDOR_CALLBACK',
    });

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(txPrismaMock.fulfillmentEvent.findUnique).toHaveBeenCalledWith({
      select: {
        orderId: true,
        payload: true,
      },
      where: {
        externalRef: 'vendor_evt_01',
      },
    });
    expect(txPrismaMock.order.findUnique).toHaveBeenCalledWith({
      select: {
        status: true,
      },
      where: {
        id: 'order_1002',
      },
    });
    expect(txPrismaMock.fulfillmentEvent.create).toHaveBeenCalledWith({
      data: {
        externalRef: 'vendor_evt_01',
        orderId: 'order_1002',
        status: 'ISSUED',
        payload: {
          source: 'VENDOR_CALLBACK',
          ticketCode: 'TK-8899',
          vendorEventId: 'vendor_evt_01',
        },
      },
    });
    expect(txPrismaMock.order.updateMany).toHaveBeenCalledWith({
      data: {
        status: 'TICKET_ISSUED',
      },
      where: {
        id: 'order_1002',
        status: 'SUBMITTED_TO_VENDOR',
      },
    });
  });

  it('reserves a vendor externalRef when the order is already TICKET_ISSUED and no event exists', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        FulfillmentEventsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: UpstreamTicketingGateway, useValue: upstreamGatewayMock },
      ],
    }).compile();

    const service = moduleRef.get(FulfillmentEventsService);

    txPrismaMock.fulfillmentEvent.findUnique.mockResolvedValue(null);
    txPrismaMock.order.findUnique.mockResolvedValue({
      status: 'TICKET_ISSUED',
    });

    await expect(
      service.recordVendorCallbackIssued({
        orderId: 'order_issued_vendor',
        vendorEventId: 'vendor_evt_issued',
        ticketCode: 'TK-VENDOR-ISSUED',
      }),
    ).resolves.toEqual({
      orderId: 'order_issued_vendor',
      ticketCode: 'TK-VENDOR-ISSUED',
      vendorEventId: 'vendor_evt_issued',
      nextStatus: 'TICKET_ISSUED',
      source: 'VENDOR_CALLBACK',
    });

    expect(txPrismaMock.fulfillmentEvent.create).toHaveBeenCalledWith({
      data: {
        externalRef: 'vendor_evt_issued',
        orderId: 'order_issued_vendor',
        status: 'ISSUED',
        payload: {
          source: 'VENDOR_CALLBACK',
          ticketCode: 'TK-VENDOR-ISSUED',
          vendorEventId: 'vendor_evt_issued',
        },
      },
    });
    expect(txPrismaMock.order.updateMany).not.toHaveBeenCalled();
  });

  it('rejects a vendor callback issued request when the order does not exist before creating an event', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        FulfillmentEventsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: UpstreamTicketingGateway, useValue: upstreamGatewayMock },
      ],
    }).compile();

    const service = moduleRef.get(FulfillmentEventsService);

    txPrismaMock.fulfillmentEvent.findUnique.mockResolvedValue(null);
    txPrismaMock.order.findUnique.mockResolvedValue(null);

    await expect(
      service.recordVendorCallbackIssued({
        orderId: 'missing_vendor_order',
        vendorEventId: 'vendor_evt_missing',
        ticketCode: 'TK-MISSING',
      }),
    ).rejects.toThrow('Order not found.');

    expect(txPrismaMock.fulfillmentEvent.create).not.toHaveBeenCalled();
    expect(txPrismaMock.order.updateMany).not.toHaveBeenCalled();
  });

  it('treats a vendor replay with the same vendorEventId as idempotent without creating a duplicate event', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        FulfillmentEventsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: UpstreamTicketingGateway, useValue: upstreamGatewayMock },
      ],
    }).compile();

    const service = moduleRef.get(FulfillmentEventsService);

    txPrismaMock.fulfillmentEvent.findUnique.mockResolvedValue({
      orderId: 'order_3001',
      payload: {
        source: 'VENDOR_CALLBACK',
        ticketCode: 'TK-3001',
        vendorEventId: 'vendor_evt_3001',
      },
    });
    txPrismaMock.order.findUnique.mockResolvedValue({
      status: 'PAID_PENDING_FULFILLMENT',
    });
    txPrismaMock.order.updateMany.mockResolvedValue({ count: 1 });

    await expect(
      service.recordVendorCallbackIssued({
        orderId: 'order_3001',
        vendorEventId: 'vendor_evt_3001',
        ticketCode: 'TK-3001',
      }),
    ).resolves.toEqual({
      orderId: 'order_3001',
      ticketCode: 'TK-3001',
      vendorEventId: 'vendor_evt_3001',
      nextStatus: 'TICKET_ISSUED',
      source: 'VENDOR_CALLBACK',
    });

    expect(txPrismaMock.fulfillmentEvent.create).not.toHaveBeenCalled();
    expect(txPrismaMock.fulfillmentEvent.findUnique).toHaveBeenCalledTimes(1);
    expect(txPrismaMock.order.updateMany).toHaveBeenCalledWith({
      data: {
        status: 'TICKET_ISSUED',
      },
      where: {
        id: 'order_3001',
        status: 'PAID_PENDING_FULFILLMENT',
      },
    });
  });

  it('recovers from a vendor unique constraint race by re-reading externalRef', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        FulfillmentEventsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: UpstreamTicketingGateway, useValue: upstreamGatewayMock },
      ],
    }).compile();

    const service = moduleRef.get(FulfillmentEventsService);

    txPrismaMock.fulfillmentEvent.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        orderId: 'order_5001',
        payload: {
          source: 'VENDOR_CALLBACK',
          ticketCode: 'TK-5001',
          vendorEventId: 'vendor_evt_5001',
        },
      });
    txPrismaMock.fulfillmentEvent.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );
    txPrismaMock.order.findUnique.mockResolvedValue({
      status: 'SUBMITTED_TO_VENDOR',
    });
    txPrismaMock.order.updateMany.mockResolvedValue({ count: 1 });

    await expect(
      service.recordVendorCallbackIssued({
        orderId: 'order_5001',
        vendorEventId: 'vendor_evt_5001',
        ticketCode: 'TK-5001',
      }),
    ).resolves.toEqual({
      orderId: 'order_5001',
      ticketCode: 'TK-5001',
      vendorEventId: 'vendor_evt_5001',
      nextStatus: 'TICKET_ISSUED',
      source: 'VENDOR_CALLBACK',
    });

    expect(txPrismaMock.fulfillmentEvent.create).toHaveBeenCalledTimes(1);
    expect(txPrismaMock.fulfillmentEvent.findUnique).toHaveBeenCalledTimes(2);
  });

  it('rejects a conflicting vendor replay bound to a different order or ticket code', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        FulfillmentEventsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: UpstreamTicketingGateway, useValue: upstreamGatewayMock },
      ],
    }).compile();

    const service = moduleRef.get(FulfillmentEventsService);

    txPrismaMock.fulfillmentEvent.findUnique.mockResolvedValue({
      orderId: 'order_other',
      payload: {
        source: 'VENDOR_CALLBACK',
        ticketCode: 'TK-9999',
        vendorEventId: 'vendor_evt_conflict',
      },
    });

    await expect(
      service.recordVendorCallbackIssued({
        orderId: 'order_4001',
        vendorEventId: 'vendor_evt_conflict',
        ticketCode: 'TK-4001',
      }),
    ).rejects.toThrow(
      'vendorEventId is already associated with a different fulfillment event.',
    );

    expect(txPrismaMock.fulfillmentEvent.create).not.toHaveBeenCalled();
    expect(txPrismaMock.order.findUnique).not.toHaveBeenCalled();
    expect(txPrismaMock.order.updateMany).not.toHaveBeenCalled();
  });

  it('lists admin fulfillment operations with order and event context', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        FulfillmentEventsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: UpstreamTicketingGateway, useValue: upstreamGatewayMock },
      ],
    }).compile();

    const service = moduleRef.get(FulfillmentEventsService);

    txPrismaMock.fulfillmentEvent.findMany.mockResolvedValue([
      {
        externalRef: 'vendor_evt_1',
        id: 'ful_1',
        occurredAt: new Date('2026-04-17T12:10:00.000Z'),
        order: {
          id: 'ord_1',
          items: [
            {
              ticketTier: {
                name: 'Inner Field',
                session: {
                  event: {
                    city: 'Shanghai',
                    id: 'event_beta_1',
                    title: 'Beta Concert',
                    venueName: 'Expo Arena',
                  },
                },
              },
            },
          ],
          orderNumber: 'ORD-001',
          status: 'SUBMITTED_TO_VENDOR',
        },
        orderId: 'ord_1',
        payload: {
          source: 'UPSTREAM_SUBMISSION',
          ticketCode: 'TK-1001',
        },
        status: 'SUBMITTED',
      },
    ]);

    await expect(service.listAdminOperations()).resolves.toEqual([
      {
        event: {
          city: 'Shanghai',
          id: 'event_beta_1',
          title: 'Beta Concert',
          venueName: 'Expo Arena',
        },
        externalRef: 'vendor_evt_1',
        id: 'ful_1',
        occurredAt: '2026-04-17T12:10:00.000Z',
        orderId: 'ord_1',
        orderNumber: 'ORD-001',
        orderStatus: 'SUBMITTED_TO_VENDOR',
        source: 'UPSTREAM_SUBMISSION',
        status: 'SUBMITTED',
        ticketCode: 'TK-1001',
        tierName: 'Inner Field',
      },
    ]);

    expect(txPrismaMock.fulfillmentEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: {
          occurredAt: 'desc',
        },
      }),
    );
  });

  it('accepts a valid manual issued request body at the controller boundary', () => {
    const body: unknown = {
      orderId: 'order_1003',
      operatorId: 'operator_1003',
      ticketCode: 'TK-9900',
    };

    expect(() => assertManualIssuedRequest(body)).not.toThrow();
    expect(body).toEqual({
      orderId: 'order_1003',
      operatorId: 'operator_1003',
      ticketCode: 'TK-9900',
    });
  });

  it('rejects malformed manual issued request bodies at the controller boundary', () => {
    expect(() =>
      assertManualIssuedRequest({
        orderId: 'order_1004',
        operatorId: '',
        ticketCode: 'TK-1004',
      }),
    ).toThrow('operatorId must be a non-empty string.');
  });

  it('rejects malformed vendor callback request bodies at the controller boundary', () => {
    expect(() =>
      assertVendorCallbackIssuedRequest({
        orderId: 'order_1005',
        ticketCode: 'TK-1005',
      }),
    ).toThrow('vendorEventId must be a non-empty string.');
  });

  it('routes a vendor issued callback through the fulfillment controller', async () => {
    const serviceMock = {
      recordVendorCallbackIssued: jest.fn().mockResolvedValue({
        orderId: 'order_1006',
        ticketCode: 'TK-1006',
        vendorEventId: 'vendor_evt_1006',
        nextStatus: 'TICKET_ISSUED',
        source: 'VENDOR_CALLBACK',
      }),
    } as never;
    const controller = new FulfillmentController(serviceMock);

    const result = await controller.recordVendorCallbackIssued({
      orderId: 'order_1006',
      ticketCode: 'TK-1006',
      vendorEventId: 'vendor_evt_1006',
    });

    expect(serviceMock.recordVendorCallbackIssued).toHaveBeenCalledWith({
      orderId: 'order_1006',
      ticketCode: 'TK-1006',
      vendorEventId: 'vendor_evt_1006',
    });
    expect(result).toEqual({
      orderId: 'order_1006',
      ticketCode: 'TK-1006',
      vendorEventId: 'vendor_evt_1006',
      nextStatus: 'TICKET_ISSUED',
      source: 'VENDOR_CALLBACK',
    });
  });

  it('protects manual issuance behind the admin secret guard', () => {
    const guards =
      Reflect.getMetadata(
        GUARDS_METADATA,
        FulfillmentController.prototype.recordManualIssued,
      ) ?? [];

    expect(guards).toContain(AdminApiSecretGuard);
  });

  it('protects vendor issuance callbacks behind the vendor callback secret guard', () => {
    const guards =
      Reflect.getMetadata(
        GUARDS_METADATA,
        FulfillmentController.prototype.recordVendorCallbackIssued,
      ) ?? [];

    expect(guards).toContain(VendorCallbackSecretGuard);
  });
});
