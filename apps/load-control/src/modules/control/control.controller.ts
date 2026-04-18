import { Body, Controller, Get, Param, Post } from '@nestjs/common';

import {
  controlRunDraftSchema,
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

  @Get('node-pools')
  listNodePools() {
    return this.controlService.listNodePools();
  }

  @Get('templates')
  listTemplates() {
    return this.controlService.listTemplates();
  }

  @Post('runs')
  createRun(@Body() body: unknown) {
    return this.controlService.createRun(controlRunDraftSchema.parse(body));
  }

  @Get('runs')
  listRuns() {
    return this.controlService.listRuns();
  }

  @Get('runs/:runId')
  getRun(@Param('runId') runId: string) {
    return this.controlService.getRun(runId);
  }

  @Post('runs/:runId/plan')
  planRun(@Param('runId') runId: string) {
    return this.controlService.planRun(runId);
  }

  @Post('runs/:runId/start')
  startRun(@Param('runId') runId: string) {
    return this.controlService.startRun(runId);
  }

  @Post('runs/:runId/stop')
  stopRun(@Param('runId') runId: string) {
    return this.controlService.stopRun(runId);
  }

  @Post('runs/:runId/results')
  recordSummary(@Param('runId') runId: string, @Body() body: unknown) {
    return this.controlService.recordSummary(
      runId,
      nodeRunSummarySchema.parse(body),
    );
  }
}
