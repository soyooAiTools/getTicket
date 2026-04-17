import { BadRequestException, Injectable } from '@nestjs/common';
import { createSign, randomBytes } from 'crypto';

import type { WechatPaymentIntent } from '../../../../../packages/contracts/src';

export type CreateJsapiIntentInput = {
  amount: number;
  description: string;
  notifyUrl: string;
  openId: string;
  outTradeNo: string;
};

@Injectable()
export class WechatPayGateway {
  private getSigningConfig() {
    const privateKey = process.env.WECHAT_PRIVATE_KEY_PEM?.trim();
    const serialNo = process.env.WECHAT_MCH_CERT_SERIAL_NO?.trim();

    if (!privateKey || !serialNo) {
      throw new BadRequestException(
        'WeChat payment configuration is incomplete.',
      );
    }

    return {
      privateKey,
      serialNo,
    };
  }

  private signWithMerchantKey(message: string) {
    const { privateKey } = this.getSigningConfig();
    const signer = createSign('RSA-SHA256');
    signer.update(message);
    signer.end();

    return signer.sign(privateKey, 'base64');
  }

  private buildWechatPaySignature(input: {
    appId: string;
    nonceStr: string;
    packageValue: string;
    timeStamp: string;
  }) {
    return this.signWithMerchantKey(
      `${input.appId}\n${input.timeStamp}\n${input.nonceStr}\n${input.packageValue}\n`,
    );
  }

  private buildWechatRequestAuthorization(input: {
    body: string;
    canonicalUrl: string;
    merchantId: string;
    method: 'POST';
  }) {
    const { serialNo } = this.getSigningConfig();
    const nonceStr = randomBytes(16).toString('hex');
    const timeStamp = Math.floor(Date.now() / 1000).toString();
    const message =
      `${input.method}\n${input.canonicalUrl}\n${timeStamp}\n${nonceStr}\n${input.body}\n`;
    const signature = this.signWithMerchantKey(message);

    return `WECHATPAY2-SHA256-RSA2048 mchid="${input.merchantId}",nonce_str="${nonceStr}",timestamp="${timeStamp}",serial_no="${serialNo}",signature="${signature}"`;
  }

  async createJsapiIntent(
    input: CreateJsapiIntentInput,
  ): Promise<WechatPaymentIntent> {
    const appId = process.env.WECHAT_APP_ID?.trim();
    const merchantId = process.env.WECHAT_MCH_ID?.trim();

    if (!appId || !merchantId || !input.notifyUrl.trim()) {
      throw new BadRequestException(
        'WeChat payment configuration is incomplete.',
      );
    }

    const body = JSON.stringify({
      amount: {
        currency: 'CNY',
        total: input.amount,
      },
      appid: appId,
      description: input.description,
      mchid: merchantId,
      notify_url: input.notifyUrl,
      out_trade_no: input.outTradeNo,
      payer: {
        openid: input.openId,
      },
    });

    const response = await fetch(
      'https://api.mch.weixin.qq.com/v3/pay/transactions/jsapi',
      {
        method: 'POST',
        headers: {
          Authorization: this.buildWechatRequestAuthorization({
            body,
            canonicalUrl: '/v3/pay/transactions/jsapi',
            merchantId,
            method: 'POST',
          }),
          'content-type': 'application/json',
        },
        body,
      },
    );

    if (!response.ok) {
      throw new BadRequestException('Failed to create WeChat payment intent.');
    }

    const payload = (await response.json()) as { prepay_id?: string };

    if (!payload.prepay_id?.trim()) {
      throw new BadRequestException('WeChat payment response is missing prepay_id.');
    }

    const nonceStr = randomBytes(16).toString('hex');
    const timeStamp = Math.floor(Date.now() / 1000).toString();
    const packageValue = `prepay_id=${payload.prepay_id.trim()}`;
    const paySign = this.buildWechatPaySignature({
      appId,
      nonceStr,
      packageValue,
      timeStamp,
    });

    return {
      appId,
      nonceStr,
      packageValue,
      paySign,
      signType: 'RSA',
      timeStamp,
    };
  }
}
