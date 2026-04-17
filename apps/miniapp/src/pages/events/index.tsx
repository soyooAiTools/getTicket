import { Button, Text, View } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { useState } from 'react';

import type { EventCatalogSummary } from '../../../../../packages/contracts/src';
import { request } from '../../services/request';

const cardStyle = {
  background: '#ffffff',
  borderRadius: '16px',
  marginBottom: '12px',
  padding: '16px',
};

export default function EventsPage() {
  const [events, setEvents] = useState<EventCatalogSummary[]>([]);

  const loadEvents = async () => {
    try {
      const response = await request<{ items?: EventCatalogSummary[] }>({
        url: '/catalog/events',
      });

      setEvents(response.items ?? []);
    } catch {
      Taro.showToast({
        icon: 'none',
        title: '加载演出列表失败',
      });
    }
  };

  useDidShow(() => {
    void loadEvents();
  });

  return (
    <View
      className='page events-page'
      style={{ background: '#f5f5f5', minHeight: '100vh', padding: '16px' }}
    >
      <View className='page__header' style={cardStyle}>
        <Text
          className='page__title'
          style={{ display: 'block', fontSize: '24px', fontWeight: 'bold' }}
        >
          演出列表
        </Text>
        <Text
          className='page__description'
          style={{ color: '#666', display: 'block', marginTop: '8px' }}
        >
          这里展示所有已发布的 beta 演出，支持直接进入详情页浏览票档和场次。
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
            {event.saleStatus} · ¥{event.minPrice} 起
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
    </View>
  );
}
