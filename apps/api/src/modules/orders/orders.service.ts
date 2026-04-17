import { Injectable, NotFoundException } from '@nestjs/common';

import type {
  OrderDetail,
  OrderDetailItem,
  OrderListItem,
  OrderTimelineItem,
} from '../../../../../packages/contracts/src';
import { PrismaService } from '../../common/prisma/prisma.service';

import { OrderTimelineService } from './order-timeline.service';

type PrismaOrderEvent = {
  city: string;
  coverImageUrl: string | null;
  id: string;
  minPrice: number;
  refundEntryEnabled: boolean;
  saleStatus: OrderListItem['event']['saleStatus'];
  title: string;
  venueName: string;
};

type PrismaOrderListItem = {
  ticketTier: {
    session: {
      id: string;
      name: string;
      event: PrismaOrderEvent;
    };
    name: string;
  };
};

type PrismaOrderDetailItem = PrismaOrderListItem & {
  id: string;
  quantity: number;
  totalAmount: number;
  unitPrice: number;
  viewer: {
    id: string;
    mobile: string;
    name: string;
  };
};

type PrismaCustomerOrder = {
  createdAt: Date;
  currency: string;
  id: string;
  items: PrismaOrderListItem[];
  orderNumber: string;
  status: OrderListItem['status'];
  ticketType: OrderListItem['ticketType'];
  totalAmount: number;
};

type PrismaCustomerOrderDetail = Omit<PrismaCustomerOrder, 'items'> & {
  items: PrismaOrderDetailItem[];
};

type AdminOrderEventSummary = {
  city: string;
  id: string;
  title: string;
  venueName: string;
};

type PrismaAdminOrderItem = {
  quantity: number;
  ticketTier: {
    name: string;
    session: {
      name: string;
      event: AdminOrderEventSummary;
    };
  };
};

type PrismaAdminOrder = {
  createdAt: Date;
  currency: string;
  id: string;
  items: PrismaAdminOrderItem[];
  orderNumber: string;
  payments: Array<{
    paidAt: Date | null;
    providerTxnId: string | null;
    status: string;
  }>;
  refundRequests: Array<{
    refundNo: string;
    status: string;
  }>;
  status: OrderListItem['status'];
  ticketType: OrderListItem['ticketType'];
  totalAmount: number;
  userId: string;
};

export type AdminOrderListItem = {
  createdAt: string;
  currency: string;
  event?: AdminOrderEventSummary;
  id: string;
  itemCount: number;
  latestPayment?: {
    paidAt?: string;
    providerTxnId?: string;
    status: string;
  };
  latestRefundRequest?: {
    refundNo: string;
    status: string;
  };
  orderNumber: string;
  sessionName?: string;
  status: OrderListItem['status'];
  ticketType: OrderListItem['ticketType'];
  totalAmount: number;
  userId: string;
};

function normalizeEvent(event: PrismaOrderEvent): OrderListItem['event'] {
  const summary = {
    city: event.city,
    id: event.id,
    minPrice: event.minPrice,
    saleStatus: event.saleStatus,
    title: event.title,
    venueName: event.venueName,
  };

  return event.coverImageUrl
    ? { ...summary, coverImageUrl: event.coverImageUrl }
    : summary;
}

function normalizeOrderDetailItem(item: PrismaOrderDetailItem): OrderDetailItem {
  return {
    id: item.id,
    quantity: item.quantity,
    sessionId: item.ticketTier.session.id,
    sessionName: item.ticketTier.session.name,
    tierName: item.ticketTier.name,
    totalAmount: item.totalAmount,
    unitPrice: item.unitPrice,
    viewer: {
      id: item.viewer.id,
      mobile: item.viewer.mobile,
      name: item.viewer.name,
    },
  };
}

function normalizeOptionalDate(value: Date | null | undefined) {
  if (!value) {
    return undefined;
  }

  return value.toISOString();
}

function normalizeAdminEventSummary(
  event: AdminOrderEventSummary | undefined,
): AdminOrderEventSummary | undefined {
  if (!event) {
    return undefined;
  }

  return {
    city: event.city,
    id: event.id,
    title: event.title,
    venueName: event.venueName,
  };
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orderTimelineService: OrderTimelineService,
  ) {}

  async listCustomerOrders(customerId: string): Promise<OrderListItem[]> {
    const orders = await this.prisma.order.findMany({
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
      orderBy: {
        createdAt: 'desc',
      },
      where: {
        userId: customerId,
      },
    });

    return orders.map((order: PrismaCustomerOrder) => {
      const event = order.items[0]?.ticketTier.session.event;

      if (!event) {
        throw new NotFoundException('Order not found.');
      }

      return {
        createdAt: order.createdAt.toISOString(),
        currency: order.currency,
        event: normalizeEvent(event),
        id: order.id,
        orderNumber: order.orderNumber,
        refundEntryEnabled: event.refundEntryEnabled,
        status: order.status,
        ticketType: order.ticketType,
        timeline: this.orderTimelineService.toTimelineItem(
          order.status,
          order.ticketType,
        ),
        totalAmount: order.totalAmount,
      };
    });
  }

  async getCustomerOrderDetail(
    customerId: string,
    orderId: string,
  ): Promise<OrderDetail> {
    const order = await this.prisma.order.findFirst({
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
            viewer: {
              select: {
                id: true,
                mobile: true,
                name: true,
              },
            },
          },
        },
      },
      where: {
        id: orderId,
        userId: customerId,
      },
    });

    if (!order || order.items.length === 0) {
      throw new NotFoundException('Order not found.');
    }

    const firstEvent = order.items[0].ticketTier.session.event;

    return {
      createdAt: order.createdAt.toISOString(),
      currency: order.currency,
      event: normalizeEvent(firstEvent),
      id: order.id,
      items: order.items.map(normalizeOrderDetailItem),
      orderNumber: order.orderNumber,
      refundEntryEnabled: firstEvent.refundEntryEnabled,
      status: order.status,
      ticketType: order.ticketType,
      timeline: this.orderTimelineService.toTimelineItem(
        order.status,
        order.ticketType,
      ),
      totalAmount: order.totalAmount,
    };
  }

  async listAdminOrders(): Promise<AdminOrderListItem[]> {
    const orders = await this.prisma.order.findMany({
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
        payments: {
          orderBy: {
            createdAt: 'desc',
          },
          select: {
            paidAt: true,
            providerTxnId: true,
            status: true,
          },
        },
        refundRequests: {
          orderBy: {
            requestedAt: 'desc',
          },
          select: {
            refundNo: true,
            status: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return orders.map((order: PrismaAdminOrder) => {
      const firstItem = order.items[0];
      const latestPayment = order.payments[0];
      const latestRefundRequest = order.refundRequests[0];

      return {
        createdAt: order.createdAt.toISOString(),
        currency: order.currency,
        event: normalizeAdminEventSummary(firstItem?.ticketTier.session.event),
        id: order.id,
        itemCount: order.items.reduce(
          (count, item) => count + item.quantity,
          0,
        ),
        latestPayment: latestPayment
          ? {
              paidAt: normalizeOptionalDate(latestPayment.paidAt),
              providerTxnId: latestPayment.providerTxnId ?? undefined,
              status: latestPayment.status,
            }
          : undefined,
        latestRefundRequest: latestRefundRequest
          ? {
              refundNo: latestRefundRequest.refundNo,
              status: latestRefundRequest.status,
            }
          : undefined,
        orderNumber: order.orderNumber,
        sessionName: firstItem?.ticketTier.session.name,
        status: order.status,
        ticketType: order.ticketType,
        totalAmount: order.totalAmount,
        userId: order.userId,
      };
    });
  }
}
