import { Injectable } from '@nestjs/common';

export type OrderStatusChangedNotificationInput = {
  userId: string;
  orderId: string;
  statusText: string;
};

export type NotificationDelivery = {
  channel: 'WECHAT_SUBSCRIBE_MESSAGE';
  recipientUserId: string;
  templateKey: 'ORDER_STATUS_CHANGED';
  messagePreview: string;
  payload: {
    orderId: string;
    statusText: string;
  };
  sent: boolean;
};

@Injectable()
export class NotificationsService {
  sendOrderStatusChanged(
    input: OrderStatusChangedNotificationInput,
  ): NotificationDelivery {
    return {
      channel: 'WECHAT_SUBSCRIBE_MESSAGE',
      recipientUserId: input.userId,
      templateKey: 'ORDER_STATUS_CHANGED',
      messagePreview: `订单 ${input.orderId} 状态更新：${input.statusText}`,
      payload: {
        orderId: input.orderId,
        statusText: input.statusText,
      },
      sent: true,
    };
  }
}
