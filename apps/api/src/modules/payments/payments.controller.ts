import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { createDecipheriv, createVerify } from 'crypto';

import {
  CurrentCustomer,
  type CurrentCustomerPrincipal,
} from '../../common/auth/current-customer.decorator';
import { CustomerSessionGuard } from '../../common/auth/customer-session.guard';

import { PaymentsService } from './wechat-pay.service';

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isValidAmount(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

type CreateWechatIntentBody = {
  orderId: string;
};

function assertCreateWechatIntentBody(
  body: unknown,
): asserts body is CreateWechatIntentBody {
  if (body === null || typeof body !== 'object') {
    throw new BadRequestException('orderId is required.');
  }

  const candidate = body as Record<string, unknown>;

  if (!isNonEmptyString(candidate.orderId)) {
    throw new BadRequestException('orderId is required.');
  }
}

type WechatCallbackResource = {
  associated_data?: string;
  ciphertext: string;
  nonce: string;
};

type RawBodyRequest = {
  headers: Record<string, string | string[] | undefined>;
  rawBody?: Buffer;
};

type WechatCallbackTransaction = {
  appid?: string;
  amount?: {
    total?: number;
  };
  mchid?: string;
  out_trade_no?: string;
  trade_state?: string;
  transaction_id?: string;
};

function decryptWechatCallbackResource(
  resource: WechatCallbackResource,
): WechatCallbackTransaction {
  try {
    const apiV3Key = process.env.WECHAT_API_V3_KEY?.trim();

    if (!apiV3Key || apiV3Key.length !== 32) {
      throw new BadRequestException('WeChat callback configuration is incomplete.');
    }

    const encryptedBuffer = Buffer.from(resource.ciphertext, 'base64');

    if (encryptedBuffer.length <= 16) {
      throw new BadRequestException('Invalid WeChat payment callback payload');
    }

    const authTag = encryptedBuffer.subarray(encryptedBuffer.length - 16);
    const ciphertext = encryptedBuffer.subarray(0, encryptedBuffer.length - 16);
    const decipher = createDecipheriv(
      'aes-256-gcm',
      Buffer.from(apiV3Key, 'utf8'),
      Buffer.from(resource.nonce, 'utf8'),
    );

    if (resource.associated_data) {
      decipher.setAAD(Buffer.from(resource.associated_data, 'utf8'));
    }

    decipher.setAuthTag(authTag);

    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString('utf8');

    return JSON.parse(plaintext) as WechatCallbackTransaction;
  } catch (error) {
    if (error instanceof BadRequestException) {
      throw error;
    }

    throw new BadRequestException('Invalid WeChat payment callback payload');
  }
}

function getHeaderValue(
  headers: Record<string, string | string[] | undefined>,
  name: string,
) {
  const value = headers[name.toLowerCase()] ?? headers[name];

  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function verifyWechatCallbackSignature(request: RawBodyRequest) {
  const publicKey = process.env.WECHAT_PLATFORM_PUBLIC_KEY_PEM?.trim();
  const expectedSerial = process.env.WECHAT_PLATFORM_CERT_SERIAL_NO?.trim();
  const serial = getHeaderValue(request.headers, 'wechatpay-serial');
  const signature = getHeaderValue(request.headers, 'wechatpay-signature');
  const timestamp = getHeaderValue(request.headers, 'wechatpay-timestamp');
  const nonce = getHeaderValue(request.headers, 'wechatpay-nonce');
  const rawBody = request.rawBody?.toString('utf8');

  if (!publicKey || !expectedSerial) {
    throw new BadRequestException('WeChat callback configuration is incomplete.');
  }

  if (
    !rawBody ||
    !isNonEmptyString(serial) ||
    !isNonEmptyString(signature) ||
    !isNonEmptyString(timestamp) ||
    !isNonEmptyString(nonce)
  ) {
    throw new BadRequestException('Invalid WeChat payment callback signature');
  }

  if (serial.trim() !== expectedSerial) {
    throw new BadRequestException('Invalid WeChat payment callback signature');
  }

  const verifier = createVerify('RSA-SHA256');
  verifier.update(`${timestamp.trim()}\n${nonce.trim()}\n${rawBody}\n`);
  verifier.end();

  if (!verifier.verify(publicKey, signature.trim(), 'base64')) {
    throw new BadRequestException('Invalid WeChat payment callback signature');
  }
}

function normalizeWechatCallbackPayload(body: unknown) {
  if (!isObjectRecord(body)) {
    throw new BadRequestException('Invalid WeChat payment callback payload');
  }

  const eventType = body.event_type;
  const resource = body.resource;

  if (eventType !== 'TRANSACTION.SUCCESS' || !isObjectRecord(resource)) {
    throw new BadRequestException('Invalid WeChat payment callback payload');
  }

  if (!isNonEmptyString(resource.ciphertext) || !isNonEmptyString(resource.nonce)) {
    throw new BadRequestException('Invalid WeChat payment callback payload');
  }

  const transaction = decryptWechatCallbackResource({
    associated_data: isNonEmptyString(resource.associated_data)
      ? resource.associated_data
      : undefined,
    ciphertext: resource.ciphertext,
    nonce: resource.nonce,
  });
  const expectedAppId = process.env.WECHAT_APP_ID?.trim();
  const expectedMerchantId = process.env.WECHAT_MCH_ID?.trim();

  if (!expectedAppId || !expectedMerchantId) {
    throw new BadRequestException('WeChat callback configuration is incomplete.');
  }

  if (
    transaction.appid?.trim() !== expectedAppId ||
    transaction.mchid?.trim() !== expectedMerchantId ||
    transaction.trade_state !== 'SUCCESS' ||
    !isNonEmptyString(transaction.out_trade_no) ||
    !isNonEmptyString(transaction.transaction_id) ||
    !isValidAmount(transaction.amount?.total)
  ) {
    throw new BadRequestException('Invalid WeChat payment callback payload');
  }

  return {
    amount: transaction.amount.total,
    outTradeNo: transaction.out_trade_no.trim(),
    providerTxnId: transaction.transaction_id.trim(),
  };
}

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @UseGuards(CustomerSessionGuard)
  @Post('wechat/intent')
  createWechatIntent(
    @Body() body: unknown,
    @CurrentCustomer() customer: CurrentCustomerPrincipal,
  ) {
    assertCreateWechatIntentBody(body);

    return this.paymentsService.createWechatIntent({
      customerId: customer.id,
      openId: customer.openId,
      orderId: body.orderId.trim(),
    });
  }

  @HttpCode(200)
  @Post('wechat/callback')
  async handleWechatCallback(
    @Req() request: RawBodyRequest,
    @Body() body: unknown,
  ) {
    verifyWechatCallbackSignature(request);

    await this.paymentsService.buildPaidTransitionFromOutTradeNo(
      normalizeWechatCallbackPayload(body),
    );

    return {
      code: 'SUCCESS',
      message: 'OK',
    };
  }
}
