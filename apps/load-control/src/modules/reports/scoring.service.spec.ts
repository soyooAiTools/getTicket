import type { NodeRunSummary } from '@ticketing/contracts';

import { ScoringService } from './scoring.service';

describe('ScoringService', () => {
  it('builds the expected calibration report for the baseline and production samples', () => {
    const service = new ScoringService();

    const baseline: NodeRunSummary[] = [
      {
        runId: 'run-preprod-1',
        nodeId: 'node-hk-1',
        region: 'hk',
        role: 'ANCHOR',
        mode: 'PREPROD',
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
    ];

    const production: NodeRunSummary[] = [
      {
        runId: 'run-prod-1',
        nodeId: 'node-hk-1',
        region: 'hk',
        role: 'ANCHOR',
        mode: 'WHITELIST_FULL_PATH',
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
    ];

    expect(
      service.buildCalibrationReport(
        'run-preprod-1',
        baseline,
        'run-prod-1',
        production,
      ),
    ).toEqual({
      baselineRunId: 'run-preprod-1',
      productionRunId: 'run-prod-1',
      realismScore: 83,
      capacityScore: 92,
      fairnessScore: 95,
      controlScore: 97,
      recommendedUpdates: [
        {
          field: 'network.averageRttMs',
          previousValue: 20,
          recommendedValue: 24,
        },
      ],
    });
  });

  it('rejects report generation when baseline summaries are empty', () => {
    const service = new ScoringService();

    expect(() =>
      service.buildCalibrationReport('run-preprod-1', [], 'run-prod-1', [
        {
          runId: 'run-prod-1',
          nodeId: 'node-hk-1',
          region: 'hk',
          role: 'ANCHOR',
          mode: 'WHITELIST_FULL_PATH',
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
      ]),
    ).toThrow('Calibration reports require recorded summaries for both runs.');
  });

  it('rejects report generation when production summaries are empty', () => {
    const service = new ScoringService();

    expect(() =>
      service.buildCalibrationReport(
        'run-preprod-1',
        [
          {
            runId: 'run-preprod-1',
            nodeId: 'node-hk-1',
            region: 'hk',
            role: 'ANCHOR',
            mode: 'PREPROD',
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
        'run-prod-1',
        [],
      ),
    ).toThrow('Calibration reports require recorded summaries for both runs.');
  });

  it('penalizes worse production values when baseline latency and skew are zero', () => {
    const service = new ScoringService();

    expect(
      service.buildCalibrationReport(
        'run-preprod-zero',
        [
          {
            runId: 'run-preprod-zero',
            nodeId: 'node-hk-1',
            region: 'hk',
            role: 'ANCHOR',
            mode: 'PREPROD',
            averageRttMs: 0,
            startupSkewMs: 0,
            phaseSummaries: [
              {
                phaseId: 'peak',
                requestCount: 100,
                successCount: 100,
                averageLatencyMs: 0,
              },
            ],
          },
        ],
        'run-prod-zero',
        [
          {
            runId: 'run-prod-zero',
            nodeId: 'node-hk-1',
            region: 'hk',
            role: 'ANCHOR',
            mode: 'WHITELIST_FULL_PATH',
            averageRttMs: 10,
            startupSkewMs: 4,
            phaseSummaries: [
              {
                phaseId: 'peak',
                requestCount: 100,
                successCount: 100,
                averageLatencyMs: 25,
              },
            ],
          },
        ],
      ),
    ).toMatchObject({
      realismScore: 0,
      fairnessScore: 90,
      controlScore: 95,
    });
  });
});
