# Load-Testing SaaS Engineering Handoff

## Scope

This handoff covers the branch state for the load-testing SaaS reframe on
`2026-04-21`.

Active engineering boundary:

- `apps/admin`
- `apps/load-control`
- `apps/api`
- `packages/contracts`
- local stack scripts and repo-level verification under `scripts` and `tests`

Explicitly out of scope:

- older ticketing-product design docs that predate the SaaS reframe

## What Was Closed Before Handoff

The branch now includes the following completed closures that were previously
blocking handoff:

1. fresh run planning now persists nodes before assignment writes, removing the
   local foreign-key failure on clean stacks
2. local stack bootstrap now fails fast, waits for infra readiness, seeds both
   runtime stores, and clears stale Redis run state after reseed
3. `apps/api` now supports provider-neutral session bootstrap and generic
   payment sample flows for the load-testing path
4. the default load agent probe now runs a real HTTP workflow against
   `apps/api` instead of using a stub probe
5. concurrent bootstrap races were fixed in both the API bootstrap service and
   the load agent
6. routed admin pages and operator copy were cleaned up so the handoff surface
   no longer ships with mojibake UI text

## Primary Entry Points

Start here when continuing engineering work:

- product/design baseline:
  [2026-04-18-load-testing-saas-reframe-design.md](D:\CodexFolder\.worktrees\load-testing-saas-reframe\docs\superpowers\specs\2026-04-18-load-testing-saas-reframe-design.md)
- operator/runtime guide:
  [2026-04-18-load-testing-saas-operator-guide.md](D:\CodexFolder\.worktrees\load-testing-saas-reframe\docs\superpowers\guides\2026-04-18-load-testing-saas-operator-guide.md)
- reframe implementation record:
  [2026-04-18-load-testing-saas-reframe-implementation.md](D:\CodexFolder\.worktrees\load-testing-saas-reframe\docs\superpowers\plans\2026-04-18-load-testing-saas-reframe-implementation.md)
- real HTTP probe implementation record:
  [2026-04-21-real-http-probe-and-generic-session-implementation.md](D:\CodexFolder\.worktrees\load-testing-saas-reframe\docs\superpowers\plans\2026-04-21-real-http-probe-and-generic-session-implementation.md)

Source entry points:

- `apps/admin/src/router.tsx`
- `apps/admin/src/shared/console-copy.ts`
- `apps/load-control/src/modules/control/control.service.ts`
- `apps/load-control/src/agent/main.ts`
- `apps/load-control/src/agent/http-workflow.probe.ts`
- `apps/api/src/modules/auth/session-bootstrap.service.ts`
- `apps/api/src/modules/payments/payments.service.ts`
- `scripts/local-stack.common.ps1`

## Fresh Verification Baseline

Verified on `2026-04-21` from the current branch state:

- `.\start-local-stack.cmd --no-browser` succeeded from empty Docker volumes
- `api`, `load-control`, and `admin` all came up healthy
- fresh smoke run `run-handoff-smoke-20260421184833` completed successfully
- smoke result:
  - status `COMPLETED`
  - `1` assignment
  - `1` summary
  - phase summary `18/18` successful requests
  - `6` resulting orders in the sample target
- final `api.err.log` and `load-control.err.log` were empty after the successful smoke

## Commands Re-Run Before Handoff

```powershell
corepack pnpm --filter api exec jest --runInBand
corepack pnpm --filter load-control exec jest --runInBand
corepack pnpm --filter @ticketing/contracts test -- --runInBand
corepack pnpm exec tsc -p apps/api/tsconfig.json --noEmit
corepack pnpm exec tsc -p apps/load-control/tsconfig.json --noEmit
corepack pnpm exec vitest run tests/workspace/local-stack-launchers.spec.ts tests/workspace/repo-layout.spec.ts
```

## Suggested Review Order

1. Review the reframe and real-HTTP design docs to understand the intended
   product boundary.
2. Review `apps/load-control` planning and agent changes.
3. Review `apps/api` auth and payment-neutralization changes.
4. Review the local stack bootstrap and seed changes.
5. Review the admin routed pages and operator copy updates.

## Operator Notes

- default local target remains `apps/api`
- the seeded local draft run is `run-local-demo-01`
- `LOAD_TEST_INTERNAL_SECRET` must match across the API and the agent
- the probe intentionally treats unauthorized responses as real failures

## Known Constraints

- the repository package name is still `authorized-ticketing-platform`; the
  product framing has shifted, but the workspace package identifier has not
  been renamed in this branch
- admin tests still focus on routed SaaS pages rather than full visual
  regression coverage
- this branch is intended as the clean SaaS handoff baseline, not as a mixed
  ticketing-product branch
