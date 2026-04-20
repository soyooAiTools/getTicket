# Load-Testing SaaS Operator Console Guide

This guide covers the `apps/admin` operator console that now fronts the
`load-control` runtime. The console is meant for SaaS-style control-surface
operations rather than ticketing backoffice work.

## Routes

- `/overview`: top-level health and catalog summary for operators.
- `/runs`: create draft runs from seeded templates and drive plan/start/stop.
- `/runs/:runId`: inspect one run's definition, assignments, summaries, and live telemetry.
- `/nodes`: review seeded node pools and currently registered nodes.
- `/reports/:baselineRunId/:productionRunId`: compare two completed runs with a calibration report.

In the current Chinese console copy, these routes map to the operator-facing
navigation below:

- `/overview`: `作战总览`
- `/runs`: `抢票任务`
- `/runs/:runId`: `任务作战台`
- `/nodes`: `节点池`
- `/reports/:baselineRunId/:productionRunId`: `校准复盘`

## Data sources

The console talks directly to the `load-control` runtime API.

- JSON control endpoints:
  `GET /control/node-pools`
  `GET /control/templates`
  `GET /control/nodes`
  `GET /control/runs`
  `GET /control/runs/:runId`
  `POST /control/runs`
  `POST /control/runs/:runId/plan`
  `POST /control/runs/:runId/start`
  `POST /control/runs/:runId/stop`
  `GET /control/reports/calibration/:baselineRunId/:productionRunId`
- Live telemetry endpoints:
  `GET /control/runs/:runId/live`
  `GET /control/runs/:runId/stream` (SSE)

## Configuration

`apps/admin` resolves the load-control base URL in this order:

1. `window.localStorage['load-testing.operator.base-url']`
2. `VITE_LOAD_CONTROL_BASE_URL`
3. default `http://localhost:3001/control`

For local development, the standard pairing is:

```powershell
corepack pnpm --filter load-control dev
corepack pnpm --filter admin dev
```

## Local launchers

For this worktree, the quickest local entrypoint is:

```powershell
.\start-local-stack.cmd
```

That launcher calls `scripts/start-local-stack.ps1` and will:

- ensure `.env` exists
- bring up `Postgres` and `Redis` via `docker compose`
- install dependencies if `node_modules` is missing
- run Prisma generate/migrate for `api` and `load-control`
- seed the persisted load-control templates and node pools needed by the SaaS console
- start `api`, `load-control`, and `admin` as background processes

Companion launchers:

- `stop-local-stack.cmd`
- `status-local-stack.cmd`

Operational state is stored under `.codex-temp/local-stack`, with per-service stdout/stderr logs under `.codex-temp/local-stack/logs`.

The one-click launcher starts the core SaaS stack only. It does not automatically launch a load agent or demo run. If you want to execute a run end-to-end, register/start an agent separately after the stack is up.

The local SQL seed now also provisions one draft ticket-task demo run:
`run-local-demo-01`. After startup, you can go straight to `/runs` and inspect
or plan that seeded task instead of creating everything from scratch.

## Operator workflow

1. Open `/runs` and create a draft from a seeded template and node pool.
2. Plan the run once target settings look right.
3. Start the run and follow `/runs/:runId` for live telemetry.
4. Stop the run if needed, or wait for summaries to complete.
5. Compare completed runs under `/reports/:baselineRunId/:productionRunId`.

## Ticket-task workflow

The operator console is now framed as a ticket-testing control surface rather
than a generic load-test CRUD panel.

Use it like this:

1. Open `/overview` to confirm the stack is healthy and see the latest seeded
   templates, node pools, and recent ticket tasks.
2. Open `/runs` and create a task from the grouped sections:
   `基础参数`, `场次信息`, `票档目标`, `节点策略`, and `执行策略`.
3. Use the live summary banner at the top of the form to confirm the event,
   ticket tier, quantity, node pool, and execution objective before saving.
4. Choose one of the three task actions:
   `保存任务草稿`, `创建并规划`, or `创建、规划并启动`.
5. Follow `/runs/:runId` to monitor the `任务作战台`, including the ticket
   summary card, current phase, node health, telemetry, and summaries.

`/overview` is an operator war room. It is not an end-user ticket checkout
page. The actual ticket-task creation and execution controls live under
`/runs`.

## Verification

Use these commands when changing the console:

```powershell
corepack pnpm --filter admin test
corepack pnpm --filter admin build
corepack pnpm test
```
