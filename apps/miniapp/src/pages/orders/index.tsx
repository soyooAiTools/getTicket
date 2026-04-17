import { Button, Text, View } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { useState } from 'react';

import type { OrderListItem } from '../../../../../packages/contracts/src';
import { request } from '../../services/request';

const cardStyle = {
  background: '#ffffff',
  borderRadius: '16px',
  marginBottom: '12px',
  padding: '16px',
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderListItem[]>([]);

  const loadOrders = async () => {
    try {
      const response = await request<{ items?: OrderListItem[] }>({
        url: '/orders/my',
      });

      setOrders(response.items ?? []);
    } catch {
      Taro.showToast({
        icon: 'none',
        title: '加载订单失败',
      });
    }
  };

  useDidShow(() => {
    void loadOrders();
  });

  return (
    <View
      className='page orders-page'
      style={{ background: '#f5f5f5', minHeight: '100vh', padding: '16px' }}
    >
      <View style={cardStyle}>
        <Text style={{ display: 'block', fontSize: '24px', fontWeight: 'bold' }}>
          订单中心
        </Text>
        <Text style={{ color: '#666', display: 'block', marginTop: '8px' }}>
          这里展示当前客户的真实订单列表、状态线与退款入口。
        </Text>
      </View>

      {orders.length === 0 ? (
        <View style={cardStyle}>
          <Text style={{ color: '#666' }}>当前没有可展示的订单。</Text>
        </View>
      ) : null}

      {orders.map((order) => (
        <View key={order.id} style={cardStyle}>
          <Text style={{ display: 'block', fontSize: '18px', fontWeight: 'bold' }}>
            {order.event.title}
          </Text>
          <Text style={{ color: '#666', display: 'block', marginTop: '8px' }}>
            {order.orderNumber} · {order.status} · {order.ticketType}
          </Text>
          <Text style={{ color: '#444', display: 'block', marginTop: '8px' }}>
            {order.timeline.title}：{order.timeline.description}
          </Text>
          <Text style={{ color: '#444', display: 'block', marginTop: '8px' }}>
            创建时间：{order.createdAt}
          </Text>
          <Text style={{ color: '#444', display: 'block', marginTop: '8px' }}>
            支持退票：{order.refundEntryEnabled ? '是' : '否'}
          </Text>
          <Button
            size='mini'
            style={{ marginTop: '12px' }}
            onClick={() =>
              Taro.navigateTo({
                url: `/pages/order-detail/index?id=${order.id}`,
              })
            }
          >
            查看订单详情
          </Button>
        </View>
      ))}
    </View>
  );
}
