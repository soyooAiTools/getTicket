import { Module } from '@nestjs/common';

import { UpstreamTicketingGateway } from '../../common/vendors/upstream-ticketing.gateway';
import { FulfillmentController } from './fulfillment.controller';
import { FulfillmentEventsService } from './fulfillment-events.service';

@Module({
  controllers: [FulfillmentController],
  providers: [FulfillmentEventsService, UpstreamTicketingGateway],
  exports: [FulfillmentEventsService],
})
export class FulfillmentModule {}
