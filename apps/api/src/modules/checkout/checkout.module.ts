import { Module } from '@nestjs/common';

import { CustomerSessionGuard } from '../../common/auth/customer-session.guard';
import { OrdersController } from '../orders/orders.controller';
import { OrderTimelineService } from '../orders/order-timeline.service';
import { OrdersService } from '../orders/orders.service';
import { CheckoutService } from './checkout.service';

@Module({
  controllers: [OrdersController],
  providers: [
    CheckoutService,
    CustomerSessionGuard,
    OrderTimelineService,
    OrdersService,
  ],
  exports: [CheckoutService],
})
export class CheckoutModule {}
