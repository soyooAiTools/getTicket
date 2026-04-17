import { BadRequestException, Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';

import { PrismaService } from '../../common/prisma/prisma.service';

type WechatCode2SessionResponse = {
  errmsg?: string;
  errcode?: number;
  openid?: string;
  session_key?: string;
};

@Injectable()
export class WechatAuthService {
  constructor(private readonly prisma: PrismaService) {}

  async loginWithCode(code: string) {
    const requestUrl = new URL('https://api.weixin.qq.com/sns/jscode2session');
    requestUrl.search = new URLSearchParams({
      appid: process.env.WECHAT_APP_ID ?? '',
      grant_type: 'authorization_code',
      js_code: code.trim(),
      secret: process.env.WECHAT_APP_SECRET ?? '',
    }).toString();

    let response: Response;
    try {
      response = await fetch(requestUrl);
    } catch {
      throw new BadRequestException('WeChat login exchange failed.');
    }

    let payload: WechatCode2SessionResponse;
    try {
      payload = (await response.json()) as WechatCode2SessionResponse;
    } catch {
      throw new BadRequestException('WeChat login exchange failed.');
    }

    if (!response.ok || !payload.openid) {
      throw new BadRequestException(
        payload.errmsg ?? 'WeChat login exchange failed.',
      );
    }

    const customer = await this.prisma.customerAccount.upsert({
      where: { wechatOpenId: payload.openid },
      update: {},
      create: { wechatOpenId: payload.openid },
      select: { id: true, wechatOpenId: true },
    });

    const token = randomBytes(24).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.prisma.customerSession.create({
      data: {
        customerId: customer.id,
        expiresAt,
        tokenHash,
      },
    });

    return {
      token,
      customer: {
        id: customer.id,
        openId: customer.wechatOpenId,
      },
      expiresAt: expiresAt.toISOString(),
    };
  }
}
