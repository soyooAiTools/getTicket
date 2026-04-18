import { Body, Controller, Get, Param, Post, Sse } from '@nestjs/common';
import {
  nodeTelemetrySampleSchema,
} from '@ticketing/contracts';

import { TelemetryService } from './telemetry.service';

@Controller()
export class TelemetryController {
  constructor(private readonly telemetryService: TelemetryService) {}

  @Post('telemetry')
  ingestTelemetry(@Body() body: unknown) {
    return this.telemetryService.ingestTelemetry(
      nodeTelemetrySampleSchema.parse(body),
    );
  }

  @Get('runs/:runId/live')
  getLiveSnapshot(@Param('runId') runId: string) {
    return this.telemetryService.getLiveSnapshot(runId);
  }

  @Sse('runs/:runId/stream')
  streamRun(@Param('runId') runId: string) {
    return this.telemetryService.streamRun(runId);
  }
}
