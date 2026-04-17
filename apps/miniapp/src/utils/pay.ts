import Taro from '@tarojs/taro';

import type { WechatPaymentIntent } from '../../../../packages/contracts/src';

export function startWechatPay({
  timeStamp,
  nonceStr,
  packageValue,
  signType,
  paySign,
}: WechatPaymentIntent) {
  return Taro.requestPayment({
    timeStamp,
    nonceStr,
    package: packageValue,
    signType,
    paySign,
  });
}
