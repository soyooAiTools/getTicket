import { Module } from '@nestjs/common';

import { AdminApiSecretGuard } from '../../common/auth/admin-api-secret.guard';
import { CustomerSessionGuard } from '../../common/auth/customer-session.guard';
import { VendorCallbackSecretGuard } from '../../common/auth/vendor-callback-secret.guard';
import { UpstreamTicketingGateway } from '../../common/vendors/upstream-ticketing.gateway';
import { RefundsController } from './refunds.controller';
import { RefundsService } from './refunds.service';

@Module({
  controllers: [RefundsController],
  providers: [
    AdminApiSecretGuard,
    CustomerSessionGuard,
    RefundsService,
    UpstreamTicketingGateway,
    VendorCallbackSecretGuard,
  ],
  exports: [RefundsService],
})
export class RefundsModule {}
