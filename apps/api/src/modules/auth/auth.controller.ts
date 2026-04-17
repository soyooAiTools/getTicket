import { BadRequestException, Body, Controller, Post } from '@nestjs/common';

import { WechatAuthService } from './wechat-auth.service';

type ExchangeCodeBody = {
  code: string;
};

@Controller('auth')
export class AuthController {
  constructor(private readonly wechatAuthService: WechatAuthService) {}

  @Post('wechat/login')
  login(@Body() body: ExchangeCodeBody) {
    if (!body || typeof body.code !== 'string' || body.code.trim().length === 0) {
      throw new BadRequestException('code is required.');
    }

    return this.wechatAuthService.loginWithCode(body.code.trim());
  }
}
