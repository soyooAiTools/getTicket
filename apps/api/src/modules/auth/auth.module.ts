import { Module } from '@nestjs/common';

import { AuthController } from './auth.controller';
import { SessionBootstrapService } from './session-bootstrap.service';

@Module({
  controllers: [AuthController],
  providers: [SessionBootstrapService],
  exports: [SessionBootstrapService],
})
export class AuthModule {}
