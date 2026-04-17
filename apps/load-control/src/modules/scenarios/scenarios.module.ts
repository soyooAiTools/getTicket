import { Module } from '@nestjs/common';

import { ScenarioEngineService } from './scenario-engine.service';

@Module({
  providers: [ScenarioEngineService],
  exports: [ScenarioEngineService],
})
export class ScenariosModule {}
