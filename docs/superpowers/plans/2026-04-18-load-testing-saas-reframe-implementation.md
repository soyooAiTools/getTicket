# Load-Testing SaaS Reframe Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Reframe the repository around an internal load-testing SaaS where `apps/admin` becomes the operator console, `apps/load-control` becomes the persistent control plane, cloud protocol agents stream live telemetry, and `apps/api` remains the embedded sample system-under-test.

**Architecture:** Keep `apps/load-control` as the orchestration backend, add persistent run and telemetry storage, expose runtime APIs for seeded catalogs and live run status, repurpose `apps/admin` into a control-room UI, and preserve shared contracts in `packages/contracts` so the console, control plane, agents, and fixtures all validate the same payloads.

**Tech Stack:** TypeScript, NestJS, React, React Router, Ant Design, Prisma, Redis, Postgres, Jest, Vitest, pnpm workspace

---

## Status

- `spec`: [2026-04-18-load-testing-saas-reframe-design.md](D:\CodexFolder\.worktrees\load-testing-saas-reframe\docs\superpowers\specs\2026-04-18-load-testing-saas-reframe-design.md)
- `operator guide`: [2026-04-18-load-testing-saas-operator-guide.md](D:\CodexFolder\.worktrees\load-testing-saas-reframe\docs\superpowers\guides\2026-04-18-load-testing-saas-operator-guide.md)
- `engineering handoff`: [2026-04-21-load-testing-saas-engineering-handoff.md](D:\CodexFolder\.worktrees\load-testing-saas-reframe\docs\superpowers\guides\2026-04-21-load-testing-saas-engineering-handoff.md)
- `execution state`: completed on branch `codex/load-testing-saas-reframe`
- `latest fresh smoke`: `run-handoff-smoke-20260421234408` completed on `2026-04-21` with `18/18` successful requests, `1` assignment, `1` summary, and `6` orders created through the sample target

## Task Breakdown

### Task 1: Persistent Control-Plane Foundations

**Outcome:** Replace in-memory-only state with durable run, assignment, summary, and telemetry persistence for `apps/load-control`.

- [x] Add shared load-testing contract coverage in [packages/contracts/src/load-testing.ts](D:\CodexFolder\.worktrees\load-testing-saas-reframe\packages\contracts\src\load-testing.ts) and corresponding fixture tests.
- [x] Introduce Prisma-backed persistence in [apps/load-control/src/modules/control/control.repository.ts](D:\CodexFolder\.worktrees\load-testing-saas-reframe\apps\load-control\src\modules\control\control.repository.ts).
- [x] Isolate the load-control Prisma client under [apps/load-control/prisma/generated/client](D:\CodexFolder\.worktrees\load-testing-saas-reframe\apps\load-control\prisma\generated\client) so it does not clobber `apps/api`.
- [x] Persist assignments and validated summaries so reporting survives process restarts.

### Task 2: Runtime Control APIs And Telemetry Aggregation

**Outcome:** Expose the control-plane APIs needed by the SaaS console and make live run state queryable.

- [x] Seed default node pools and templates in [apps/load-control/src/modules/control/default-control-catalog.ts](D:\CodexFolder\.worktrees\load-testing-saas-reframe\apps\load-control\src\modules\control\default-control-catalog.ts).
- [x] Add runtime endpoints for node pools, templates, run list, run detail, start, stop, and live snapshots in [apps/load-control/src/modules/control/control.controller.ts](D:\CodexFolder\.worktrees\load-testing-saas-reframe\apps\load-control\src\modules\control\control.controller.ts).
- [x] Add first-class telemetry ingestion and streaming support in [apps/load-control/src/modules/telemetry](D:\CodexFolder\.worktrees\load-testing-saas-reframe\apps\load-control\src\modules\telemetry).
- [x] Enable CORS and e2e coverage for the console-facing APIs.

### Task 3: Cloud Agent Live Telemetry Execution Flow

**Outcome:** Make protocol agents wait for running runs, stream telemetry during phase execution, and submit summaries only after execution completes.

- [x] Update [apps/load-control/src/agent/http-control.client.ts](D:\CodexFolder\.worktrees\load-testing-saas-reframe\apps\load-control\src\agent\http-control.client.ts) to support runtime polling and telemetry upload.
- [x] Update [apps/load-control/src/agent/agent-runner.ts](D:\CodexFolder\.worktrees\load-testing-saas-reframe\apps\load-control\src\agent\agent-runner.ts) to emit phase-window telemetry while preserving final summary aggregation.
- [x] Update [apps/load-control/src/agent/main.ts](D:\CodexFolder\.worktrees\load-testing-saas-reframe\apps\load-control\src\agent\main.ts) to follow the register -> wait -> execute -> summarize lifecycle.
- [x] Cover the agent flow with unit and e2e tests.

### Task 4: Operator Console Reframe

**Outcome:** Turn `apps/admin` into the load-testing SaaS control-room UI.

- [x] Replace the previous ticketing routes in [apps/admin/src/router.tsx](D:\CodexFolder\.worktrees\load-testing-saas-reframe\apps\admin\src\router.tsx) with `/overview`, `/runs`, `/runs/:runId`, `/nodes`, and `/reports/:baselineRunId/:productionRunId`.
- [x] Add the control-shell layout in [apps/admin/src/layouts/control-shell.tsx](D:\CodexFolder\.worktrees\load-testing-saas-reframe\apps\admin\src\layouts\control-shell.tsx).
- [x] Add a typed load-control client in [apps/admin/src/services/load-control.ts](D:\CodexFolder\.worktrees\load-testing-saas-reframe\apps\admin\src\services\load-control.ts) and live stream hook in [apps/admin/src/hooks/use-run-stream.ts](D:\CodexFolder\.worktrees\load-testing-saas-reframe\apps\admin\src\hooks\use-run-stream.ts).
- [x] Implement overview, runs, run detail, nodes, and reports pages under [apps/admin/src/pages](D:\CodexFolder\.worktrees\load-testing-saas-reframe\apps\admin\src\pages).
- [x] Add operator-console routing and page tests plus [2026-04-18-load-testing-saas-operator-guide.md](D:\CodexFolder\.worktrees\load-testing-saas-reframe\docs\superpowers\guides\2026-04-18-load-testing-saas-operator-guide.md).

## Verification

- [x] `corepack pnpm --filter load-control exec tsc -p tsconfig.json --noEmit`
- [x] `corepack pnpm --filter admin test`
- [x] `corepack pnpm --filter admin build`
- [x] `corepack pnpm test`
- [x] `.\start-local-stack.cmd --no-browser` from empty Docker volumes
- [x] fresh real HTTP smoke against `apps/api` using `run-handoff-smoke-20260421234408`
- [x] `corepack pnpm --filter api exec jest --runInBand`
- [x] `corepack pnpm --filter load-control exec jest --runInBand`
- [x] `corepack pnpm --filter @ticketing/contracts test -- --runInBand`
- [x] `corepack pnpm exec tsc -p apps/api/tsconfig.json --noEmit`
- [x] `corepack pnpm exec tsc -p apps/load-control/tsconfig.json --noEmit`
- [x] `corepack pnpm exec vitest run tests/workspace/local-stack-launchers.spec.ts tests/workspace/repo-layout.spec.ts`

## Notes

- The repository boundary for this product line is `apps/api`, `apps/admin`, and `apps/load-control`.
- The current admin Vitest run still prints React Router / Ant Design `useLayoutEffect` SSR warnings, but tests pass and the build succeeds.
- The branch is intended to be reviewed and merged as the load-testing SaaS reframe baseline.
