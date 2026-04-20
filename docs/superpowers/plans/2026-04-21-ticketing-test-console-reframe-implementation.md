# Ticketing Test Console Reframe Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reframe the admin console into a Chinese ticket-grabbing test console without changing the existing control-plane APIs.

**Architecture:** Keep the current route structure and service layer, but replace the operator-facing wording with task-oriented Chinese labels and add a lightweight shared label-mapping helper for statuses, modes, roles, and stream states. Reuse the current `run`, `node pool`, `telemetry`, and `report` pages as the underlying behavior model.

**Tech Stack:** React, TypeScript, React Router, Ant Design, Vitest

---

## Task 1: Shared UI Label Mapping

**Files:**
- Create: `D:\CodexFolder\.worktrees\load-testing-saas-reframe\apps\admin\src\shared\console-copy.ts`
- Test: existing admin page tests via `corepack pnpm --filter admin test`

- [ ] Add shared label helpers for run status, validation mode, node role, node health status, and stream state.
- [ ] Export page copy constants for the control shell and major route titles.

## Task 2: Control Shell And Overview Reframe

**Files:**
- Modify: `D:\CodexFolder\.worktrees\load-testing-saas-reframe\apps\admin\src\layouts\control-shell.tsx`
- Modify: `D:\CodexFolder\.worktrees\load-testing-saas-reframe\apps\admin\src\pages\overview\index.tsx`
- Modify: `D:\CodexFolder\.worktrees\load-testing-saas-reframe\apps\admin\src\router.spec.tsx`
- Modify: `D:\CodexFolder\.worktrees\load-testing-saas-reframe\apps\admin\src\pages\overview\index.spec.tsx`

- [ ] Update the navigation labels and shell titles to the ticket-grabbing test console wording.
- [ ] Rewrite overview titles, quick actions, statistics, and table headers into Chinese operational language.
- [ ] Verify the updated overview and router tests fail before implementation, then pass after implementation.

## Task 3: Runs Page Reframe

**Files:**
- Modify: `D:\CodexFolder\.worktrees\load-testing-saas-reframe\apps\admin\src\pages\runs\index.tsx`

- [ ] Rename the page to "抢票任务" and rewrite the task-creation form labels.
- [ ] Rewrite run list actions and table headers to task-oriented Chinese language.
- [ ] Reuse the shared label mapper for status and mode display.

## Task 4: Run Detail Battle-Station Reframe

**Files:**
- Modify: `D:\CodexFolder\.worktrees\load-testing-saas-reframe\apps\admin\src\pages\run-detail\index.tsx`
- Modify: `D:\CodexFolder\.worktrees\load-testing-saas-reframe\apps\admin\src\pages\run-detail\index.spec.tsx`
- Modify: `D:\CodexFolder\.worktrees\load-testing-saas-reframe\apps\admin\src\hooks\use-run-stream.ts`

- [ ] Rewrite the run-detail page into a "任务作战台" narrative.
- [ ] Localize stream errors and stream-state text.
- [ ] Translate visible tags, table headers, descriptions, and empty-state copy into Chinese.
- [ ] Verify the run-detail test fails before implementation, then passes after implementation.

## Task 5: Nodes And Reports Reframe

**Files:**
- Modify: `D:\CodexFolder\.worktrees\load-testing-saas-reframe\apps\admin\src\pages\nodes\index.tsx`
- Modify: `D:\CodexFolder\.worktrees\load-testing-saas-reframe\apps\admin\src\pages\reports\index.tsx`

- [ ] Rewrite nodes page headings and descriptions into operational Chinese.
- [ ] Rewrite reports page into "校准复盘" wording while preserving the existing metrics and recommendations.

## Task 6: Verification

**Files:**
- No code changes required

- [ ] Run `corepack pnpm --filter admin test`
- [ ] Run `corepack pnpm --filter admin build`
- [ ] Confirm the local stack still serves the console and that `/overview` reflects the new wording.
