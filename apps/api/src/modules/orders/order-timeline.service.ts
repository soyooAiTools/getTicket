import { Injectable } from '@nestjs/common';

import type { TicketType } from '../checkout/checkout.service';
import type { OrderStatus } from './order-status';

export type OrderTimelineItem = {
  title: string;
  description: string;
};

@Injectable()
export class OrderTimelineService {
  toTimelineItem(
    status: OrderStatus,
    ticketType: TicketType,
  ): OrderTimelineItem {
    if (status === 'PAID_PENDING_FULFILLMENT') {
      return {
        title: '待履约确认',
        description:
          ticketType === 'PAPER_TICKET'
            ? '订单已支付，纸质票最晚将在演出前七天确认寄送与履约安排。'
            : '订单已支付，电子票最晚将在演出前三天确认下发与履约安排。',
      };
    }

    return {
      title: '订单处理中',
      description: '订单状态已记录，平台将继续同步后续处理进度。',
    };
  }
}
