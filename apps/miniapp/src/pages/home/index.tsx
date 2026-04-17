import { Button, Text, View } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { useState } from 'react';

import type { EventCatalogSummary } from '../../../../../packages/contracts/src';
import { request } from '../../services/request';

const cardStyle = {
  background: '#ffffff',
  borderRadius: '16px',
  marginBottom: '16px',
  padding: '16px',
};

export default function HomePage() {
  const [events, setEvents] = useState<EventCatalogSummary[]>([]);

  const loadEvents = async () => {
    try {
      const response = await request<{ items?: EventCatalogSummary[] }>({
        url: '/catalog/events',
      });

      setEvents((response.items ?? []).slice(0, 3));
    } catch {
      Taro.showToast({
        icon: 'none',
        title: '加载演出失败',
      });
    }
  };

  useDidShow(() => {
    void loadEvents();
  });

  return (
    <View
      className='page home-page'
      style={{ background: '#f5f5f5', minHeight: '100vh', padding: '16px' }}
    >
      <View className='page__header' style={cardStyle}>
        <Text
          className='page__title'
          style={{ display: 'block', fontSize: '24px', fontWeight: 'bold' }}
        >
          近期演唱会情报
        </Text>
        <Text
          className='page__description'
          style={{ color: '#666', display: 'block', marginTop: '8px' }}
        >
          浏览最新开票、售票中的演出项目，直接进入详情和下单入口。
        </Text>
      </View>

      <View style={cardStyle}>
        <Text style={{ display: 'block', fontSize: '18px', fontWeight: 'bold' }}>
          热门演出
        </Text>
        <Text style={{ color: '#666', display: 'block', marginTop: '8px' }}>
          当前展示最近同步的 3 条演出信息。
        </Text>
      </View>

      {events.map((event) => (
        <View key={event.id} style={cardStyle}>
          <Text style={{ display: 'block', fontSize: '18px', fontWeight: 'bold' }}>
            {event.title}
          </Text>
          <Text style={{ color: '#666', display: 'block', marginTop: '8px' }}>
            {event.city} · {event.venueName}
          </Text>
          <Text style={{ color: '#444', display: 'block', marginTop: '8px' }}>
            售票状态：{event.saleStatus} · 起价 ¥{event.minPrice}
          </Text>
          <Button
            size='mini'
            style={{ marginTop: '12px' }}
            onClick={() =>
              Taro.navigateTo({
                url: `/pages/event-detail/index?id=${event.id}`,
              })
            }
          >
            查看详情
          </Button>
        </View>
      ))}

      <View style={cardStyle}>
        <Text style={{ display: 'block', fontSize: '18px', fontWeight: 'bold' }}>
          快捷入口
        </Text>
        <Button
          style={{ marginTop: '12px' }}
          onClick={() => Taro.navigateTo({ url: '/pages/events/index' })}
        >
          查看全部演出
        </Button>
        <Button
          style={{ marginTop: '12px' }}
          onClick={() => Taro.navigateTo({ url: '/pages/orders/index' })}
        >
          我的订单
        </Button>
        <Button
          style={{ marginTop: '12px' }}
          onClick={() => Taro.navigateTo({ url: '/pages/me/index' })}
        >
          个人中心
        </Button>
      </View>
    </View>
  );
}
