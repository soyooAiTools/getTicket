# Authorized Ticketing Platform

Monorepo for an authorized ticketing platform with a Nest API, a Taro miniapp, an admin web app, and shared contract schemas.

## Workspace

- `apps/api`: NestJS backend for auth, catalog, checkout, fulfillment, payments, refunds, viewers, and related support modules
- `apps/miniapp`: Taro miniapp for customer-facing browsing and ticket flow
- `apps/admin`: Vite admin console for operational views
- `packages/contracts`: shared Zod schemas used across apps
- `tests`: repo layout and workspace-level checks

## Common Commands

- `corepack pnpm install`
- `corepack pnpm dev:api`
- `corepack pnpm dev:admin`
- `corepack pnpm dev:miniapp`
- `corepack pnpm lint`
- `corepack pnpm test`

## Notes

- The API package uses Jest-based specs.
- Shared and frontend packages use Vitest.
- Root lint is a lightweight baseline pass over the workspace packages and repo-level checks, not a full style-enforcement sweep.
- The risk module currently exposes a baseline purchase-limit check; checkout policy data can be wired in later when a source of truth exists.
