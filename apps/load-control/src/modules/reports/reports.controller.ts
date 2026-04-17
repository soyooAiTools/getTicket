import { BadRequestException, Controller, Get, Param } from '@nestjs/common';

import { ControlService } from '../control/control.service';
import { ScoringService } from './scoring.service';

@Controller('reports')
export class ReportsController {
  constructor(
    private readonly controlService: ControlService,
    private readonly scoringService: ScoringService,
  ) {}

  @Get('calibration/:baselineRunId/:productionRunId')
  getCalibrationReport(
    @Param('baselineRunId') baselineRunId: string,
    @Param('productionRunId') productionRunId: string,
  ) {
    const baselineRun = this.controlService.getRun(baselineRunId);
    const productionRun = this.controlService.getRun(productionRunId);

    if (
      baselineRun.status !== 'COMPLETED' ||
      productionRun.status !== 'COMPLETED'
    ) {
      throw new BadRequestException(
        'Calibration reports require completed baseline and production runs.',
      );
    }

    return this.scoringService.buildCalibrationReport(
      baselineRun.definition.id,
      baselineRun.summaries,
      productionRun.definition.id,
      productionRun.summaries,
    );
  }
}
