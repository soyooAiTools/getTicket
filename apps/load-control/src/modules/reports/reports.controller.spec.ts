import { ReportsController } from './reports.controller';

describe('ReportsController', () => {
  it('builds a calibration report after awaiting completed runs', async () => {
    const baselineRun = {
      definition: {
        id: 'run-baseline',
      },
      status: 'COMPLETED' as const,
      assignments: [],
      summaries: [
        {
          runId: 'run-baseline',
          nodeId: 'node-01',
          region: 'hk',
          role: 'ANCHOR' as const,
          mode: 'PREPROD' as const,
          averageRttMs: 20,
          startupSkewMs: 2,
          phaseSummaries: [
            {
              phaseId: 'peak',
              requestCount: 100,
              successCount: 96,
              averageLatencyMs: 180,
            },
          ],
        },
      ],
    };

    const productionRun = {
      definition: {
        id: 'run-production',
      },
      status: 'COMPLETED' as const,
      assignments: [],
      summaries: [
        {
          runId: 'run-production',
          nodeId: 'node-01',
          region: 'hk',
          role: 'ANCHOR' as const,
          mode: 'WHITELIST_FULL_PATH' as const,
          averageRttMs: 24,
          startupSkewMs: 3,
          phaseSummaries: [
            {
              phaseId: 'peak',
              requestCount: 100,
              successCount: 92,
              averageLatencyMs: 210,
            },
          ],
        },
      ],
    };

    const controlService = {
      getRun: jest
        .fn()
        .mockResolvedValueOnce(baselineRun)
        .mockResolvedValueOnce(productionRun),
    };
    const scoringService = {
      buildCalibrationReport: jest.fn().mockReturnValue({
        baselineRunId: 'run-baseline',
        productionRunId: 'run-production',
        realismScore: 83,
        capacityScore: 92,
        fairnessScore: 95,
        controlScore: 97,
        recommendedUpdates: [],
      }),
    };

    const controller = new ReportsController(
      controlService as never,
      scoringService as never,
    );

    await expect(
      controller.getCalibrationReport('run-baseline', 'run-production'),
    ).resolves.toEqual({
      baselineRunId: 'run-baseline',
      productionRunId: 'run-production',
      realismScore: 83,
      capacityScore: 92,
      fairnessScore: 95,
      controlScore: 97,
      recommendedUpdates: [],
    });

    expect(controlService.getRun).toHaveBeenCalledWith('run-baseline');
    expect(controlService.getRun).toHaveBeenCalledWith('run-production');
    expect(scoringService.buildCalibrationReport).toHaveBeenCalledWith(
      'run-baseline',
      baselineRun.summaries,
      'run-production',
      productionRun.summaries,
    );
  });
});
