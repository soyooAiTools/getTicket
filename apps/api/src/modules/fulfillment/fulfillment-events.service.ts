import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import { UpstreamTicketingGateway } from '../../common/vendors/upstream-ticketing.gateway';

import { ORDER_STATUS, type OrderStatus } from '../orders/order-status';

export type FulfillmentEventSource =
  | 'MANUAL'
  | 'UPSTREAM_SUBMISSION'
  | 'VENDOR_CALLBACK';

export type FulfillmentTransition = {
  orderId: string;
  ticketCode: string;
  nextStatus: OrderStatus;
  source: FulfillmentEventSource;
  operatorId?: string;
  vendorEventId?: string;
};

export type RecordManualIssuedInput = {
  orderId: string;
  operatorId: string;
  ticketCode: string;
};

export type RecordVendorCallbackIssuedInput = {
  orderId: string;
  vendorEventId: string;
  ticketCode: string;
};

type FulfillmentPayload = {
  operatorId?: string;
  source: FulfillmentEventSource;
  ticketCode: string;
  vendorEventId?: string;
};

type AdminFulfillmentEventSummary = {
  city: string;
  id: string;
  title: string;
  venueName: string;
};

type PrismaAdminFulfillmentEvent = {
  externalRef: string | null;
  id: string;
  occurredAt: Date;
  order: {
    id: string;
    items: Array<{
      ticketTier: {
        name: string;
        session: {
          event: AdminFulfillmentEventSummary;
        };
      };
    }>;
    orderNumber: string;
    status: OrderStatus;
  };
  orderId: string;
  payload: unknown;
  status: string;
};

export type AdminFulfillmentOperationItem = {
  event?: AdminFulfillmentEventSummary;
  externalRef?: string;
  id: string;
  occurredAt: string;
  orderId: string;
  orderNumber: string;
  orderStatus: OrderStatus;
  source?: FulfillmentEventSource;
  status: string;
  ticketCode?: string;
  tierName?: string;
};

@Injectable()
export class FulfillmentEventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly upstreamTicketingGateway: UpstreamTicketingGateway,
  ) {}

  async submitPaidOrder(orderId: string): Promise<{
    externalRef?: string;
    nextStatus: OrderStatus;
    orderId: string;
  }> {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        select: {
          status: true,
        },
        where: {
          id: orderId,
        },
      });

      if (!order) {
        throw new BadRequestException('Order not found.');
      }

      if (order.status === ORDER_STATUS.SUBMITTED_TO_VENDOR) {
        return {
          nextStatus: ORDER_STATUS.SUBMITTED_TO_VENDOR,
          orderId,
        };
      }

      if (order.status !== ORDER_STATUS.PAID_PENDING_FULFILLMENT) {
        throw new BadRequestException(
          `order status ${order.status} is not eligible for upstream submission.`,
        );
      }

      const updateResult = await tx.order.updateMany({
        data: {
          status: ORDER_STATUS.SUBMITTED_TO_VENDOR,
        },
        where: {
          id: orderId,
          status: ORDER_STATUS.PAID_PENDING_FULFILLMENT,
        },
      });

      if (updateResult.count === 0) {
        const currentOrder = await tx.order.findUnique({
          select: {
            status: true,
          },
          where: {
            id: orderId,
          },
        });

        if (!currentOrder) {
          throw new BadRequestException('Order not found.');
        }

        return {
          nextStatus: currentOrder.status,
          orderId,
        };
      }

      const upstreamSubmission = await this.upstreamTicketingGateway.submitOrder({
        orderId,
      });

      await tx.fulfillmentEvent.create({
        data: {
          externalRef: upstreamSubmission.externalRef,
          orderId,
          payload: {
            source: 'UPSTREAM_SUBMISSION',
          },
          status: 'SUBMITTED',
        },
      });

      return {
        externalRef: upstreamSubmission.externalRef,
        nextStatus: ORDER_STATUS.SUBMITTED_TO_VENDOR,
        orderId,
      };
    });
  }

  async recordManualIssued(
    input: RecordManualIssuedInput,
  ): Promise<FulfillmentTransition> {
    return this.prisma.$transaction(async (tx) => {
      const issuanceOutcome = await this.resolveIssuanceOutcome(
        tx,
        input.orderId,
      );

      if (issuanceOutcome.status !== ORDER_STATUS.TICKET_ISSUED) {
        throw new BadRequestException(
          `order status ${issuanceOutcome.status} is not eligible for ticket issuance.`,
        );
      }

      if (!issuanceOutcome.transitioned) {
        return {
          ...input,
          nextStatus: issuanceOutcome.status,
          source: 'MANUAL',
        };
      }

      await tx.fulfillmentEvent.create({
        data: {
          orderId: input.orderId,
          payload: {
            operatorId: input.operatorId,
            source: 'MANUAL',
            ticketCode: input.ticketCode,
          },
          status: 'ISSUED',
        },
      });

      return {
        ...input,
        nextStatus: issuanceOutcome.status,
        source: 'MANUAL',
      };
    });
  }

  async recordVendorCallbackIssued(
    input: RecordVendorCallbackIssuedInput,
  ): Promise<FulfillmentTransition> {
    return this.prisma.$transaction(async (tx) => {
      const existingEvent = await tx.fulfillmentEvent.findUnique({
        where: {
          externalRef: input.vendorEventId,
        },
        select: {
          orderId: true,
          payload: true,
        },
      });

      if (existingEvent) {
        this.assertVendorEventMatches(existingEvent, input);
        const nextStatus = await this.advanceOrderToTicketIssued(
          tx,
          input.orderId,
        );

        return {
          ...input,
          nextStatus,
          source: 'VENDOR_CALLBACK',
        };
      }

      const issuanceOutcome = await this.resolveIssuanceOutcome(
        tx,
        input.orderId,
      );

      if (issuanceOutcome.status !== ORDER_STATUS.TICKET_ISSUED) {
        throw new BadRequestException(
          `order status ${issuanceOutcome.status} is not eligible for ticket issuance.`,
        );
      }

      await this.createVendorFulfillmentEvent(tx, input);

      return {
        ...input,
        nextStatus: issuanceOutcome.status,
        source: 'VENDOR_CALLBACK',
      };
    });
  }

  async listAdminOperations(): Promise<AdminFulfillmentOperationItem[]> {
    const events = await this.prisma.fulfillmentEvent.findMany({
      include: {
        order: {
          select: {
            id: true,
            items: {
              orderBy: {
                createdAt: 'asc',
              },
              select: {
                ticketTier: {
                  select: {
                    name: true,
                    session: {
                      select: {
                        event: {
                          select: {
                            city: true,
                            id: true,
                            title: true,
                            venueName: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            orderNumber: true,
            status: true,
          },
        },
      },
      orderBy: {
        occurredAt: 'desc',
      },
    });

    return events.map((event: PrismaAdminFulfillmentEvent) => {
      const payload = this.readAdminPayload(event.payload);
      const firstItem = event.order.items[0];

      return {
        event: firstItem?.ticketTier.session.event,
        externalRef: event.externalRef ?? undefined,
        id: event.id,
        occurredAt: event.occurredAt.toISOString(),
        orderId: event.orderId,
        orderNumber: event.order.orderNumber,
        orderStatus: event.order.status,
        source: payload.source,
        status: event.status,
        ticketCode: payload.ticketCode,
        tierName: firstItem?.ticketTier.name,
      };
    });
  }

  private async createVendorFulfillmentEvent(
    tx: Prisma.TransactionClient,
    input: RecordVendorCallbackIssuedInput,
  ): Promise<void> {
    try {
      await tx.fulfillmentEvent.create({
        data: {
          externalRef: input.vendorEventId,
          orderId: input.orderId,
          payload: {
            source: 'VENDOR_CALLBACK',
            ticketCode: input.ticketCode,
            vendorEventId: input.vendorEventId,
          },
          status: 'ISSUED',
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existingEvent = await tx.fulfillmentEvent.findUnique({
          where: {
            externalRef: input.vendorEventId,
          },
          select: {
            orderId: true,
            payload: true,
          },
        });

        if (!existingEvent) {
          throw error;
        }

        this.assertVendorEventMatches(existingEvent, input);
        return;
      }

      throw error;
    }
  }

  private async advanceOrderToTicketIssued(
    tx: Prisma.TransactionClient,
    orderId: string,
  ): Promise<OrderStatus> {
    const order = await tx.order.findUnique({
      where: {
        id: orderId,
      },
      select: {
        status: true,
      },
    });

    if (!order) {
      throw new BadRequestException('Order not found.');
    }

    if (!this.canAdvanceToTicketIssued(order.status)) {
      return order.status;
    }

    const orderUpdateResult = await tx.order.updateMany({
      where: {
        id: orderId,
        status: order.status,
      },
      data: {
        status: ORDER_STATUS.TICKET_ISSUED,
      },
    });

    if (orderUpdateResult.count > 0) {
      return ORDER_STATUS.TICKET_ISSUED;
    }

    const currentOrder = await tx.order.findUnique({
      where: {
        id: orderId,
      },
      select: {
        status: true,
      },
    });

    return currentOrder?.status ?? order.status;
  }

  private async resolveIssuanceOutcome(
    tx: Prisma.TransactionClient,
    orderId: string,
  ): Promise<{ status: OrderStatus; transitioned: boolean }> {
    const order = await tx.order.findUnique({
      where: {
        id: orderId,
      },
      select: {
        status: true,
      },
    });

    if (!order) {
      throw new BadRequestException('Order not found.');
    }

    if (order.status === ORDER_STATUS.TICKET_ISSUED) {
      return {
        status: order.status,
        transitioned: false,
      };
    }

    if (this.canAdvanceToTicketIssued(order.status)) {
      const orderUpdateResult = await tx.order.updateMany({
        where: {
          id: orderId,
          status: order.status,
        },
        data: {
          status: ORDER_STATUS.TICKET_ISSUED,
        },
      });

      if (orderUpdateResult.count > 0) {
        return {
          status: ORDER_STATUS.TICKET_ISSUED,
          transitioned: true,
        };
      }

      const currentOrder = await tx.order.findUnique({
        where: {
          id: orderId,
        },
        select: {
          status: true,
        },
      });

      if (!currentOrder) {
        throw new BadRequestException('Order not found.');
      }

      return {
        status: currentOrder.status,
        transitioned: false,
      };
    }

    throw new BadRequestException(
      `order status ${order.status} is not eligible for ticket issuance.`,
    );
  }

  private canAdvanceToTicketIssued(status: OrderStatus): boolean {
    return (
      status === ORDER_STATUS.PAID_PENDING_FULFILLMENT ||
      status === ORDER_STATUS.SUBMITTED_TO_VENDOR
    );
  }

  private assertVendorEventMatches(
    existingEvent: {
      orderId: string;
      payload: unknown;
    },
    input: RecordVendorCallbackIssuedInput,
  ): void {
    const existingPayload = this.readPayload(existingEvent.payload);

    if (
      existingEvent.orderId !== input.orderId ||
      existingPayload.ticketCode !== input.ticketCode
    ) {
      throw new BadRequestException(
        'vendorEventId is already associated with a different fulfillment event.',
      );
    }
  }

  private readPayload(payload: unknown): FulfillmentPayload {
    if (!payload || typeof payload !== 'object') {
      throw new BadRequestException(
        'vendorEventId is already associated with a different fulfillment event.',
      );
    }

    const typedPayload = payload as Record<string, unknown>;
    const ticketCode = typedPayload.ticketCode;
    const source = typedPayload.source;
    const vendorEventId = typedPayload.vendorEventId;
    const operatorId = typedPayload.operatorId;

    if (typeof ticketCode !== 'string' || typeof source !== 'string') {
      throw new BadRequestException(
        'vendorEventId is already associated with a different fulfillment event.',
      );
    }

    return {
      operatorId: typeof operatorId === 'string' ? operatorId : undefined,
      source: source as FulfillmentEventSource,
      ticketCode,
      vendorEventId:
        typeof vendorEventId === 'string' ? vendorEventId : undefined,
    };
  }

  private readAdminPayload(payload: unknown): {
    source?: FulfillmentEventSource;
    ticketCode?: string;
  } {
    if (!payload || typeof payload !== 'object') {
      return {};
    }

    const typedPayload = payload as Record<string, unknown>;
    const source = typedPayload.source;
    const ticketCode = typedPayload.ticketCode;

    return {
      source: typeof source === 'string' ? (source as FulfillmentEventSource) : undefined,
      ticketCode: typeof ticketCode === 'string' ? ticketCode : undefined,
    };
  }
}
