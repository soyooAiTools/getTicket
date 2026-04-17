import { Button, Text, View } from '@tarojs/components';
import Taro, { useLoad } from '@tarojs/taro';
import { useState } from 'react';

import type { EventDetail } from '../../../../../packages/contracts/src';
import { request } from '../../services/request';

const sectionStyle = {
  background: '#ffffff',
  borderRadius: '16px',
  marginBottom: '16px',
  padding: '16px',
};

export default function EventDetailPage() {
  const [eventDetail, setEventDetail] = useState<EventDetail | null>(null);

  useLoad((params) => {
    if (!params?.id) {
      return;
    }

    void request<EventDetail>({
      url: `/catalog/events/${params.id}`,
    })
      .then(setEventDetail)
      .catch(() => {
        Taro.showToast({
          icon: 'none',
          title: '加载演出详情失败',
        });
      });
  });

  if (!eventDetail) {
    return (
      <View
        className='page event-detail-page'
        style={{ background: '#f5f5f5', minHeight: '100vh', padding: '16px' }}
      >
        <View style={sectionStyle}>
          <Text style={{ display: 'block', fontSize: '18px', fontWeight: 'bold' }}>
            正在加载演出详情
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View
      className='page event-detail-page'
      style={{ background: '#f5f5f5', minHeight: '100vh', padding: '16px' }}
    >
      <View className='page__header' style={sectionStyle}>
        <Text
          className='page__title'
          style={{ display: 'block', fontSize: '24px', fontWeight: 'bold' }}
        >
          {eventDetail.title}
        </Text>
        <Text
          className='page__description'
          style={{ color: '#666', display: 'block', marginTop: '8px' }}
        >
          {eventDetail.city} · {eventDetail.venueName}
        </Text>
        <Text style={{ color: '#444', display: 'block', marginTop: '8px' }}>
          售票状态：{eventDetail.saleStatus} · 起价 ¥{eventDetail.minPrice}
        </Text>
      </View>

      {eventDetail.description ? (
        <View style={sectionStyle}>
          <Text style={{ display: 'block', fontSize: '18px', fontWeight: 'bold' }}>
            演出简介
          </Text>
          <Text style={{ color: '#444', display: 'block', marginTop: '8px' }}>
            {eventDetail.description}
          </Text>
        </View>
      ) : null}

      {eventDetail.sessions.map((session) => (
        <View key={session.id} style={sectionStyle}>
          <Text style={{ display: 'block', fontSize: '18px', fontWeight: 'bold' }}>
            {session.name}
          </Text>
          <Text style={{ color: '#666', display: 'block', marginTop: '8px' }}>
            开演时间：{session.startsAt}
          </Text>
          {session.saleStartsAt ? (
            <Text style={{ color: '#666', display: 'block', marginTop: '8px' }}>
              开售时间：{session.saleStartsAt}
            </Text>
          ) : null}
          {session.saleEndsAt ? (
            <Text style={{ color: '#666', display: 'block', marginTop: '8px' }}>
              截止售票：{session.saleEndsAt}
            </Text>
          ) : null}
          <View style={{ marginTop: '12px' }}>
            {session.ticketTiers.map((tier) => (
              <View
                key={tier.id}
                style={{
                  background: '#f9fafb',
                  borderRadius: '12px',
                  marginBottom: '8px',
                  padding: '12px',
                }}
              >
                <Text style={{ display: 'block', fontWeight: 'bold' }}>
                  {tier.name}
                </Text>
                <Text style={{ color: '#666', display: 'block', marginTop: '6px' }}>
                  ¥{tier.price} · 库存 {tier.inventory} · {tier.ticketType}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ))}

      <View style={sectionStyle}>
        <Button
          onClick={() => Taro.navigateTo({ url: '/pages/orders/index' })}
        >
          查看我的订单
        </Button>
      </View>
    </View>
  );
}
