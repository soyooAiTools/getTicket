import { Module } from '@nestjs/common';

import { ControlController } from './control.controller';
import { ControlService } from './control.service';
import { ScenariosModule } from '../scenarios/scenarios.module';
import { ValidationModule } from '../validation/validation.module';

@Module({
  imports: [ScenariosModule, ValidationModule],
  controllers: [ControlController],
  providers: [ControlService],
  exports: [ControlService],
})
export class ControlModule {}
