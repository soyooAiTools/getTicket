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
}
