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

## Operator workflow

1. Open `/runs` and create a draft from a seeded template and node pool.
2. Plan the run once target settings look right.
3. Start the run and follow `/runs/:runId` for live telemetry.
4. Stop the run if needed, or wait for summaries to complete.
5. Compare completed runs under `/reports/:baselineRunId/:productionRunId`.

## Verification

Use these commands when changing the console:

```powershell
corepack pnpm --filter admin test
corepack pnpm --filter admin build
corepack pnpm test
```
