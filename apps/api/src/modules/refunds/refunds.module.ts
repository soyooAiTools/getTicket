import { Module } from '@nestjs/common';

import { UpstreamTicketingGateway } from '../../common/vendors/upstream-ticketing.gateway';
import { RefundsController } from './refunds.controller';
import { RefundsService } from './refunds.service';

@Module({
  controllers: [RefundsController],
  providers: [RefundsService, UpstreamTicketingGateway],
  exports: [RefundsService],
})
export class RefundsModule {}
