import { Module } from '@nestjs/common';

import { CustomerSessionGuard } from '../../common/auth/customer-session.guard';

import { ViewersController } from './viewers.controller';
import { ViewersService } from './viewers.service';

@Module({
  controllers: [ViewersController],
  providers: [ViewersService, CustomerSessionGuard],
  exports: [ViewersService],
})
export class ViewersModule {}
