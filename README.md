# Load-Testing SaaS Reframe Workspace

Monorepo for an internal load-testing SaaS. The operator console lives in
`apps/admin`, the control plane and agent entrypoint live in
`apps/load-control`, and `apps/api` remains the embedded sample
system-under-test.

## Workspace

- `apps/api`: NestJS sample ticketing backend for auth, catalog, checkout, fulfillment, payments, refunds, viewers, and related support modules
- `apps/admin`: Vite control console for operator workflows
- `apps/load-control`: NestJS control plane and local agent entrypoint for load-test orchestration
- `packages/contracts`: shared Zod schemas used across apps
- `tests`: repo layout and workspace-level checks

## Primary Docs

- Requirements / design:
  [2026-04-18-load-testing-saas-reframe-design.md](D:\CodexFolder\.worktrees\load-testing-saas-reframe\docs\superpowers\specs\2026-04-18-load-testing-saas-reframe-design.md)
- Operator guide:
  [2026-04-18-load-testing-saas-operator-guide.md](D:\CodexFolder\.worktrees\load-testing-saas-reframe\docs\superpowers\guides\2026-04-18-load-testing-saas-operator-guide.md)
- Engineering handoff:
  [2026-04-21-load-testing-saas-engineering-handoff.md](D:\CodexFolder\.worktrees\load-testing-saas-reframe\docs\superpowers\guides\2026-04-21-load-testing-saas-engineering-handoff.md)
- Real HTTP probe implementation record:
  [2026-04-21-real-http-probe-and-generic-session-implementation.md](D:\CodexFolder\.worktrees\load-testing-saas-reframe\docs\superpowers\plans\2026-04-21-real-http-probe-and-generic-session-implementation.md)

## Common Commands

- `corepack pnpm install`
- `corepack pnpm dev:api`
- `corepack pnpm dev:admin`
- `corepack pnpm dev:load-control`
- `corepack pnpm lint`
- `corepack pnpm test`

## Notes

- The primary product boundary is `apps/api`, `apps/admin`, and
  `apps/load-control`.
- The historical end-user miniapp is intentionally removed from this branch.
- The API package uses Jest-based specs.
- Shared and frontend packages use Vitest.
- Root lint is a lightweight baseline pass over the workspace packages and
  repo-level checks, not a full style-enforcement sweep.
