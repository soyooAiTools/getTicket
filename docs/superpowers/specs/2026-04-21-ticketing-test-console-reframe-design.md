# Ticketing Test Console Reframe Design

## Context

The current admin console is technically functional, but the operator-facing
language still presents the product as a generic load-testing SaaS. Internal
testers who open `http://localhost:5173/overview` do not immediately see where
to create and run ticket-grabbing rehearsal tasks because the UI is framed in
terms of generic runs, operator summaries, and calibration reports.

The approved direction is to keep the existing backend model and execution
capabilities, but reframe the console into a ticket-grabbing test operations
surface. This is a language, information architecture, and workflow change, not
a ground-up backend redesign.

## Goals

1. Make the console read like a ticket-grabbing test workstation rather than a
   generic load-testing dashboard.
2. Preserve the existing `run`, `node pool`, `telemetry`, and `report`
   lifecycle so the product remains usable immediately.
3. Clarify where operators create tasks, start tasks, watch live execution, and
   review replay or calibration outcomes.
4. Localize the core control surface into Chinese for the internal team.

## Non-Goals

1. Adding a new account-pool system.
2. Adding vendor-specific ticketing adapters.
3. Introducing a full i18n framework or bilingual toggle.
4. Replacing the current control-plane APIs or data contracts.

## Approved Product Reframe

The console should be presented as a "抢票测试操作台" built on top of the
existing control-plane primitives.

Existing backend entities keep their current responsibilities:

1. `run`
   Remains the persisted execution record, but is presented as a "抢票任务".
2. `scenario template`
   Remains the reusable definition, but is presented as a "任务模板".
3. `node pool`
   Remains the execution resource pool, but is presented as a "节点池".
4. `live snapshot`
   Remains the runtime telemetry view, but is presented as live battle-state
   data in a "任务作战台".
5. `calibration report`
   Remains the comparative score output, but is presented as "校准复盘".

## Information Architecture

The console keeps the current route skeleton but changes the operator-facing
meaning:

1. `/overview`
   Presented as "作战总览". This page answers what is running now, what capacity
   is available, and what the operator should do next.
2. `/runs`
   Presented as "抢票任务". This page becomes the primary entry point for
   creating and managing task executions.
3. `/runs/:runId`
   Presented as "任务作战台". This page becomes the real-time execution surface
   for one task.
4. `/nodes`
   Presented as "节点池". This page shows available regions, resource pools, and
   registered runtime nodes.
5. `/reports/:baselineRunId/:productionRunId`
   Presented as "校准复盘". This page keeps the comparative output but shifts the
   narrative toward rehearsal review and adjustment.

## Page-Level Requirements

### 作战总览

The overview page must:

1. highlight active tasks and recently completed tasks
2. expose quick navigation into task creation and task drill-down
3. describe templates and node pools in operational language
4. avoid generic "operator" wording

### 抢票任务

The runs page must:

1. use task-oriented labels for creation fields and actions
2. clearly distinguish create, plan, start, stop, and inspect actions
3. explain run fields in terms internal testers expect, such as target address,
   batch tag, global concurrency, and per-node concurrency

### 任务作战台

The run detail page must:

1. present live execution as a battle station, not a generic record detail
2. show current status, current phase, live node states, and aggregate metrics
3. keep phase plans, assignments, summaries, and alerts accessible in one page
4. translate run status, stream state, mode, and role labels into Chinese

### 节点池

The nodes page must:

1. present seeded pools and registered nodes in resource language
2. describe network profiles in a way operators can quickly read
3. avoid purely technical inventory wording where a more operational term fits

### 校准复盘

The reports page must:

1. explain that the report compares one rehearsal against another
2. keep the four scores visible
3. frame recommendations as adjustments for the next rehearsal

## Shared Labeling Layer

The console should introduce a lightweight shared label mapper rather than a
full i18n stack.

This mapper should cover at least:

1. run status values
2. validation mode values
3. node role values
4. node health status values
5. stream states

The mapper should live in the admin app and be reusable across overview, runs,
run detail, nodes, and reports pages.

## Testing Requirements

1. Update existing admin view tests so they assert the new Chinese product
   language for the overview and run-detail pages.
2. Update router tests so the control shell reflects the new console identity.
3. Add or extend tests only where the reframe changes visible behavior.

## Success Criteria

This reframe is successful when:

1. an internal tester can open `/overview` and immediately understand this is a
   ticket-grabbing test operations console
2. the route and page labels clearly show where to create and run a task
3. the live detail page feels like a task battle station instead of a generic
   backend detail page
4. the current backend flows still work without API changes
