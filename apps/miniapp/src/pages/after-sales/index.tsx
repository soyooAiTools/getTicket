import { Button, Input, Text, View } from '@tarojs/components';
import Taro, { useDidShow, useLoad, useRouter } from '@tarojs/taro';
import { useState } from 'react';

import type { OrderDetail } from '../../../../../packages/contracts/src';
import { request } from '../../services/request';

type RefundReasonCode = 'USER_IDENTITY_ERROR' | 'OTHER';

type RefundPreview = {
  refundAmount: number;
  serviceFee: number;
};

const sectionStyle = {
  background: '#ffffff',
  borderRadius: '16px',
  marginBottom: '16px',
  padding: '16px',
};

const reasonButtonStyle = {
  marginRight: '8px',
  marginTop: '12px',
};

function parseDaysBeforeStart(value: string) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return parsed;
}

export default function AfterSalesPage() {
  const router = useRouter();
  const [daysBeforeStartText, setDaysBeforeStartText] = useState('2');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderDetail, setOrderDetail] = useState<OrderDetail | null>(null);
  const [preview, setPreview] = useState<RefundPreview | null>(null);
  const [reasonCode, setReasonCode] =
    useState<RefundReasonCode>('USER_IDENTITY_ERROR');

  const orderId = router.params?.orderId?.trim() ?? '';
  const daysBeforeStart = parseDaysBeforeStart(daysBeforeStartText);

  const refreshPreview = async (
    nextReasonCode: RefundReasonCode,
    nextDaysBeforeStart: number,
    totalAmount?: number,
  ) => {
    if (!totalAmount) {
      setPreview(null);
      return;
    }

    try {
      const result = await request<RefundPreview>({
        data: {
          daysBeforeStart: nextDaysBeforeStart,
          reasonCode: nextReasonCode,
          totalAmount,
        },
        method: 'POST',
        url: '/refunds/calculate',
      });

      setPreview(result);
    } catch {
      setPreview(null);
    }
  };

  useLoad(() => {
    if (!orderId) {
      Taro.showToast({
        icon: 'none',
        title: 'Missing order id',
      });
    }
  });

  useDidShow(() => {
    if (!orderId) {
      return;
    }

    void request<OrderDetail>({
      url: `/orders/${orderId}`,
    })
      .then((result) => {
        setOrderDetail(result);
        return refreshPreview(reasonCode, daysBeforeStart, result.totalAmount);
      })
      .catch(() => {
        Taro.showToast({
          icon: 'none',
          title: 'Failed to load order',
        });
      });
  });

  const handleSubmit = async () => {
    if (!orderId) {
      Taro.showToast({
        icon: 'none',
        title: 'Missing order id',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      await request({
        data: {
          daysBeforeStart,
          orderId,
          reasonCode,
        },
        method: 'POST',
        url: '/refunds/request',
      });

      Taro.showToast({
        icon: 'success',
        title: 'Refund requested',
      });

      setTimeout(() => {
        void Taro.redirectTo({
          url: `/pages/order-detail/index?id=${orderId}`,
        });
      }, 300);
    } catch (error) {
      Taro.showToast({
        icon: 'none',
        title:
          error instanceof Error && error.message
            ? error.message
            : 'Refund request failed',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View
      className='page after-sales-page'
      style={{ background: '#f5f5f5', minHeight: '100vh', padding: '16px' }}
    >
      <View style={sectionStyle}>
        <Text style={{ display: 'block', fontSize: '24px', fontWeight: 'bold' }}>
          Refund Request
        </Text>
        <Text style={{ color: '#666', display: 'block', marginTop: '8px' }}>
          Order: {(orderDetail?.orderNumber ?? orderId) || 'unknown'}
        </Text>
        <Text style={{ color: '#444', display: 'block', marginTop: '8px' }}>
          This page now submits a live refund request instead of placeholder copy.
        </Text>
      </View>

      <View style={sectionStyle}>
        <Text style={{ display: 'block', fontSize: '18px', fontWeight: 'bold' }}>
          Refund reason
        </Text>
        <Button
          size='mini'
          style={reasonButtonStyle}
          type={reasonCode === 'USER_IDENTITY_ERROR' ? 'primary' : 'default'}
          onClick={() => {
            setReasonCode('USER_IDENTITY_ERROR');
            void refreshPreview(
              'USER_IDENTITY_ERROR',
              daysBeforeStart,
              orderDetail?.totalAmount,
            );
          }}
        >
          Identity info error
        </Button>
        <Button
          size='mini'
          style={reasonButtonStyle}
          type={reasonCode === 'OTHER' ? 'primary' : 'default'}
          onClick={() => {
            setReasonCode('OTHER');
            void refreshPreview('OTHER', daysBeforeStart, orderDetail?.totalAmount);
          }}
        >
          Other
        </Button>

        <Text
          style={{
            display: 'block',
            fontSize: '18px',
            fontWeight: 'bold',
            marginTop: '20px',
          }}
        >
          Days before start
        </Text>
        <Input
          type='number'
          value={daysBeforeStartText}
          onInput={(event) => {
            const nextValue = event.detail.value;
            setDaysBeforeStartText(nextValue);
            void refreshPreview(
              reasonCode,
              parseDaysBeforeStart(nextValue),
              orderDetail?.totalAmount,
            );
          }}
          placeholder='Enter remaining days'
          style={{
            background: '#f9fafb',
            borderRadius: '12px',
            marginTop: '12px',
            padding: '12px',
          }}
        />
        <Text style={{ color: '#666', display: 'block', marginTop: '8px' }}>
          For identity-info errors within 3 days before the event, a 20% service
          fee will be deducted.
        </Text>
      </View>

      <View style={sectionStyle}>
        <Text style={{ display: 'block', fontSize: '18px', fontWeight: 'bold' }}>
          Calculation preview
        </Text>
        <Text style={{ color: '#444', display: 'block', marginTop: '8px' }}>
          Original paid amount: {orderDetail?.totalAmount ?? '--'}
        </Text>
        <Text style={{ color: '#444', display: 'block', marginTop: '8px' }}>
          Service fee: {preview?.serviceFee ?? '--'}
        </Text>
        <Text style={{ color: '#444', display: 'block', marginTop: '8px' }}>
          Refund amount: {preview?.refundAmount ?? '--'}
        </Text>
      </View>

      <Button
        disabled={!orderId || isSubmitting}
        loading={isSubmitting}
        onClick={() => {
          void handleSubmit();
        }}
      >
        {isSubmitting ? 'Submitting...' : 'Submit refund request'}
      </Button>
    </View>
  );
}
