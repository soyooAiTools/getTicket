import { Module } from '@nestjs/common';

import { AuthController } from './auth.controller';
import { WechatAuthService } from './wechat-auth.service';

@Module({
  controllers: [AuthController],
  providers: [WechatAuthService],
  exports: [WechatAuthService],
})
export class AuthModule {}
