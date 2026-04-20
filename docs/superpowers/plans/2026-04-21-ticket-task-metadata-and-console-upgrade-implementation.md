# Ticket Task Metadata And Console Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add structured ticket-task metadata and upgrade the console so task creation and viewing feel like real ticket-grabbing rehearsals.

**Architecture:** Extend the shared load-testing contract with a `ticketTask` object, update seeded templates and node pools in both application defaults and local SQL seed data, and then rework the admin task pages so they create, list, and display the richer task metadata without changing the underlying run lifecycle.

**Tech Stack:** TypeScript, Zod, NestJS, React, Ant Design, Prisma, Vitest

---

## Task 1: Contract And Seed Model Foundations

**Files:**
- Modify: `D:\CodexFolder\.worktrees\load-testing-saas-reframe\packages\contracts\src\load-testing.ts`
- Modify: `D:\CodexFolder\.worktrees\load-testing-saas-reframe\packages\contracts\src\index.ts`
- Modify: `D:\CodexFolder\.worktrees\load-testing-saas-reframe\apps\load-control\src\modules\control\default-control-catalog.ts`
- Modify: `D:\CodexFolder\.worktrees\load-testing-saas-reframe\scripts\sql\seed-load-control-local.sql`

- [ ] Add a `ticketTask` schema and exported types to the shared contracts.
- [ ] Update default node pools to Chinese operational names.
- [ ] Update default templates to Chinese rehearsal names and include realistic `ticketTask` defaults.
- [ ] Update the local SQL seed to match the new names and `ticketTask` payload shape.

## Task 2: Failing Coverage For New Metadata

**Files:**
- Modify or create targeted tests under `D:\CodexFolder\.worktrees\load-testing-saas-reframe\tests`
- Modify or create targeted tests under `D:\CodexFolder\.worktrees\load-testing-saas-reframe\apps\admin\src\pages`

- [ ] Write a failing test that proves the new `ticketTask` contract is validated.
- [ ] Write or update admin view tests so the task list or detail page must render the new ticket-task summary information.
- [ ] Run the targeted tests and confirm they fail for the right reason before implementation.

## Task 3: Console Shared Copy And Mapping Upgrade

**Files:**
- Modify: `D:\CodexFolder\.worktrees\load-testing-saas-reframe\apps\admin\src\shared\console-copy.ts`

- [ ] Add label helpers for execution objectives and launch modes.
- [ ] Add shared helper functions for summarizing task event and ticket metadata in the UI.

## Task 4: Task Creation Page Upgrade

**Files:**
- Modify: `D:\CodexFolder\.worktrees\load-testing-saas-reframe\apps\admin\src\pages\runs\index.tsx`

- [ ] Replace the generic task-creation fields with grouped sections for event, ticket, node strategy, and execution strategy.
- [ ] Map the new fields into `definition.ticketTask` when building a run draft.
- [ ] Preserve existing lifecycle actions while adding the three creation actions: save draft, create-and-plan, create-plan-and-start.
- [ ] Add a live summary strip that reflects the current form selection.

## Task 5: Task List And Battle Station Upgrade

**Files:**
- Modify: `D:\CodexFolder\.worktrees\load-testing-saas-reframe\apps\admin\src\pages\runs\index.tsx`
- Modify: `D:\CodexFolder\.worktrees\load-testing-saas-reframe\apps\admin\src\pages\run-detail\index.tsx`
- Modify: `D:\CodexFolder\.worktrees\load-testing-saas-reframe\apps\admin\src\pages\overview\index.tsx`

- [ ] Make the task list show event, session, ticket tier, quantity, node pool, and execution objective.
- [ ] Add a dedicated ticket-task summary block to the battle station.
- [ ] Update overview cards or recent-task rows so seeded defaults display their Chinese business labels cleanly.

## Task 6: Verification

**Files:**
- No code changes required

- [ ] Run `corepack pnpm --filter admin test`
- [ ] Run `corepack pnpm --filter admin build`
- [ ] Run any targeted shared-contract verification needed for `packages/contracts`
- [ ] Confirm the local stack still serves the updated console at `http://localhost:5173/overview`
