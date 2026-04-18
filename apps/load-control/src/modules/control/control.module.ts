import { Module } from '@nestjs/common';

import { ControlController } from './control.controller';
import { ControlRepository } from './control.repository';
import { ControlService } from './control.service';
import { ScenariosModule } from '../scenarios/scenarios.module';
import { ValidationModule } from '../validation/validation.module';

@Module({
  imports: [ScenariosModule, ValidationModule],
  controllers: [ControlController],
  providers: [ControlRepository, ControlService],
  exports: [ControlService],
})
export class ControlModule {}
