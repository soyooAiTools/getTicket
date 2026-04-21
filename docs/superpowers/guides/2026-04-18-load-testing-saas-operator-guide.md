# Load-Testing SaaS Operator Console Guide

This guide covers the current operator-facing surface for the load-testing
SaaS reframe. The primary operator workflow now runs through `apps/admin`
and `apps/load-control`, with `apps/api` serving as the embedded
system-under-test for local rehearsal and smoke validation.

## Console Routes

The current routed control surface is:

- `/overview`
- `/runs`
- `/runs/:runId`
- `/nodes`
- `/reports/:baselineRunId/:productionRunId`

The operator-facing Chinese labels shown in the console are:

- `/overview`: `作战总览`
- `/runs`: `抢票任务`
- `/runs/:runId`: `任务作战台`
- `/nodes`: `节点池`
- `/reports/:baselineRunId/:productionRunId`: `校准复盘`

The task form on `/runs` is organized as:

- `基础参数`
- `场次信息`
- `票档目标`
- `节点策略`
- `执行策略`

Primary task actions are:

- `保存任务草稿`
- `创建并规划`
- `创建、规划并启动`

## Runtime APIs

The console talks directly to the `load-control` runtime API.

Core control endpoints:

- `GET /control/node-pools`
- `GET /control/templates`
- `GET /control/nodes`
- `GET /control/runs`
- `GET /control/runs/:runId`
- `POST /control/runs`
- `POST /control/runs/:runId/plan`
- `POST /control/runs/:runId/start`
- `POST /control/runs/:runId/stop`
- `GET /control/reports/calibration/:baselineRunId/:productionRunId`

Live execution endpoints:

- `GET /control/runs/:runId/live`
- `GET /control/runs/:runId/stream`

Agent-to-target execution now uses a real HTTP workflow probe against
`apps/api`:

- `POST /api/auth/session/bootstrap`
- `GET /api/viewers`
- `POST /api/viewers`
- `GET /api/catalog/events`
- `GET /api/catalog/events/:eventId`
- `POST /api/orders/draft`

## Configuration

`apps/admin` resolves the load-control base URL in this order:

1. `window.localStorage['load-testing.operator.base-url']`
2. `VITE_LOAD_CONTROL_BASE_URL`
3. default `http://localhost:3001/control`

Key local environment settings for the full stack are:

- `LOAD_CONTROL_BASE_URL`
- `VITE_LOAD_CONTROL_BASE_URL`
- `LOAD_TEST_INTERNAL_SECRET`
- `LOAD_TEST_AGENT_ACCOUNT_PREFIX`
- `DATABASE_URL`
- `LOAD_CONTROL_DATABASE_URL`
- `REDIS_URL`

## Local Stack Launchers

The fastest local path is:

```powershell
.\start-local-stack.cmd --no-browser
```

That launcher delegates into `scripts/start-local-stack.ps1` and
`scripts/local-stack.common.ps1`. The current startup flow now:

1. ensures `.env` exists
2. backfills missing keys from `.env.example`
3. starts `Postgres` and `Redis` with `docker compose`
4. waits until both services are actually reachable
5. installs dependencies if `node_modules` is missing
6. runs non-interactive Prisma generate and migrate for `api` and `load-control`
7. seeds both the API demo catalog and the persisted load-control catalog
8. clears `load-control:*` Redis keys after reseed
9. starts `api`, `load-control`, and `admin`

Companion launchers:

- `.\status-local-stack.cmd`
- `.\stop-local-stack.cmd`

Operational state is written under `.codex-temp/local-stack`, with logs in:

- `.codex-temp/local-stack/logs/api.out.log`
- `.codex-temp/local-stack/logs/api.err.log`
- `.codex-temp/local-stack/logs/load-control.out.log`
- `.codex-temp/local-stack/logs/load-control.err.log`
- `.codex-temp/local-stack/logs/admin.out.log`
- `.codex-temp/local-stack/logs/admin.err.log`

## Seeded Local Data

The local stack now boots with:

- persisted node pools and scenario templates in `apps/load-control`
- one published demo event and session in `apps/api`
- one seeded draft run: `run-local-demo-01`

This means operators can:

1. start the stack
2. open `/runs`
3. inspect or clone seeded templates
4. plan or start a run without first hand-authoring all sample data

## Local End-To-End Smoke

The current handoff smoke path is:

1. start the stack from empty Docker volumes
2. register a local agent against `load-control`
3. create a fresh run
4. plan the run
5. start the run
6. let the agent execute the real HTTP workflow against `apps/api`
7. confirm summaries and live telemetry are persisted

Latest verified fresh smoke baseline on `2026-04-21`:

- run id: `run-handoff-smoke-20260421184833`
- final status: `COMPLETED`
- assignment count: `1`
- summary count: `1`
- phase result: `18 / 18` successful requests
- resulting order count: `6`

## Recommended Operator Flow

1. Open `/overview` to confirm the stack is healthy.
2. Open `/runs` and choose a seeded template.
3. Fill or adjust `场次信息`, `票档目标`, `节点策略`, and `执行策略`.
4. Save as draft or plan immediately.
5. Start the run and switch to `/runs/:runId`.
6. Watch live node telemetry, current phase, and summary collection.
7. Use `/reports/...` when comparing completed baseline and production-like runs.

## Verification Commands

Use these commands when validating the handoff baseline:

```powershell
corepack pnpm --filter api exec jest --runInBand
corepack pnpm --filter load-control exec jest --runInBand
corepack pnpm --filter @ticketing/contracts test -- --runInBand
corepack pnpm exec tsc -p apps/api/tsconfig.json --noEmit
corepack pnpm exec tsc -p apps/load-control/tsconfig.json --noEmit
corepack pnpm exec vitest run tests/workspace/local-stack-launchers.spec.ts tests/workspace/repo-layout.spec.ts
```

## Troubleshooting

- If a fresh run fails during planning with a node foreign-key error, confirm the
  current `ControlService` change is present. Planned nodes must be persisted
  before assignments are written.
- If seeded runs or templates look stale after a reseed, restart with the local
  launcher so the post-seed Redis clear runs.
- If the agent receives `401 Unauthorized` from `apps/api`, confirm
  `LOAD_TEST_INTERNAL_SECRET` matches across the API and agent process.
- If the first session bootstrap races under concurrency, confirm the current
  bootstrap fallback and probe-side bootstrap deduplication are present.

## Product Boundary

For this branch, the active handoff boundary is:

- `apps/admin`
- `apps/load-control`
- `apps/api`
- `packages/contracts`
