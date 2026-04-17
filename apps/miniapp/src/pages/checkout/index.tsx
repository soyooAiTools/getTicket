import { Button, Text, View } from '@tarojs/components';
import Taro, { useLoad } from '@tarojs/taro';
import { useState } from 'react';

import type { WechatPaymentIntent } from '../../../../../packages/contracts/src';
import { request } from '../../services/request';
import { startWechatPay } from '../../utils/pay';
import { type CheckoutParams, parseCheckoutParams } from './checkout-state';
import {
  clearStoredDraftOrderId,
  readStoredDraftOrderId,
  resolvePayableOrderId,
  writeStoredDraftOrderId,
} from './payment-session';

const sectionStyle = {
  background: '#ffffff',
  borderRadius: '16px',
  marginBottom: '16px',
  padding: '16px',
};

export default function CheckoutPage() {
  const [checkoutParams, setCheckoutParams] = useState<CheckoutParams | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [payableOrderId, setPayableOrderId] = useState('');

  useLoad((params) => {
    const nextCheckoutParams = parseCheckoutParams(params ?? {});
    setCheckoutParams(nextCheckoutParams);
    setPayableOrderId(
      nextCheckoutParams ? readStoredDraftOrderId(nextCheckoutParams) : '',
    );

    if (!nextCheckoutParams) {
      clearStoredDraftOrderId();
      Taro.showToast({
        icon: 'none',
        title: '请先选择票档和观演人',
      });
    }
  });

  const handlePay = async () => {
    if (!checkoutParams) {
      Taro.showToast({
        icon: 'none',
        title: '缺少有效购票信息',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const createDraftOrder = async () => {
        const draftOrder = await request<{ id: string }>({
          data: {
            quantity: checkoutParams.quantity,
            ticketType: checkoutParams.ticketType,
            tierId: checkoutParams.tierId,
            viewerIds: checkoutParams.viewerIds,
          },
          method: 'POST',
          url: '/orders/draft',
        });

        setPayableOrderId(draftOrder.id);
        writeStoredDraftOrderId(checkoutParams, draftOrder.id);

        return draftOrder.id;
      };
      let orderId = await resolvePayableOrderId({
        createDraftOrder,
        currentOrderId: payableOrderId,
      });
      let paymentIntent: WechatPaymentIntent;

      try {
        paymentIntent = await request<WechatPaymentIntent>({
          data: {
            orderId,
          },
          method: 'POST',
          url: '/payments/wechat/intent',
        });
      } catch (error) {
        if (
          payableOrderId &&
          error instanceof Error &&
          error.message === 'Pending order not found.'
        ) {
          clearStoredDraftOrderId();
          setPayableOrderId('');
          orderId = await createDraftOrder();
          paymentIntent = await request<WechatPaymentIntent>({
            data: {
              orderId,
            },
            method: 'POST',
            url: '/payments/wechat/intent',
          });
        } else {
          throw error;
        }
      }

      await startWechatPay(paymentIntent);

      await Taro.navigateTo({
        url: `/pages/payment-result/index?orderId=${orderId}`,
      });
    } catch (error) {
      Taro.showToast({
        icon: 'none',
        title:
          error instanceof Error && error.message
            ? error.message
            : '支付发起失败',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View
      className='page checkout-page'
      style={{ background: '#f5f5f5', minHeight: '100vh', padding: '16px' }}
    >
      <View style={sectionStyle}>
        <Text style={{ display: 'block', fontSize: '24px', fontWeight: 'bold' }}>
          确认支付
        </Text>
        <Text style={{ color: '#666', display: 'block', marginTop: '8px' }}>
          创建草稿订单后，将拉起微信支付并跳转到支付结果页。
        </Text>
      </View>

      <View style={sectionStyle}>
        <Text style={{ display: 'block', fontSize: '18px', fontWeight: 'bold' }}>
          当前选择
        </Text>
        {checkoutParams ? (
          <>
            <Text style={{ color: '#444', display: 'block', marginTop: '8px' }}>
              场次票档：{checkoutParams.tierId}
            </Text>
            <Text style={{ color: '#444', display: 'block', marginTop: '8px' }}>
              观演人：{checkoutParams.viewerIds.join(', ')}
            </Text>
            <Text style={{ color: '#444', display: 'block', marginTop: '8px' }}>
              数量：{checkoutParams.quantity} · 票种：{checkoutParams.ticketType}
            </Text>
          </>
        ) : (
          <Text style={{ color: '#b45309', display: 'block', marginTop: '8px' }}>
            当前未接收到有效的票档或观演人信息，请返回上一页重新选择。
          </Text>
        )}
      </View>

      <View style={sectionStyle}>
        <Text style={{ display: 'block', fontSize: '18px', fontWeight: 'bold' }}>
          购票须知
        </Text>
        <Text style={{ color: '#444', display: 'block', lineHeight: '24px', marginTop: '12px' }}>
          观演人信息在出票前不可修改。电子票最晚演出前三天确认，纸质票最晚演出前七天确认。
        </Text>
        <Text style={{ color: '#444', display: 'block', lineHeight: '24px', marginTop: '12px' }}>
          临演前三天因用户信息错误导致无法录入的，按 20% 服务费处理。
        </Text>
      </View>

      <Button
        disabled={isSubmitting || !checkoutParams}
        loading={isSubmitting}
        onClick={() => {
          void handlePay();
        }}
      >
        {isSubmitting ? '正在发起支付...' : payableOrderId ? '继续支付' : '立即支付'}
      </Button>
    </View>
  );
}
