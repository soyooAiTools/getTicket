import { Button, Text, View } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { useState } from 'react';

import type { OrderListItem } from '../../../../../packages/contracts/src';
import { request } from '../../services/request';

const sectionStyle = {
  background: '#ffffff',
  borderRadius: '16px',
  marginBottom: '16px',
  padding: '16px',
};

export default function MePage() {
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
        title: '加载个人中心失败',
      });
    }
  };

  useDidShow(() => {
    void loadOrders();
  });

  const latestOrder = orders[0];

  return (
    <View
      className='page me-page'
      style={{ background: '#f5f5f5', minHeight: '100vh', padding: '16px' }}
    >
      <View style={sectionStyle}>
        <Text style={{ display: 'block', fontSize: '24px', fontWeight: 'bold' }}>
          个人中心
        </Text>
        <Text style={{ color: '#666', display: 'block', marginTop: '8px' }}>
          汇总订单、观演人、帮助与政策入口。
        </Text>
      </View>

      <View style={sectionStyle}>
        <Text style={{ display: 'block', fontSize: '18px', fontWeight: 'bold' }}>
          订单概览
        </Text>
        <Text style={{ color: '#444', display: 'block', marginTop: '8px' }}>
          当前订单数量：{orders.length}
        </Text>
        {latestOrder ? (
          <Text style={{ color: '#666', display: 'block', marginTop: '8px' }}>
            最近订单：{latestOrder.event.title} · {latestOrder.status}
          </Text>
        ) : (
          <Text style={{ color: '#666', display: 'block', marginTop: '8px' }}>
            还没有同步到订单数据。
          </Text>
        )}
      </View>

      <View style={sectionStyle}>
        <Text style={{ display: 'block', fontSize: '18px', fontWeight: 'bold' }}>
          常用入口
        </Text>
        <Button
          style={{ marginTop: '12px' }}
          onClick={() => Taro.navigateTo({ url: '/pages/viewers/index' })}
        >
          观演人管理
        </Button>
        <Button
          style={{ marginTop: '12px' }}
          onClick={() => Taro.navigateTo({ url: '/pages/orders/index' })}
        >
          我的订单
        </Button>
        <Button
          style={{ marginTop: '12px' }}
          onClick={() => Taro.navigateTo({ url: '/pages/policies/purchase/index' })}
        >
          购票须知
        </Button>
        <Button
          style={{ marginTop: '12px' }}
          onClick={() => Taro.navigateTo({ url: '/pages/policies/privacy/index' })}
        >
          隐私政策
        </Button>
      </View>
    </View>
  );
}
