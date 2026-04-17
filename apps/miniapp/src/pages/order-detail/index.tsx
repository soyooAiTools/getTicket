import { Button, Text, View } from '@tarojs/components';
import Taro, { useDidShow, useRouter } from '@tarojs/taro';
import { useState } from 'react';

import type { OrderDetail } from '../../../../../packages/contracts/src';
import { request } from '../../services/request';

const sectionStyle = {
  background: '#ffffff',
  borderRadius: '16px',
  marginBottom: '16px',
  padding: '16px',
};

const REFUND_REQUESTABLE_STATUSES = new Set([
  'PAID_PENDING_FULFILLMENT',
  'SUBMITTED_TO_VENDOR',
  'TICKET_ISSUED',
  'TICKET_FAILED',
]);

function getRefundMessage(orderDetail: OrderDetail) {
  if (!orderDetail.refundEntryEnabled) {
    return 'Refund entry is currently closed for this event.';
  }

  if (orderDetail.status === 'REFUND_REVIEWING') {
    return 'Your refund request has been saved and is under review.';
  }

  if (orderDetail.status === 'REFUND_PROCESSING') {
    return 'Your refund request has been submitted upstream and is processing.';
  }

  if (orderDetail.status === 'REFUNDED') {
    return 'This order has already been refunded.';
  }

  if (orderDetail.status === 'TICKET_ISSUED') {
    return 'Refund entry is live for this issued order.';
  }

  if (REFUND_REQUESTABLE_STATUSES.has(orderDetail.status)) {
    return 'Refund entry is live for this order status.';
  }

  return 'Refunds are available once the order reaches an eligible state.';
}

export default function OrderDetailPage() {
  const router = useRouter();
  const [orderDetail, setOrderDetail] = useState<OrderDetail | null>(null);

  useDidShow(() => {
    const orderId = router.params?.id;

    if (!orderId) {
      return;
    }

    void request<OrderDetail>({
      url: `/orders/${orderId}`,
    })
      .then(setOrderDetail)
      .catch(() => {
        Taro.showToast({
          icon: 'none',
          title: 'Failed to load order',
        });
      });
  });

  if (!orderDetail) {
    return (
      <View
        className='page order-detail-page'
        style={{ background: '#f5f5f5', minHeight: '100vh', padding: '16px' }}
      >
        <View style={sectionStyle}>
          <Text style={{ display: 'block', fontSize: '18px', fontWeight: 'bold' }}>
            Loading order
          </Text>
          <Text style={{ color: '#666', display: 'block', marginTop: '8px' }}>
            Order id: {router.params?.id ?? 'unknown'}
          </Text>
        </View>
      </View>
    );
  }

  const canRequestRefund =
    REFUND_REQUESTABLE_STATUSES.has(orderDetail.status) &&
    orderDetail.refundEntryEnabled;

  return (
    <View
      className='page order-detail-page'
      style={{ background: '#f5f5f5', minHeight: '100vh', padding: '16px' }}
    >
      <View style={sectionStyle}>
        <Text style={{ display: 'block', fontSize: '24px', fontWeight: 'bold' }}>
          Order detail
        </Text>
        <Text style={{ color: '#666', display: 'block', marginTop: '8px' }}>
          Order no: {orderDetail.orderNumber}
        </Text>
        <Text style={{ color: '#444', display: 'block', marginTop: '8px' }}>
          Status: {orderDetail.status} / {orderDetail.ticketType}
        </Text>
        <Text style={{ color: '#444', display: 'block', marginTop: '8px' }}>
          Created at: {orderDetail.createdAt}
        </Text>
      </View>

      <View style={sectionStyle}>
        <Text style={{ display: 'block', fontSize: '18px', fontWeight: 'bold' }}>
          Event
        </Text>
        <Text style={{ color: '#444', display: 'block', marginTop: '8px' }}>
          {orderDetail.event.title}
        </Text>
        <Text style={{ color: '#666', display: 'block', marginTop: '8px' }}>
          {orderDetail.event.city} / {orderDetail.event.venueName}
        </Text>
        <Text style={{ color: '#666', display: 'block', marginTop: '8px' }}>
          Sale status: {orderDetail.event.saleStatus}
        </Text>
      </View>

      <View style={sectionStyle}>
        <Text style={{ display: 'block', fontSize: '18px', fontWeight: 'bold' }}>
          Timeline
        </Text>
        <Text style={{ color: '#444', display: 'block', marginTop: '8px' }}>
          {orderDetail.timeline.title}
        </Text>
        <Text style={{ color: '#666', display: 'block', marginTop: '8px' }}>
          {orderDetail.timeline.description}
        </Text>
      </View>

      <View style={sectionStyle}>
        <Text style={{ display: 'block', fontSize: '18px', fontWeight: 'bold' }}>
          Items
        </Text>
        {orderDetail.items.map((item) => (
          <View
            key={item.id}
            style={{
              background: '#f9fafb',
              borderRadius: '12px',
              marginTop: '12px',
              padding: '12px',
            }}
          >
            <Text style={{ display: 'block', fontWeight: 'bold' }}>
              {item.sessionName} / {item.tierName}
            </Text>
            <Text style={{ color: '#666', display: 'block', marginTop: '6px' }}>
              Qty {item.quantity} / Unit {item.unitPrice} / Total {item.totalAmount}
            </Text>
            <Text style={{ color: '#666', display: 'block', marginTop: '6px' }}>
              Viewer: {item.viewer.name} / {item.viewer.mobile}
            </Text>
          </View>
        ))}
      </View>

      <View style={sectionStyle}>
        <Text style={{ display: 'block', fontSize: '18px', fontWeight: 'bold' }}>
          After-sales
        </Text>
        <Text style={{ color: '#444', display: 'block', marginTop: '8px' }}>
          {getRefundMessage(orderDetail)}
        </Text>
        {canRequestRefund ? (
          <Button
            style={{ marginTop: '12px' }}
            onClick={() =>
              Taro.navigateTo({
                url: `/pages/after-sales/index?orderId=${orderDetail.id}`,
              })
            }
          >
            Request refund
          </Button>
        ) : null}
      </View>
    </View>
  );
}
