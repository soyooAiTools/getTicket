import { Module } from '@nestjs/common';

import { AdminApiSecretGuard } from '../../common/auth/admin-api-secret.guard';
import { VendorCallbackSecretGuard } from '../../common/auth/vendor-callback-secret.guard';
import { UpstreamTicketingGateway } from '../../common/vendors/upstream-ticketing.gateway';
import { FulfillmentController } from './fulfillment.controller';
import { FulfillmentEventsService } from './fulfillment-events.service';

@Module({
  controllers: [FulfillmentController],
  providers: [
    AdminApiSecretGuard,
    FulfillmentEventsService,
    UpstreamTicketingGateway,
    VendorCallbackSecretGuard,
  ],
  exports: [FulfillmentEventsService],
})
export class FulfillmentModule {}
