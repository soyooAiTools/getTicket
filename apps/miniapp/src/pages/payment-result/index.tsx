import { Button, Text, View } from '@tarojs/components';
import Taro, { useLoad, useUnload } from '@tarojs/taro';
import { useRef, useState } from 'react';

import type { OrderDetail } from '../../../../../packages/contracts/src';
import { request } from '../../services/request';
import { clearStoredDraftOrderId } from '../checkout/payment-session';
import { waitForOrderProcessing } from './polling';
import {
  resolvePaymentResultRedirectUrl,
  schedulePaymentResultRedirect,
} from './redirect';

const cardStyle = {
  background: '#ffffff',
  borderRadius: '16px',
  padding: '20px',
};

export default function PaymentResultPage() {
  const [orderId, setOrderId] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('PENDING_PAYMENT');
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const isDisposedRef = useRef(false);

  useLoad((params) => {
    const nextOrderId = (params?.orderId ?? '').trim();
    setOrderId(nextOrderId);

    if (!nextOrderId) {
      return;
    }

    void waitForOrderProcessing({
      loadOrder: (targetOrderId) =>
        request<OrderDetail>({
          url: `/orders/${targetOrderId}`,
        }),
      maxAttempts: 6,
      orderId: nextOrderId,
    })
      .then((result) => {
        if (isDisposedRef.current) {
          return;
        }

        setPaymentStatus(result.status);

        if (!result.ready) {
          return;
        }

        clearStoredDraftOrderId();
        redirectTimerRef.current = schedulePaymentResultRedirect({
          delayMs: 300,
          navigate: (url) => {
            void Taro.navigateTo({ url });
          },
          orderId: nextOrderId,
        });
      })
      .catch(() => {
        if (isDisposedRef.current) {
          return;
        }

        Taro.showToast({
          icon: 'none',
          title: '支付结果确认中，请稍后查看订单',
        });
      });
  });

  useUnload(() => {
    isDisposedRef.current = true;

    if (redirectTimerRef.current) {
      clearTimeout(redirectTimerRef.current);
    }
  });

  return (
    <View
      className='page payment-result-page'
      style={{ background: '#f5f5f5', minHeight: '100vh', padding: '16px' }}
    >
      <View style={cardStyle}>
        <Text style={{ display: 'block', fontSize: '24px', fontWeight: 'bold' }}>
          支付结果
        </Text>
        <Text
          style={{
            color: '#666',
            display: 'block',
            lineHeight: '24px',
            marginTop: '12px',
          }}
        >
          支付发起后会先进入订单处理链路，这里会先确认后台状态，再跳转到订单详情。
        </Text>

        <Text style={{ color: '#111827', display: 'block', marginTop: '20px' }}>
          订单号：{orderId || '未获取到订单号'}
        </Text>
        <Text style={{ color: '#111827', display: 'block', marginTop: '12px' }}>
          当前状态：{paymentStatus}
        </Text>
      </View>

      <View style={{ marginTop: '16px' }}>
        <Button
          onClick={() =>
            Taro.navigateTo({
              url: resolvePaymentResultRedirectUrl(orderId),
            })
          }
        >
          查看订单详情
        </Button>
      </View>
    </View>
  );
}
