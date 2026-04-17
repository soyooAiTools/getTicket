import { Body, Controller, Get, Param, Post } from '@nestjs/common';

import {
  loadTestRunDefinitionSchema,
  nodeRegistrationSchema,
  nodeRunSummarySchema,
} from '@ticketing/contracts';

import { ControlService } from './control.service';

@Controller()
export class ControlController {
  constructor(private readonly controlService: ControlService) {}

  @Post('nodes/register')
  registerNode(@Body() body: unknown) {
    return this.controlService.registerNode(nodeRegistrationSchema.parse(body));
  }

  @Get('nodes')
  listNodes() {
    return this.controlService.listNodes();
  }

  @Post('runs')
  createRun(@Body() body: unknown) {
    return this.controlService.createRun(loadTestRunDefinitionSchema.parse(body));
  }

  @Get('runs/:runId')
  getRun(@Param('runId') runId: string) {
    return this.controlService.getRun(runId);
  }

  @Post('runs/:runId/plan')
  planRun(@Param('runId') runId: string) {
    return this.controlService.planRun(runId);
  }

  @Post('runs/:runId/results')
  recordSummary(@Param('runId') runId: string, @Body() body: unknown) {
    return this.controlService.recordSummary(
      runId,
      nodeRunSummarySchema.parse(body),
    );
  }
}
