import { Module } from '@nestjs/common';

import { ControlModule } from '../control/control.module';
import { ReportsController } from './reports.controller';
import { ScoringService } from './scoring.service';

@Module({
  imports: [ControlModule],
  controllers: [ReportsController],
  providers: [ScoringService],
})
export class ReportsModule {}
