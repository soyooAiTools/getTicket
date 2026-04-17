import { BadRequestException, Injectable } from '@nestjs/common';

import { type LoadTestRunDefinition } from '@ticketing/contracts';

@Injectable()
export class ValidationPolicyService {
  assertAllowed(run: LoadTestRunDefinition): void {
    const isWriteCapableProductionMode =
      run.mode === 'WHITELIST_FULL_PATH' || run.mode === 'GRAY_VALIDATION';
    const hasWriteConcurrency =
      run.phases.some(
        (phase) =>
          phase.inventoryLockConcurrency > 0 ||
          phase.orderSubmissionConcurrency > 0,
      );

    if (run.mode === 'OBSERVE_ONLY' && hasWriteConcurrency) {
      throw new BadRequestException(
        'OBSERVE_ONLY runs cannot include write concurrency.',
      );
    }

    if (
      isWriteCapableProductionMode &&
      process.env.LOAD_CONTROL_ALLOW_PRODUCTION_WRITE !== 'true'
    ) {
      throw new BadRequestException(
        'Write-capable production validation modes require LOAD_CONTROL_ALLOW_PRODUCTION_WRITE=true.',
      );
    }

    if (isWriteCapableProductionMode && !run.inventoryPoolId) {
      throw new BadRequestException(
        `${run.mode} runs require inventoryPoolId.`,
      );
    }

    if (run.mode !== 'PREPROD' && !run.tags.test_run_id) {
      throw new BadRequestException(
        'Production validation runs require tags.test_run_id.',
      );
    }

    if (run.mode === 'GRAY_VALIDATION' && run.maxGlobalQps > 150) {
      throw new BadRequestException(
        'GRAY_VALIDATION runs must keep maxGlobalQps at or below 150.',
      );
    }
  }
}
