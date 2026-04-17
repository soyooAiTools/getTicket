import { Module } from '@nestjs/common';

import { ValidationPolicyService } from './validation-policy.service';

@Module({
  providers: [ValidationPolicyService],
  exports: [ValidationPolicyService],
})
export class ValidationModule {}
