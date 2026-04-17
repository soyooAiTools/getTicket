import { BadRequestException, Injectable } from '@nestjs/common';

import type { CalibrationReport, NodeRunSummary } from '@ticketing/contracts';

@Injectable()
export class ScoringService {
  buildCalibrationReport(
    baselineRunId: string,
    baseline: NodeRunSummary[],
    productionRunId: string,
    production: NodeRunSummary[],
  ): CalibrationReport {
    this.assertSummariesPresent(baseline, production);

    const baselineLatency = this.averageLatency(baseline);
    const productionLatency = this.averageLatency(production);
    const productionSuccessRate = this.successRate(production);
    const baselineSkew = this.averageStartupSkew(baseline);
    const productionSkew = this.averageStartupSkew(production);

    const latencyDeltaRatio = this.calculateDeltaRatio(
      baselineLatency,
      productionLatency,
    );
    const skewDeltaRatio = this.calculateDeltaRatio(
      baselineSkew,
      productionSkew,
    );

    return {
      baselineRunId,
      productionRunId,
      realismScore: this.clampScore(100 - Math.round(latencyDeltaRatio * 100)),
      capacityScore: this.clampScore(Math.round(productionSuccessRate * 100)),
      fairnessScore: this.clampScore(100 - Math.round(skewDeltaRatio * 10)),
      controlScore: this.clampScore(100 - Math.round(skewDeltaRatio * 5)),
      recommendedUpdates: [
        {
          field: 'network.averageRttMs',
          previousValue: baseline[0]?.averageRttMs ?? 0,
          recommendedValue: production[0]?.averageRttMs ?? 0,
        },
      ],
    };
  }

  private assertSummariesPresent(
    baseline: NodeRunSummary[],
    production: NodeRunSummary[],
  ) {
    if (baseline.length === 0 || production.length === 0) {
      throw new BadRequestException(
        'Calibration reports require recorded summaries for both runs.',
      );
    }
  }

  private calculateDeltaRatio(
    baselineValue: number,
    productionValue: number,
  ): number {
    if (baselineValue === 0) {
      return productionValue === 0 ? 0 : 1;
    }

    return Math.abs(productionValue - baselineValue) / baselineValue;
  }

  private averageLatency(summaries: NodeRunSummary[]): number {
    const phases = summaries.flatMap((summary) => summary.phaseSummaries);
    const total = phases.reduce(
      (sum, phase) => sum + phase.averageLatencyMs,
      0,
    );

    return phases.length === 0 ? 0 : Math.round(total / phases.length);
  }

  private successRate(summaries: NodeRunSummary[]): number {
    const phases = summaries.flatMap((summary) => summary.phaseSummaries);
    const requestCount = phases.reduce((sum, phase) => sum + phase.requestCount, 0);
    const successCount = phases.reduce((sum, phase) => sum + phase.successCount, 0);

    return requestCount === 0
      ? 0
      : Number((successCount / requestCount).toFixed(2));
  }

  private averageStartupSkew(summaries: NodeRunSummary[]): number {
    if (summaries.length === 0) {
      return 0;
    }

    const total = summaries.reduce((sum, summary) => sum + summary.startupSkewMs, 0);
    return Number((total / summaries.length).toFixed(2));
  }

  private clampScore(score: number): number {
    return Math.max(0, Math.min(100, score));
  }
}
