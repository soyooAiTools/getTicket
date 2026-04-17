import { Module } from '@nestjs/common';

import { CustomerSessionGuard } from '../../common/auth/customer-session.guard';
import { FulfillmentModule } from '../fulfillment/fulfillment.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './wechat-pay.service';
import { WechatPayGateway } from './wechat-pay.gateway';

@Module({
  imports: [FulfillmentModule],
  controllers: [PaymentsController],
  providers: [CustomerSessionGuard, PaymentsService, WechatPayGateway],
  exports: [PaymentsService],
})
export class PaymentsModule {}
