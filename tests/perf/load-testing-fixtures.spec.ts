import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  loadTestRunDefinitionSchema,
  networkProfileSchema,
  nodeRunSummarySchema,
} from '../../packages/contracts/src';

const fixturePath = (...segments: string[]) =>
  resolve(process.cwd(), 'tests', 'perf', 'fixtures', ...segments);

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

describe('load testing fixtures', () => {
  it('parses the release-window scenario fixture', () => {
    const fixture = readJson<unknown>(fixturePath('release-window-scenario.json'));

    expect(loadTestRunDefinitionSchema.parse(fixture)).toMatchObject({
      id: 'run_preprod_fixture',
      mode: 'PREPROD',
    });
  });

  it('parses the network profile fixture set', () => {
    const fixture = readJson<unknown[]>(
      fixturePath('network-profiles.json'),
    );

    const profiles = fixture.map((item) => networkProfileSchema.parse(item));

    expect(profiles).toHaveLength(3);
    expect(profiles[2]).toMatchObject({
      id: 'eu-edge',
      baseLatencyMs: 165,
      jitterMs: 25,
    });
  });

  it('parses the pre-production summary fixture', () => {
    const fixture = readJson<unknown[]>(fixturePath('preprod-summary.json'));

    const summaries = fixture.map((item) => nodeRunSummarySchema.parse(item));

    expect(summaries).toEqual([
      expect.objectContaining({
        runId: 'run-preprod-1',
        mode: 'PREPROD',
        averageRttMs: 20,
      }),
    ]);
  });

  it('parses the production summary fixture', () => {
    const fixture = readJson<unknown[]>(fixturePath('production-summary.json'));

    const summaries = fixture.map((item) => nodeRunSummarySchema.parse(item));

    expect(summaries).toEqual([
      expect.objectContaining({
        runId: 'run-prod-1',
        mode: 'WHITELIST_FULL_PATH',
        averageRttMs: 24,
      }),
    ]);
  });
});
