import { Module } from '@nestjs/common';

import { CustomerSessionGuard } from '../../common/auth/customer-session.guard';
import { FulfillmentModule } from '../fulfillment/fulfillment.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [FulfillmentModule],
  controllers: [PaymentsController],
  providers: [CustomerSessionGuard, PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
