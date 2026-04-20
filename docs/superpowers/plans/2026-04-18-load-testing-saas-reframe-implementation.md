# Load Testing SaaS Reframe Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the current monorepo into an internal load-testing SaaS with a real-time control console, a persistent control plane, cloud protocol agents, and `apps/api` preserved as the embedded sample system-under-test.

**Architecture:** Extend the shared load-testing contracts first, then move `apps/load-control` from in-memory orchestration to Postgres-backed run state plus Redis-backed live snapshots, and finally repurpose `apps/admin` into the operator console that drives orchestration and live observation over typed APIs and SSE. Keep `apps/miniapp` untouched and out of the primary execution path.

**Tech Stack:** TypeScript, Zod, NestJS, Prisma, Redis, React 18, Ant Design, Vitest, Jest, Supertest, pnpm workspace

---

## Scope Check

This spec touches the console, control plane, agents, and shared contracts, but they are not independent subsystems. The console depends on new runtime DTOs and live endpoints, and the live endpoints depend on the persistence layer and agent telemetry loop. Keep this as one sequenced implementation plan so each slice lands on top of the previous one without duplicated scaffolding.

## File Structure

### Create

- `tests/perf/fixtures/live-run-snapshot.json`
  Canonical fixture for the console-facing active run snapshot contract.
- `apps/load-control/prisma/schema.prisma`
  Persistent models for node pools, templates, runs, assignments, telemetry samples, and summaries.
- `apps/load-control/src/common/prisma/prisma.module.ts`
  Global Prisma module for the control plane.
- `apps/load-control/src/common/prisma/prisma.service.ts`
  Shared Prisma client lifecycle wrapper, matching the existing `apps/api` pattern.
- `apps/load-control/src/common/redis/redis.module.ts`
  Global Redis module for live snapshot cache access.
- `apps/load-control/src/common/redis/redis.service.ts`
  Small Redis wrapper for JSON set/get.
- `apps/load-control/src/modules/control/control.repository.ts`
  Prisma-backed persistence adapter for runs, node pools, templates, nodes, telemetry snapshots, and summaries.
- `apps/load-control/src/modules/control/default-control-catalog.ts`
  Seed data for version 1 node pools and scenario templates.
- `apps/load-control/src/modules/telemetry/telemetry.module.ts`
  Realtime telemetry module boundary.
- `apps/load-control/src/modules/telemetry/telemetry.controller.ts`
  Telemetry ingest, live snapshot read, and SSE stream endpoints.
- `apps/load-control/src/modules/telemetry/telemetry.service.ts`
  Aggregates live node samples into run-level snapshots and writes them to Redis.
- `apps/admin/src/layouts/control-shell.tsx`
  Shared load-testing console layout and navigation.
- `apps/admin/src/services/load-control.ts`
  Typed HTTP client for control-plane endpoints.
- `apps/admin/src/hooks/use-run-stream.ts`
  SSE hook for run-detail live updates.
- `apps/admin/src/pages/overview/index.tsx`
  Overview dashboard with active run cards and live health summaries.
- `apps/admin/src/pages/runs/index.tsx`
  Run list and run-creation surface with template and node-pool selection.
- `apps/admin/src/pages/run-detail/index.tsx`
  Run-centric live operations page with phase timeline and live metrics.
- `apps/admin/src/pages/nodes/index.tsx`
  Node-pool inventory and node health page.
- `apps/admin/src/pages/reports/index.tsx`
  Calibration comparison page.
- `docs/superpowers/guides/2026-04-18-load-testing-saas-operator-guide.md`
  Operator-facing guide for local boot, control-plane env, and console usage.

### Modify

- `packages/contracts/src/load-testing.ts`
  Extend contracts with control-console DTOs, live telemetry payloads, and orchestration records.
- `packages/contracts/src/index.ts`
  Re-export the new contract types and schemas.
- `packages/contracts/src/contracts.spec.ts`
  Add contract tests for the new load-testing SaaS payloads.
- `tests/perf/load-testing-fixtures.spec.ts`
  Validate the new live snapshot fixture.
- `.env.example`
  Add `LOAD_CONTROL_DATABASE_URL` and `VITE_LOAD_CONTROL_BASE_URL`.
- `apps/load-control/package.json`
  Add Prisma scripts plus Redis dependency.
- `apps/load-control/src/app.module.ts`
  Wire Prisma, Redis, Control, Telemetry, Reports, Health, Scenarios, and Validation modules together.
- `apps/load-control/src/main.ts`
  Enable CORS for the admin console and keep the `control` global prefix.
- `apps/load-control/src/modules/control/control.controller.ts`
  Expand orchestration endpoints to list runs, node pools, templates, and start/stop actions.
- `apps/load-control/src/modules/control/control.module.ts`
  Register repository and telemetry dependencies.
- `apps/load-control/src/modules/control/control.service.ts`
  Move run lifecycle to persisted storage and seed the default control catalog.
- `apps/load-control/src/modules/reports/reports.controller.ts`
  Read runs through the repository-backed control service without relying on in-memory state.
- `apps/load-control/src/agent/http-control.client.ts`
  Add telemetry post, list snapshot, and start/stop aware fetch helpers.
- `apps/load-control/src/agent/agent-runner.ts`
  Emit periodic telemetry samples while preserving final summary output.
- `apps/load-control/src/agent/main.ts`
  Register node, wait for `RUNNING`, post telemetry during execution, and stop cleanly.
- `apps/admin/package.json`
  Add Vitest browser testing dependencies for the console.
- `apps/admin/src/router.tsx`
  Replace ticketing-admin routes with the approved load-testing SaaS routes.
- `package.json`
  Add `admin` tests to the root verification chain.
- `tests/workspace/repo-layout.spec.ts`
  Assert the new load-control persistence scripts and admin test wiring.

## Preconditions

- Work on a dedicated feature branch or worktree.
- Do not delete `apps/miniapp`; leave it untouched while the product center moves to `admin + load-control`.
- Reuse the existing `apps/api` Prisma and Nest patterns instead of inventing a second code style.
- Keep version 1 auth and approval flows out of scope. This slice is internal-only and focuses on orchestration, live observation, and persistence.

### Task 1: Extend Shared Contracts And Add Persistent Storage Foundations

**Files:**
- Create: `tests/perf/fixtures/live-run-snapshot.json`
- Create: `apps/load-control/prisma/schema.prisma`
- Create: `apps/load-control/src/common/prisma/prisma.module.ts`
- Create: `apps/load-control/src/common/prisma/prisma.service.ts`
- Create: `apps/load-control/src/common/redis/redis.module.ts`
- Create: `apps/load-control/src/common/redis/redis.service.ts`
- Create: `apps/load-control/src/modules/control/control.repository.ts`
- Modify: `packages/contracts/src/load-testing.ts`
- Modify: `packages/contracts/src/index.ts`
- Modify: `packages/contracts/src/contracts.spec.ts`
- Modify: `tests/perf/load-testing-fixtures.spec.ts`
- Modify: `.env.example`
- Modify: `apps/load-control/package.json`
- Modify: `apps/load-control/src/app.module.ts`
- Modify: `apps/load-control/src/modules/control/control.module.ts`
- Modify: `apps/load-control/src/modules/control/control.service.ts`
- Modify: `tests/workspace/repo-layout.spec.ts`

- [ ] **Step 1: Write the failing contract and workspace tests**

Update `packages/contracts/src/contracts.spec.ts` and `tests/perf/load-testing-fixtures.spec.ts` so the new control-surface DTOs are required:

```ts
import {
  controlRunDraftSchema,
  controlRunRecordSchema,
  liveRunSnapshotSchema,
  nodePoolSchema,
  scenarioTemplateSchema,
} from './index';

it('validates a scenario template payload', () => {
  expect(
    scenarioTemplateSchema.parse({
      id: 'concert-release',
      name: 'Concert release',
      description: 'Five-phase release window profile',
      definition: {
        mode: 'PREPROD',
        targetBaseUrl: 'https://preprod.example.com',
        maxGlobalQps: 2400,
        maxNodeConcurrency: 180,
        tags: { template: 'concert-release' },
        requestTemplates: {
          query: { method: 'GET', path: '/api/catalog/events', timeoutMs: 1500 },
          queue: { method: 'GET', path: '/api/queue/status', timeoutMs: 1500 },
          inventoryLock: { method: 'POST', path: '/api/checkout/draft-orders', timeoutMs: 2500 },
          orderSubmit: { method: 'POST', path: '/api/orders/submit', timeoutMs: 2500 },
        },
        phases: [
          {
            id: 'peak',
            startsAtOffsetMs: 0,
            durationMs: 15000,
            queryConcurrency: 300,
            queuePollingConcurrency: 120,
            inventoryLockConcurrency: 80,
            orderSubmissionConcurrency: 50,
          },
        ],
      },
    }),
  ).toMatchObject({ id: 'concert-release' });
});

it('parses the live run snapshot fixture', () => {
  const fixture = readJson<unknown>(fixturePath('live-run-snapshot.json'));

  expect(liveRunSnapshotSchema.parse(fixture)).toMatchObject({
    runId: 'run-live-fixture',
    status: 'RUNNING',
    currentPhaseId: 'peak',
  });
});
```

Update `tests/workspace/repo-layout.spec.ts` so the workspace now requires the persistence schema and scripts:

```ts
expect(existsSync('apps/load-control/prisma/schema.prisma')).toBe(true);

expect(readJson<{ scripts: Record<string, string> }>('apps/load-control/package.json').scripts).toEqual({
  dev: 'nest start --watch',
  'dev:agent': 'ts-node src/agent/main.ts',
  test: 'jest',
  'test:e2e': 'jest --config test/jest-e2e.json',
  'prisma:generate': 'prisma generate --schema prisma/schema.prisma',
  'prisma:migrate': 'prisma migrate dev --schema prisma/schema.prisma',
  lint: 'eslint src test --ext .ts',
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `corepack pnpm --filter @ticketing/contracts test`
Expected: FAIL with missing exports such as `scenarioTemplateSchema` or `liveRunSnapshotSchema`.

Run: `corepack pnpm exec vitest run tests/workspace/repo-layout.spec.ts tests/perf/load-testing-fixtures.spec.ts`
Expected: FAIL because `apps/load-control/prisma/schema.prisma` and `tests/perf/fixtures/live-run-snapshot.json` do not exist yet.

- [ ] **Step 3: Implement the contracts, fixture, Prisma schema, and repository foundation**

Update `packages/contracts/src/load-testing.ts` with the new control-surface types:

```ts
export const runStatusSchema = z.enum([
  'DRAFT',
  'PLANNED',
  'RUNNING',
  'STOPPING',
  'STOPPED',
  'COMPLETED',
  'FAILED',
]);

export const nodeHealthStatusSchema = z.enum([
  'ONLINE',
  'DEGRADED',
  'OFFLINE',
  'BUSY',
]);

export const scenarioTemplateSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    description: z.string().min(1),
    definition: loadTestRunDefinitionSchema.omit({ id: true }),
  })
  .strict();

export const nodePoolSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    region: z.string().min(1),
    role: nodeRoleSchema,
    maxNodes: z.number().int().positive(),
    nodeIds: z.array(z.string().min(1)),
  })
  .strict();

export const controlRunDraftSchema = z
  .object({
    id: z.string().min(1),
    templateId: z.string().min(1),
    nodePoolId: z.string().min(1),
    definition: loadTestRunDefinitionSchema,
  })
  .strict();

export const controlRunRecordSchema = z
  .object({
    id: z.string().min(1),
    templateId: z.string().min(1),
    nodePoolId: z.string().min(1),
    mode: validationModeSchema,
    targetBaseUrl: z.string().url(),
    status: runStatusSchema,
    tags: z.record(z.string(), z.string()),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();

export const nodeTelemetrySampleSchema = z
  .object({
    runId: z.string().min(1),
    nodeId: z.string().min(1),
    phaseId: z.string().min(1).nullable(),
    status: nodeHealthStatusSchema,
    qps: z.number().nonnegative(),
    errorRate: z.number().min(0).max(1),
    p95LatencyMs: z.number().nonnegative(),
    activeWorkers: z.number().int().nonnegative(),
    recordedAt: z.string().datetime(),
  })
  .strict();

export const liveRunSnapshotSchema = z
  .object({
    runId: z.string().min(1),
    status: runStatusSchema,
    currentPhaseId: z.string().min(1).nullable(),
    aggregateQps: z.number().nonnegative(),
    aggregateErrorRate: z.number().min(0).max(1),
    aggregateP95LatencyMs: z.number().nonnegative(),
    activeNodeCount: z.number().int().nonnegative(),
    unhealthyNodeCount: z.number().int().nonnegative(),
    nodes: z.array(
      z.object({
        nodeId: z.string().min(1),
        region: z.string().min(1),
        role: nodeRoleSchema,
        status: nodeHealthStatusSchema,
        phaseId: z.string().min(1).nullable(),
        qps: z.number().nonnegative(),
        errorRate: z.number().min(0).max(1),
        p95LatencyMs: z.number().nonnegative(),
        activeWorkers: z.number().int().nonnegative(),
        recordedAt: z.string().datetime(),
      }),
    ),
    alerts: z.array(
      z.object({
        id: z.string().min(1),
        severity: z.enum(['INFO', 'WARN', 'CRITICAL']),
        message: z.string().min(1),
        recordedAt: z.string().datetime(),
      }),
    ),
    updatedAt: z.string().datetime(),
  })
  .strict();
```

Create `apps/load-control/prisma/schema.prisma` with `NodePool`, `ScenarioTemplate`, `LoadControlNode`, `LoadControlRun`, `LoadControlAssignment`, `LoadControlSummary`, and `LoadControlTelemetrySample` models. Use `LOAD_CONTROL_DATABASE_URL` as the datasource.

Create `apps/load-control/src/common/prisma/prisma.service.ts` and `prisma.module.ts` by mirroring the existing `apps/api` implementation.

Create `apps/load-control/src/common/redis/redis.service.ts`:

```ts
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');

  async onModuleInit() {
    await this.client.ping();
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  async getJson<T>(key: string): Promise<T | null> {
    const value = await this.client.get(key);
    return value ? (JSON.parse(value) as T) : null;
  }

  async setJson(key: string, value: unknown, ttlSeconds: number) {
    await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  }
}
```

Create `apps/load-control/src/modules/control/control.repository.ts` with `createRunDraft`, `listRuns`, `upsertNode`, `listNodePools`, `listTemplates`, `saveTelemetrySample`, `listRecentTelemetry`, `getRun`, and `updateRunStatus`.

Update `.env.example`:

```dotenv
LOAD_CONTROL_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ticketing?schema=load_control
VITE_LOAD_CONTROL_BASE_URL=http://localhost:3001/control
```

Update `apps/load-control/package.json`:

```json
{
  "scripts": {
    "dev": "nest start --watch",
    "dev:agent": "ts-node src/agent/main.ts",
    "test": "jest",
    "test:e2e": "jest --config test/jest-e2e.json",
    "prisma:generate": "prisma generate --schema prisma/schema.prisma",
    "prisma:migrate": "prisma migrate dev --schema prisma/schema.prisma",
    "lint": "eslint src test --ext .ts"
  },
  "dependencies": {
    "ioredis": "^5.6.1"
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `corepack pnpm --filter @ticketing/contracts test`
Expected: PASS with the new contract suite.

Run: `corepack pnpm exec vitest run tests/workspace/repo-layout.spec.ts tests/perf/load-testing-fixtures.spec.ts`
Expected: PASS with the new fixture and persistence checks.

Run: `corepack pnpm --filter load-control prisma:generate`
Expected: PASS with a generated Prisma client for `apps/load-control/prisma/schema.prisma`.

- [ ] **Step 5: Commit**

```bash
git add packages/contracts/src/load-testing.ts packages/contracts/src/index.ts packages/contracts/src/contracts.spec.ts tests/perf/load-testing-fixtures.spec.ts tests/perf/fixtures/live-run-snapshot.json .env.example apps/load-control/package.json apps/load-control/prisma/schema.prisma apps/load-control/src/common/prisma/prisma.module.ts apps/load-control/src/common/prisma/prisma.service.ts apps/load-control/src/common/redis/redis.module.ts apps/load-control/src/common/redis/redis.service.ts apps/load-control/src/modules/control/control.repository.ts apps/load-control/src/app.module.ts apps/load-control/src/modules/control/control.module.ts apps/load-control/src/modules/control/control.service.ts tests/workspace/repo-layout.spec.ts
git commit -m "feat: add load-testing SaaS contracts and persistence foundations"
```

### Task 2: Add Control-Plane Runtime APIs For Orchestration And Live Telemetry

**Files:**
- Create: `apps/load-control/src/modules/control/default-control-catalog.ts`
- Create: `apps/load-control/src/modules/telemetry/telemetry.module.ts`
- Create: `apps/load-control/src/modules/telemetry/telemetry.controller.ts`
- Create: `apps/load-control/src/modules/telemetry/telemetry.service.ts`
- Modify: `apps/load-control/src/main.ts`
- Modify: `apps/load-control/src/app.module.ts`
- Modify: `apps/load-control/src/modules/control/control.controller.ts`
- Modify: `apps/load-control/src/modules/control/control.module.ts`
- Modify: `apps/load-control/src/modules/control/control.service.ts`
- Modify: `apps/load-control/src/modules/reports/reports.controller.ts`
- Modify: `apps/load-control/test/control.e2e-spec.ts`
- Modify: `apps/load-control/test/reports.e2e-spec.ts`
- Create: `apps/load-control/test/telemetry.e2e-spec.ts`

- [ ] **Step 1: Write the failing lifecycle and telemetry tests**

Update `apps/load-control/test/control.e2e-spec.ts` so the runtime API surface is required:

```ts
it('lists seeded node pools and templates', async () => {
  await request(app.getHttpServer())
    .get('/control/node-pools')
    .expect(200)
    .expect(({ body }) => {
      expect(body[0]).toMatchObject({ id: 'hk-core', region: 'hk' });
    });

  await request(app.getHttpServer())
    .get('/control/templates')
    .expect(200)
    .expect(({ body }) => {
      expect(body[0]).toMatchObject({ id: 'concert-release' });
    });
});

it('starts and stops a planned run', async () => {
  await request(app.getHttpServer())
    .post('/control/runs/run-01/start')
    .expect(201)
    .expect(({ body }) => {
      expect(body.status).toBe('RUNNING');
    });

  await request(app.getHttpServer())
    .post('/control/runs/run-01/stop')
    .expect(201)
    .expect(({ body }) => {
      expect(body.status).toBe('STOPPING');
    });
});
```

Create `apps/load-control/test/telemetry.e2e-spec.ts`:

```ts
it('accepts telemetry and exposes a live snapshot', async () => {
  await request(app.getHttpServer())
    .post('/control/telemetry')
    .send({
      runId: 'run-live-01',
      nodeId: 'node-hk-1',
      phaseId: 'peak',
      status: 'ONLINE',
      qps: 820,
      errorRate: 0.01,
      p95LatencyMs: 410,
      activeWorkers: 96,
      recordedAt: '2026-04-18T09:30:00.000Z',
    })
    .expect(201);

  await request(app.getHttpServer())
    .get('/control/runs/run-live-01/live')
    .expect(200)
    .expect(({ body }) => {
      expect(body).toMatchObject({
        runId: 'run-live-01',
        status: 'RUNNING',
        currentPhaseId: 'peak',
      });
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `corepack pnpm --filter load-control test:e2e`
Expected: FAIL with `404` for `/control/node-pools`, `/control/templates`, `/control/telemetry`, or `/control/runs/:runId/live`.

- [ ] **Step 3: Implement seeded catalogs, runtime endpoints, and live snapshot aggregation**

Create `apps/load-control/src/modules/control/default-control-catalog.ts`:

```ts
import type { NodePool, ScenarioTemplate } from '@ticketing/contracts';

export const defaultNodePools: NodePool[] = [
  {
    id: 'hk-core',
    name: 'Hong Kong core pool',
    region: 'hk',
    role: 'ANCHOR',
    maxNodes: 4,
    nodeIds: [],
  },
  {
    id: 'sg-edge',
    name: 'Singapore edge pool',
    region: 'sg',
    role: 'EDGE',
    maxNodes: 3,
    nodeIds: [],
  },
];

export const defaultScenarioTemplates: ScenarioTemplate[] = [
  {
    id: 'concert-release',
    name: 'Concert release',
    description: 'Five-phase release window profile',
    definition: {
      mode: 'PREPROD',
      targetBaseUrl: 'https://preprod.example.com',
      maxGlobalQps: 2400,
      maxNodeConcurrency: 180,
      tags: { template: 'concert-release' },
      requestTemplates: {
        query: { method: 'GET', path: '/api/catalog/events', timeoutMs: 1500 },
        queue: { method: 'GET', path: '/api/queue/status', timeoutMs: 1500 },
        inventoryLock: { method: 'POST', path: '/api/checkout/draft-orders', timeoutMs: 2500 },
        orderSubmit: { method: 'POST', path: '/api/orders/submit', timeoutMs: 2500 },
      },
      phases: [
        {
          id: 'warmup',
          startsAtOffsetMs: 0,
          durationMs: 1500000,
          queryConcurrency: 30,
          queuePollingConcurrency: 0,
          inventoryLockConcurrency: 0,
          orderSubmissionConcurrency: 0,
        },
      ],
    },
  },
];
```

Create `apps/load-control/src/modules/telemetry/telemetry.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import type { LiveRunSnapshot, NodeTelemetrySample } from '@ticketing/contracts';

import { RedisService } from '../../common/redis/redis.service';
import { ControlRepository } from '../control/control.repository';

@Injectable()
export class TelemetryService {
  constructor(
    private readonly repository: ControlRepository,
    private readonly redis: RedisService,
  ) {}

  async recordSample(sample: NodeTelemetrySample): Promise<LiveRunSnapshot> {
    await this.repository.saveTelemetrySample(sample);
    const run = await this.repository.getRun(sample.runId);
    const nodes = await this.repository.listRunNodes(sample.runId);
    const recentSamples = await this.repository.listRecentTelemetry(sample.runId);

    const snapshot: LiveRunSnapshot = {
      runId: sample.runId,
      status: run.status,
      currentPhaseId: sample.phaseId,
      aggregateQps: Number(
        recentSamples.reduce((sum, item) => sum + item.qps, 0).toFixed(2),
      ),
      aggregateErrorRate:
        recentSamples.length === 0
          ? 0
          : Number(
              (
                recentSamples.reduce((sum, item) => sum + item.errorRate, 0) /
                recentSamples.length
              ).toFixed(4),
            ),
      aggregateP95LatencyMs:
        recentSamples.length === 0
          ? 0
          : Math.max(...recentSamples.map((item) => item.p95LatencyMs)),
      activeNodeCount: recentSamples.length,
      unhealthyNodeCount: recentSamples.filter((item) => item.status !== 'ONLINE')
        .length,
      nodes: recentSamples.map((item) => ({
        nodeId: item.nodeId,
        region: nodes.find((node) => node.id === item.nodeId)?.region ?? 'unknown',
        role: nodes.find((node) => node.id === item.nodeId)?.role ?? 'EDGE',
        status: item.status,
        phaseId: item.phaseId,
        qps: item.qps,
        errorRate: item.errorRate,
        p95LatencyMs: item.p95LatencyMs,
        activeWorkers: item.activeWorkers,
        recordedAt: item.recordedAt,
      })),
      alerts: recentSamples
        .filter((item) => item.status !== 'ONLINE' || item.p95LatencyMs >= 800)
        .map((item) => ({
          id: `${item.nodeId}:${item.recordedAt}`,
          severity: item.status === 'ONLINE' ? 'WARN' : 'CRITICAL',
          message:
            item.status === 'ONLINE'
              ? `${item.nodeId} latency exceeded 800ms`
              : `${item.nodeId} reported ${item.status}`,
          recordedAt: item.recordedAt,
        })),
      updatedAt: sample.recordedAt,
    };

    await this.redis.setJson(`load-control:run:${sample.runId}:live`, snapshot, 60);
    return snapshot;
  }

  async getLiveSnapshot(runId: string) {
    return this.redis.getJson<LiveRunSnapshot>(`load-control:run:${runId}:live`);
  }
}
```

Create `apps/load-control/src/modules/telemetry/telemetry.controller.ts`:

```ts
import { Body, Controller, Get, Param, Post, Sse } from '@nestjs/common';
import { interval, map, switchMap } from 'rxjs';

import { nodeTelemetrySampleSchema } from '@ticketing/contracts';
import { TelemetryService } from './telemetry.service';

@Controller()
export class TelemetryController {
  constructor(private readonly telemetryService: TelemetryService) {}

  @Post('telemetry')
  recordTelemetry(@Body() body: unknown) {
    return this.telemetryService.recordSample(nodeTelemetrySampleSchema.parse(body));
  }

  @Get('runs/:runId/live')
  getLiveSnapshot(@Param('runId') runId: string) {
    return this.telemetryService.getLiveSnapshot(runId);
  }

  @Sse('runs/:runId/stream')
  streamRun(@Param('runId') runId: string) {
    return interval(1000).pipe(
      switchMap(() => this.telemetryService.getLiveSnapshot(runId)),
      map((snapshot) => ({
        data: snapshot,
        type: 'run-snapshot',
      })),
    );
  }
}
```

Update `apps/load-control/src/modules/control/control.controller.ts`:

```ts
@Get('node-pools')
listNodePools() {
  return this.controlService.listNodePools();
}

@Get('templates')
listTemplates() {
  return this.controlService.listTemplates();
}

@Get('runs')
listRuns() {
  return this.controlService.listRuns();
}

@Post('runs/:runId/start')
startRun(@Param('runId') runId: string) {
  return this.controlService.startRun(runId);
}

@Post('runs/:runId/stop')
stopRun(@Param('runId') runId: string) {
  return this.controlService.stopRun(runId);
}
```

Update `apps/load-control/src/modules/control/control.service.ts` so it seeds the default catalog on startup and persists `startRun()` / `stopRun()` status transitions through the repository. Update `apps/load-control/src/main.ts` to `enableCors()` for the admin app and keep the `control` prefix.

- [ ] **Step 4: Run tests to verify they pass**

Run: `corepack pnpm --filter load-control test:e2e`
Expected: PASS with seeded catalogs, telemetry ingest, and live snapshot endpoints working.

- [ ] **Step 5: Commit**

```bash
git add apps/load-control/src/main.ts apps/load-control/src/modules/control/default-control-catalog.ts apps/load-control/src/modules/control/control.controller.ts apps/load-control/src/modules/control/control.service.ts apps/load-control/src/modules/reports/reports.controller.ts apps/load-control/src/modules/telemetry/telemetry.module.ts apps/load-control/src/modules/telemetry/telemetry.controller.ts apps/load-control/src/modules/telemetry/telemetry.service.ts apps/load-control/test/control.e2e-spec.ts apps/load-control/test/reports.e2e-spec.ts apps/load-control/test/telemetry.e2e-spec.ts
git commit -m "feat: add control-plane runtime APIs and live telemetry"
```

### Task 3: Upgrade The Cloud Agent Runtime To Emit Live Telemetry

**Files:**
- Modify: `apps/load-control/src/agent/http-control.client.ts`
- Modify: `apps/load-control/src/agent/agent-runner.ts`
- Modify: `apps/load-control/src/agent/agent-runner.spec.ts`
- Modify: `apps/load-control/src/agent/main.ts`
- Modify: `apps/load-control/src/agent/main.spec.ts`

- [ ] **Step 1: Write the failing agent telemetry tests**

Update `apps/load-control/src/agent/agent-runner.spec.ts`:

```ts
it('emits telemetry while a phase is running', async () => {
  const assignment = {
    runId: 'run-live-01',
    nodeId: 'node-hk-1',
    region: 'hk',
    role: 'ANCHOR',
    mode: 'PREPROD',
    targetBaseUrl: 'https://preprod.example.com',
    networkProfile: {
      id: 'hk-anchor',
      label: 'Hong Kong anchor',
      baseLatencyMs: 18,
      jitterMs: 4,
      packetLossRatio: 0.002,
    },
    requestTemplates: {
      query: { method: 'GET', path: '/api/catalog/events', timeoutMs: 1500 },
      queue: { method: 'GET', path: '/api/queue/status', timeoutMs: 1500 },
      inventoryLock: { method: 'POST', path: '/api/checkout/draft-orders', timeoutMs: 2500 },
      orderSubmit: { method: 'POST', path: '/api/orders/submit', timeoutMs: 2500 },
    },
    phases: [
      {
        id: 'peak',
        startsAtOffsetMs: 0,
        durationMs: 15000,
        queryConcurrency: 2,
        queuePollingConcurrency: 1,
        inventoryLockConcurrency: 1,
        orderSubmissionConcurrency: 1,
      },
    ],
    tags: { test_run_id: 'run-live-01' },
  } as const;
  const telemetryEvents: Array<{ phaseId: string | null; qps: number }> = [];
  const runner = new AgentRunner({
    async execute({ simulatedLatencyMs }) {
      return { ok: true, durationMs: simulatedLatencyMs };
    },
  });

  await runner.runAssignment(assignment, {
    onTelemetry(sample) {
      telemetryEvents.push({ phaseId: sample.phaseId, qps: sample.qps });
    },
    shouldStop() {
      return false;
    },
  });

  expect(telemetryEvents).toEqual(
    expect.arrayContaining([expect.objectContaining({ phaseId: 'peak' })]),
  );
});
```

Update `apps/load-control/src/agent/main.spec.ts`:

```ts
it('registers, waits for RUNNING, streams telemetry, and submits a final summary', async () => {
  const assignment = {
    runId: 'run-live-01',
    nodeId: 'node-hk-1',
    region: 'hk',
    role: 'ANCHOR',
    mode: 'PREPROD',
    targetBaseUrl: 'https://preprod.example.com',
    networkProfile: {
      id: 'hk-anchor',
      label: 'Hong Kong anchor',
      baseLatencyMs: 18,
      jitterMs: 4,
      packetLossRatio: 0.002,
    },
    requestTemplates: {
      query: { method: 'GET', path: '/api/catalog/events', timeoutMs: 1500 },
      queue: { method: 'GET', path: '/api/queue/status', timeoutMs: 1500 },
      inventoryLock: { method: 'POST', path: '/api/checkout/draft-orders', timeoutMs: 2500 },
      orderSubmit: { method: 'POST', path: '/api/orders/submit', timeoutMs: 2500 },
    },
    phases: [
      {
        id: 'peak',
        startsAtOffsetMs: 0,
        durationMs: 15000,
        queryConcurrency: 2,
        queuePollingConcurrency: 1,
        inventoryLockConcurrency: 1,
        orderSubmissionConcurrency: 1,
      },
    ],
    tags: { test_run_id: 'run-live-01' },
  } as const;
  const registeredNode = {
    id: 'node-hk-1',
    poolId: 'hk-core',
    region: 'hk',
    role: 'ANCHOR',
    networkProfile: {
      id: 'hk-anchor',
      label: 'Hong Kong anchor',
      baseLatencyMs: 18,
      jitterMs: 4,
      packetLossRatio: 0.002,
    },
    maxConcurrency: 180,
  } as const;
  const client = {
    registerNode: jest.fn(),
    getRun: jest
      .fn()
      .mockResolvedValueOnce({ status: 'PLANNED', assignments: [assignment] })
      .mockResolvedValueOnce({ status: 'RUNNING', assignments: [assignment] }),
    postTelemetry: jest.fn(),
    submitSummary: jest.fn(),
  };

  await bootstrapAgent({
    controlClient: client as never,
    nodeRegistration: registeredNode,
    runId: 'run-live-01',
  });

  expect(client.registerNode).toHaveBeenCalled();
  expect(client.postTelemetry).toHaveBeenCalled();
  expect(client.submitSummary).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `corepack pnpm --filter load-control test -- src/agent/agent-runner.spec.ts src/agent/main.spec.ts --runInBand`
Expected: FAIL because `runAssignment` does not accept telemetry callbacks and the client has no `postTelemetry`.

- [ ] **Step 3: Implement telemetry-aware agent execution**

Update `apps/load-control/src/agent/http-control.client.ts`:

```ts
import type {
  NodeRegistration,
  NodeRunSummary,
  NodeTelemetrySample,
  PlannedNodeAssignment,
} from '@ticketing/contracts';

type StoredRunSnapshot = {
  status: 'PLANNED' | 'RUNNING' | 'STOPPING' | 'COMPLETED';
  assignments: PlannedNodeAssignment[];
};

export class HttpControlClient {
  constructor(private readonly baseUrl: string) {}

  async registerNode(node: NodeRegistration & { poolId: string }) {
    const response = await fetch(`${this.baseUrl}/nodes/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(node),
    });

    return (await response.json()) as NodeRegistration;
  }

  async getRun(runId: string): Promise<StoredRunSnapshot> {
    const response = await fetch(`${this.baseUrl}/runs/${runId}`);
    return (await response.json()) as StoredRunSnapshot;
  }

  async postTelemetry(sample: NodeTelemetrySample) {
    await fetch(`${this.baseUrl}/telemetry`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(sample),
    });
  }

  async submitSummary(runId: string, summary: NodeRunSummary) {
    await fetch(`${this.baseUrl}/runs/${runId}/results`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(summary),
    });
  }
}
```

Update `apps/load-control/src/agent/agent-runner.ts` so `runAssignment()` accepts `{ onTelemetry, shouldStop }`, emits one telemetry envelope per phase, and still returns the final `NodeRunSummary`.

Update `apps/load-control/src/agent/main.ts`:

```ts
export async function bootstrapAgent({
  controlClient = new HttpControlClient(
    process.env.LOAD_CONTROL_BASE_URL ?? 'http://localhost:3001/control',
  ),
  nodeRegistration = readNodeRegistration(),
  runId = process.env.LOAD_CONTROL_RUN_ID ?? 'run-live-01',
}: {
  controlClient?: HttpControlClient;
  nodeRegistration?: NodeRegistration & { poolId: string };
  runId?: string;
} = {}) {
  await controlClient.registerNode(nodeRegistration);

  let run = await controlClient.getRun(runId);
  while (run.status === 'PLANNED') {
    await new Promise((resolve) => setTimeout(resolve, 500));
    run = await controlClient.getRun(runId);
  }

  if (run.status !== 'RUNNING') {
    throw new Error(`Run ${runId} is not runnable: ${run.status}`);
  }

  const assignment = run.assignments.find((item) => item.nodeId === nodeRegistration.id);
  if (!assignment) {
    throw new Error(`No assignment found for node ${nodeRegistration.id}`);
  }

  const runner = new AgentRunner({
    async execute({ simulatedLatencyMs }) {
      return { ok: true, durationMs: simulatedLatencyMs };
    },
  });

  const summary = await runner.runAssignment(assignment, {
    async onTelemetry(sample) {
      await controlClient.postTelemetry(sample);
    },
    shouldStop() {
      return false;
    },
  });

  await controlClient.submitSummary(runId, summary);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `corepack pnpm --filter load-control test -- src/agent/agent-runner.spec.ts src/agent/main.spec.ts --runInBand`
Expected: PASS with live telemetry callbacks and bootstrap flow covered.

- [ ] **Step 5: Commit**

```bash
git add apps/load-control/src/agent/http-control.client.ts apps/load-control/src/agent/agent-runner.ts apps/load-control/src/agent/agent-runner.spec.ts apps/load-control/src/agent/main.ts apps/load-control/src/agent/main.spec.ts
git commit -m "feat: stream live telemetry from cloud agents"
```

### Task 4: Repurpose The Admin App Into The Operator Console And Finish Monorepo Verification

**Files:**
- Create: `apps/admin/src/layouts/control-shell.tsx`
- Create: `apps/admin/src/services/load-control.ts`
- Create: `apps/admin/src/hooks/use-run-stream.ts`
- Create: `apps/admin/src/pages/overview/index.tsx`
- Create: `apps/admin/src/pages/runs/index.tsx`
- Create: `apps/admin/src/pages/run-detail/index.tsx`
- Create: `apps/admin/src/pages/nodes/index.tsx`
- Create: `apps/admin/src/pages/reports/index.tsx`
- Create: `apps/admin/src/router.spec.tsx`
- Create: `apps/admin/src/pages/overview/index.spec.tsx`
- Create: `apps/admin/src/pages/run-detail/index.spec.tsx`
- Create: `docs/superpowers/guides/2026-04-18-load-testing-saas-operator-guide.md`
- Modify: `apps/admin/package.json`
- Modify: `apps/admin/src/router.tsx`
- Modify: `package.json`
- Modify: `tests/workspace/repo-layout.spec.ts`

- [ ] **Step 1: Write the failing router and live-page tests**

Create `apps/admin/src/router.spec.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { AppRouter } from './router';

describe('AppRouter', () => {
  it('redirects the root route to overview', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AppRouter />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Load Testing Overview')).toBeInTheDocument();
    expect(screen.getByText('Runs')).toBeInTheDocument();
    expect(screen.getByText('Nodes')).toBeInTheDocument();
  });
});
```

Create `apps/admin/src/pages/overview/index.spec.tsx`:

```tsx
import { render, screen } from '@testing-library/react';

import { OverviewPage } from './index';

vi.mock('../../services/load-control', () => ({
  listRuns: vi.fn().mockResolvedValue([
    {
      id: 'run-live-01',
      templateId: 'concert-release',
      nodePoolId: 'hk-core',
      mode: 'PREPROD',
      targetBaseUrl: 'https://preprod.example.com',
      status: 'RUNNING',
      tags: { test_run_id: 'run-live-01' },
      createdAt: '2026-04-18T09:00:00.000Z',
      updatedAt: '2026-04-18T09:05:00.000Z',
    },
  ]),
  getLiveSnapshot: vi.fn().mockResolvedValue({
    runId: 'run-live-01',
    status: 'RUNNING',
    currentPhaseId: 'peak',
    aggregateQps: 1960,
    aggregateErrorRate: 0.02,
    aggregateP95LatencyMs: 620,
    activeNodeCount: 3,
    unhealthyNodeCount: 1,
    nodes: [],
    alerts: [],
    updatedAt: '2026-04-18T09:30:00.000Z',
  }),
}));

it('renders the active run summary card', async () => {
  render(<OverviewPage />);

  expect(await screen.findByText('run-live-01')).toBeInTheDocument();
  expect(screen.getByText('peak')).toBeInTheDocument();
});
```

Create `apps/admin/src/pages/run-detail/index.spec.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { RunDetailPage } from './index';

vi.stubGlobal(
  'EventSource',
  class {
    onmessage: ((event: MessageEvent<string>) => void) | null = null;
    constructor() {
      queueMicrotask(() => {
        this.onmessage?.(
          new MessageEvent('message', {
            data: JSON.stringify({
              runId: 'run-live-01',
              status: 'RUNNING',
              currentPhaseId: 'peak',
              aggregateQps: 1960,
              aggregateErrorRate: 0.02,
              aggregateP95LatencyMs: 620,
              activeNodeCount: 3,
              unhealthyNodeCount: 1,
              nodes: [],
              alerts: [],
              updatedAt: '2026-04-18T09:30:00.000Z',
            }),
          }),
        );
      });
    }
    close() {}
  },
);

it('renders live run data from the stream hook', async () => {
  render(
    <MemoryRouter initialEntries={['/runs/run-live-01']}>
      <Routes>
        <Route path='/runs/:runId' element={<RunDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );

  expect(await screen.findByText('run-live-01')).toBeInTheDocument();
  expect(screen.getByText('peak')).toBeInTheDocument();
});
```

Update `tests/workspace/repo-layout.spec.ts`:

```ts
expect(rootPackage.scripts?.test).toContain('pnpm --filter admin test');
expect(existsSync('docs/superpowers/guides/2026-04-18-load-testing-saas-operator-guide.md')).toBe(true);
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `corepack pnpm --filter admin test`
Expected: FAIL because the new pages, layout, hook, and test dependencies do not exist.

Run: `corepack pnpm exec vitest run tests/workspace/repo-layout.spec.ts`
Expected: FAIL because the guide file and root `admin` test wiring do not exist yet.

- [ ] **Step 3: Implement the console shell, routes, live pages, and guide**

Update `apps/admin/package.json`:

```json
{
  "devDependencies": {
    "@testing-library/jest-dom": "^6.7.0",
    "@testing-library/react": "^16.3.0",
    "jsdom": "^26.1.0",
    "vitest": "^2.1.5"
  }
}
```

Create `apps/admin/src/services/load-control.ts`:

```ts
import type {
  CalibrationReport,
  ControlRunDraft,
  ControlRunRecord,
  LiveRunSnapshot,
  NodePool,
  ScenarioTemplate,
} from '@ticketing/contracts';

const DEFAULT_BASE_URL =
  window.localStorage.getItem('ticketing.loadControl.baseUrl')?.trim() ||
  import.meta.env.VITE_LOAD_CONTROL_BASE_URL ||
  'http://localhost:3001/control';

export async function controlRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${DEFAULT_BASE_URL}${path}`, {
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return (await response.json()) as T;
}

export const listRuns = () => controlRequest<ControlRunRecord[]>('/runs');
export const listNodePools = () => controlRequest<NodePool[]>('/node-pools');
export const listTemplates = () => controlRequest<ScenarioTemplate[]>('/templates');
export const createRun = (body: ControlRunDraft) =>
  controlRequest<ControlRunRecord>('/runs', {
    method: 'POST',
    body: JSON.stringify(body),
  });
export const planRun = (runId: string) =>
  controlRequest<ControlRunRecord>(`/runs/${runId}/plan`, { method: 'POST' });
export const startRun = (runId: string) =>
  controlRequest<ControlRunRecord>(`/runs/${runId}/start`, { method: 'POST' });
export const stopRun = (runId: string) =>
  controlRequest<ControlRunRecord>(`/runs/${runId}/stop`, { method: 'POST' });
export const getLiveSnapshot = (runId: string) =>
  controlRequest<LiveRunSnapshot>(`/runs/${runId}/live`);
export const getCalibrationReport = (baselineRunId: string, productionRunId: string) =>
  controlRequest<CalibrationReport>(
    `/reports/calibration/${baselineRunId}/${productionRunId}`,
  );
```

Create `apps/admin/src/layouts/control-shell.tsx`:

```tsx
import { Layout, Menu, Typography } from 'antd';
import { Link, Outlet, useLocation } from 'react-router-dom';

const items = [
  { key: '/overview', label: <Link to='/overview'>Overview</Link> },
  { key: '/runs', label: <Link to='/runs'>Runs</Link> },
  { key: '/nodes', label: <Link to='/nodes'>Nodes</Link> },
];

export function ControlShell() {
  const location = useLocation();

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Layout.Sider theme='light' width={240}>
        <div style={{ padding: 24 }}>
          <Typography.Title level={4} style={{ margin: 0 }}>
            Load Testing Console
          </Typography.Title>
          <Typography.Text type='secondary'>
            Internal run orchestration and live observation
          </Typography.Text>
        </div>
        <Menu
          items={items}
          mode='inline'
          selectedKeys={[
            items.find((item) => location.pathname.startsWith(item.key))?.key ??
              '/overview',
          ]}
        />
      </Layout.Sider>
      <Layout.Content style={{ padding: 24 }}>
        <Outlet />
      </Layout.Content>
    </Layout>
  );
}
```

Update `apps/admin/src/router.tsx` so it becomes:

```tsx
<Routes>
  <Route path='/' element={<Navigate replace to='/overview' />} />
  <Route element={<ControlShell />}>
    <Route path='/overview' element={<OverviewPage />} />
    <Route path='/runs' element={<RunsPage />} />
    <Route path='/runs/:runId' element={<RunDetailPage />} />
    <Route path='/nodes' element={<NodesPage />} />
    <Route
      path='/reports/:baselineRunId/:productionRunId'
      element={<ReportsPage />}
    />
  </Route>
</Routes>
```

Create `apps/admin/src/hooks/use-run-stream.ts`:

```tsx
import { useEffect, useState } from 'react';

import type { LiveRunSnapshot } from '@ticketing/contracts';

const DEFAULT_BASE_URL =
  window.localStorage.getItem('ticketing.loadControl.baseUrl')?.trim() ||
  import.meta.env.VITE_LOAD_CONTROL_BASE_URL ||
  'http://localhost:3001/control';

export function useRunStream(runId: string) {
  const [snapshot, setSnapshot] = useState<LiveRunSnapshot>();

  useEffect(() => {
    const source = new EventSource(`${DEFAULT_BASE_URL}/runs/${runId}/stream`);
    source.onmessage = (event) => {
      setSnapshot(JSON.parse(event.data) as LiveRunSnapshot);
    };

    return () => {
      source.close();
    };
  }, [runId]);

  return snapshot;
}
```

Create the first version of the pages:

```tsx
// apps/admin/src/pages/overview/index.tsx
import { Alert, Card, Col, Row, Space, Statistic, Typography } from 'antd';
import { useEffect, useState } from 'react';

import { getLiveSnapshot, listRuns } from '../../services/load-control';

export function OverviewPage() {
  const [error, setError] = useState<string>();
  const [activeRunId, setActiveRunId] = useState<string>();
  const [snapshot, setSnapshot] = useState<Awaited<ReturnType<typeof getLiveSnapshot>>>();

  useEffect(() => {
    void (async () => {
      try {
        const runs = await listRuns();
        const running = runs.find((item) => item.status === 'RUNNING') ?? runs[0];
        setActiveRunId(running?.id);

        if (running) {
          setSnapshot(await getLiveSnapshot(running.id));
        }
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Unable to load overview.');
      }
    })();
  }, []);

  return (
    <Space direction='vertical' size={16} style={{ display: 'flex' }}>
      <Typography.Title level={3}>Load Testing Overview</Typography.Title>
      {error ? <Alert type='error' message={error} showIcon /> : null}
      <Row gutter={16}>
        <Col span={6}><Card><Statistic title='Active run' value={activeRunId ?? 'No active run'} /></Card></Col>
        <Col span={6}><Card><Statistic title='Current phase' value={snapshot?.currentPhaseId ?? 'n/a'} /></Card></Col>
        <Col span={6}><Card><Statistic title='Aggregate QPS' value={snapshot?.aggregateQps ?? 0} /></Card></Col>
        <Col span={6}><Card><Statistic title='P95 latency' suffix='ms' value={snapshot?.aggregateP95LatencyMs ?? 0} /></Card></Col>
      </Row>
    </Space>
  );
}

// apps/admin/src/pages/runs/index.tsx
import { Button, Drawer, Form, Select, Space, Table, Typography } from 'antd';
import { useEffect, useState } from 'react';

import { createRun, listNodePools, listRuns, listTemplates, planRun, startRun, stopRun } from '../../services/load-control';

export function RunsPage() {
  const [runs, setRuns] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [nodePools, setNodePools] = useState<any[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    void Promise.all([listRuns(), listTemplates(), listNodePools()]).then(
      ([nextRuns, nextTemplates, nextNodePools]) => {
        setRuns(nextRuns);
        setTemplates(nextTemplates);
        setNodePools(nextNodePools);
      },
    );
  }, []);

  return (
    <Space direction='vertical' size={16} style={{ display: 'flex' }}>
      <Space style={{ justifyContent: 'space-between', width: '100%' }}>
        <Typography.Title level={3} style={{ margin: 0 }}>Runs</Typography.Title>
        <Button type='primary' onClick={() => setOpen(true)}>New Run</Button>
      </Space>
      <Table rowKey='id' dataSource={runs} pagination={false} columns={[
        { title: 'Run', dataIndex: 'id' },
        { title: 'Template', dataIndex: 'templateId' },
        { title: 'Node Pool', dataIndex: 'nodePoolId' },
        { title: 'Status', dataIndex: 'status' },
        {
          title: 'Actions',
          render: (_value, record) => (
            <Space>
              <Button onClick={() => void planRun(record.id)}>Plan</Button>
              <Button type='primary' onClick={() => void startRun(record.id)}>Start</Button>
              <Button danger onClick={() => void stopRun(record.id)}>Stop</Button>
            </Space>
          ),
        },
      ]} />
      <Drawer open={open} title='Create Run' onClose={() => setOpen(false)}>
        <Form layout='vertical' onFinish={(values) => void createRun(values)}>
          <Form.Item label='Run ID' name='id' required><Select options={[]} open={false} placeholder='run-20260418-01' /></Form.Item>
          <Form.Item label='Template' name='templateId' required><Select options={templates.map((item) => ({ label: item.name, value: item.id }))} /></Form.Item>
          <Form.Item label='Node Pool' name='nodePoolId' required><Select options={nodePools.map((item) => ({ label: item.name, value: item.id }))} /></Form.Item>
          <Button htmlType='submit' type='primary'>Create Draft</Button>
        </Form>
      </Drawer>
    </Space>
  );
}

// apps/admin/src/pages/run-detail/index.tsx
import { Alert, Card, Col, Row, Space, Statistic, Table, Typography } from 'antd';
import { useParams } from 'react-router-dom';

import { useRunStream } from '../../hooks/use-run-stream';

export function RunDetailPage() {
  const { runId = '' } = useParams();
  const snapshot = useRunStream(runId);

  return (
    <Space direction='vertical' size={16} style={{ display: 'flex' }}>
      <Typography.Title level={3}>{runId}</Typography.Title>
      {snapshot?.alerts.length ? <Alert type='warning' showIcon message={snapshot.alerts[0].message} /> : null}
      <Row gutter={16}>
        <Col span={6}><Card><Statistic title='Status' value={snapshot?.status ?? 'waiting'} /></Card></Col>
        <Col span={6}><Card><Statistic title='Current phase' value={snapshot?.currentPhaseId ?? 'n/a'} /></Card></Col>
        <Col span={6}><Card><Statistic title='Aggregate QPS' value={snapshot?.aggregateQps ?? 0} /></Card></Col>
        <Col span={6}><Card><Statistic title='Error rate' value={snapshot?.aggregateErrorRate ?? 0} precision={2} /></Card></Col>
      </Row>
      <Table rowKey='nodeId' dataSource={snapshot?.nodes ?? []} pagination={false} columns={[
        { title: 'Node', dataIndex: 'nodeId' },
        { title: 'Region', dataIndex: 'region' },
        { title: 'Status', dataIndex: 'status' },
        { title: 'Phase', dataIndex: 'phaseId' },
        { title: 'QPS', dataIndex: 'qps' },
        { title: 'P95 (ms)', dataIndex: 'p95LatencyMs' },
      ]} />
    </Space>
  );
}

// apps/admin/src/pages/nodes/index.tsx
import { Table, Typography } from 'antd';
import { useEffect, useState } from 'react';

import { listNodePools } from '../../services/load-control';

export function NodesPage() {
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    void listNodePools().then(setRows);
  }, []);

  return (
    <>
      <Typography.Title level={3}>Nodes</Typography.Title>
      <Table rowKey='id' dataSource={rows} pagination={false} columns={[
        { title: 'Pool', dataIndex: 'name' },
        { title: 'Region', dataIndex: 'region' },
        { title: 'Role', dataIndex: 'role' },
        { title: 'Nodes', render: (_value, record) => record.nodeIds.join(', ') || 'No nodes registered' },
      ]} />
    </>
  );
}

// apps/admin/src/pages/reports/index.tsx
import { Card, Descriptions, Space, Typography } from 'antd';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

import { getCalibrationReport } from '../../services/load-control';

export function ReportsPage() {
  const { baselineRunId = '', productionRunId = '' } = useParams();
  const [report, setReport] = useState<any>();

  useEffect(() => {
    void getCalibrationReport(baselineRunId, productionRunId).then(setReport);
  }, [baselineRunId, productionRunId]);

  return (
    <Space direction='vertical' size={16} style={{ display: 'flex' }}>
      <Typography.Title level={3}>Calibration Report</Typography.Title>
      <Card>
        <Descriptions column={2}>
          <Descriptions.Item label='Realism'>{report?.realismScore ?? '-'}</Descriptions.Item>
          <Descriptions.Item label='Capacity'>{report?.capacityScore ?? '-'}</Descriptions.Item>
          <Descriptions.Item label='Fairness'>{report?.fairnessScore ?? '-'}</Descriptions.Item>
          <Descriptions.Item label='Control'>{report?.controlScore ?? '-'}</Descriptions.Item>
        </Descriptions>
      </Card>
    </Space>
  );
}
```

Update root `package.json`:

```json
{
  "scripts": {
    "test": "corepack pnpm --filter api test && corepack pnpm --filter @ticketing/contracts test && corepack pnpm --filter load-control test && corepack pnpm --filter load-control test:e2e && corepack pnpm --filter admin test && corepack pnpm exec vitest run tests/perf/load-testing-fixtures.spec.ts && corepack pnpm exec vitest run tests/workspace/repo-layout.spec.ts"
  }
}
```

Create `docs/superpowers/guides/2026-04-18-load-testing-saas-operator-guide.md`:

```md
# Load Testing SaaS Operator Guide

## Local Boot

1. `docker compose up -d`
2. `Copy-Item .env.example .env`
3. `corepack pnpm --filter load-control prisma:generate`
4. `corepack pnpm --filter load-control prisma:migrate`
5. `corepack pnpm dev:load-control`
6. `corepack pnpm dev:admin`

## Browser Settings

- Optional local override key: `ticketing.loadControl.baseUrl`
- Default control base URL: `http://localhost:3001/control`

## V1 Operator Loop

1. Open `/runs`
2. Create a draft from a seeded template and node pool
3. Plan the run
4. Start the run
5. Watch `/overview` or `/runs/:runId`
6. Open `/reports/:baselineRunId/:productionRunId` after completion
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `corepack pnpm --filter admin test`
Expected: PASS with router, overview, and run-detail tests green.

Run: `corepack pnpm --filter admin build`
Expected: PASS with the new console routes compiling.

Run: `corepack pnpm test`
Expected: PASS across `api`, `@ticketing/contracts`, `load-control`, `admin`, perf fixtures, and workspace checks.

- [ ] **Step 5: Commit**

```bash
git add apps/admin/package.json apps/admin/src/layouts/control-shell.tsx apps/admin/src/services/load-control.ts apps/admin/src/hooks/use-run-stream.ts apps/admin/src/pages/overview/index.tsx apps/admin/src/pages/runs/index.tsx apps/admin/src/pages/run-detail/index.tsx apps/admin/src/pages/nodes/index.tsx apps/admin/src/pages/reports/index.tsx apps/admin/src/router.tsx apps/admin/src/router.spec.tsx apps/admin/src/pages/overview/index.spec.tsx apps/admin/src/pages/run-detail/index.spec.tsx docs/superpowers/guides/2026-04-18-load-testing-saas-operator-guide.md package.json tests/workspace/repo-layout.spec.ts
git commit -m "feat: ship the load-testing SaaS operator console"
```

## Self-Review

### Spec Coverage

- Product boundary reframe: covered by Task 4 through the console route replacement and operator guide.
- Persistent control plane: covered by Task 1.
- Realtime telemetry as a first-class runtime path: covered by Task 2 and Task 3.
- Cloud protocol agents: covered by Task 3.
- Orchestration plus observability parity: covered by Task 2 and Task 4.
- `apps/api` preserved as the sample target rather than the main product: preserved by all tasks because no user-facing ticketing-console work remains in scope and no changes are planned for `apps/api`.
- `apps/miniapp` deprioritized but retained: covered by Preconditions and by leaving it untouched.

No approved spec requirement is left without a task.

### Placeholder Scan

- No `TODO`, `TBD`, or `implement later` markers remain.
- Each task names exact files, explicit commands, and concrete code to add.
- Validation, telemetry, persistence, and UI steps all include exact tests rather than generic `write tests` instructions.

### Type Consistency

- The plan uses `ControlRunDraft`, `ControlRunRecord`, `NodePool`, `ScenarioTemplate`, `NodeTelemetrySample`, and `LiveRunSnapshot` consistently from Task 1 through Task 4.
- Run statuses are kept consistent as `DRAFT`, `PLANNED`, `RUNNING`, `STOPPING`, `STOPPED`, `COMPLETED`, and `FAILED`.
- The control-console routes remain aligned with the approved spec: `/overview`, `/runs`, `/runs/:runId`, `/nodes`, and `/reports/:baselineRunId/:productionRunId`.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-18-load-testing-saas-reframe-implementation.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
