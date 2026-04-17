# Load Testing SaaS Reframe Design

## Context

This document reframes the current repository around the product the team actually wants to build:

1. an internal load-testing SaaS for authorized ticketing-system validation
2. a cloud-node execution platform for coordinated multi-region protocol-level testing
3. a sample system-under-test already present in the repository for integration and rehearsal

The repository currently contains four top-level applications:

- [apps/load-control](D:\CodexFolder\apps\load-control)
- [apps/admin](D:\CodexFolder\apps\admin)
- [apps/api](D:\CodexFolder\apps\api)
- [apps/miniapp](D:\CodexFolder\apps\miniapp)

The approved product framing is no longer "ticketing platform with a side testing tool." The approved framing is:

- `primary product`: internal load-testing SaaS
- `primary execution path`: cloud protocol agents
- `primary operator experience`: task orchestration plus real-time observability
- `embedded sample target`: the ticketing backend in [apps/api](D:\CodexFolder\apps\api)

The miniapp is no longer part of the product center for this design.

## Approved Decisions

The following decisions are already approved and should be treated as fixed input for this spec:

1. `product boundary`
   The platform is an internal load-testing SaaS, not an end-user ticket-buying product.
2. `target scope`
   The first target is the existing internal ticketing backend sample in [apps/api](D:\CodexFolder\apps\api).
3. `organizational scope`
   Version 1 serves a single internal team, not multiple business lines or external customers.
4. `node strategy`
   Execution is cloud-node-first, not desktop-first.
5. `agent strategy`
   Version 1 uses protocol-level agents, not browser automation agents.
6. `console priority`
   The console must support both orchestration and real-time observation, with real-time observation visible on the main operating surface.

## Product Definition

The approved product is a three-part internal platform:

1. `Control Console`
   A web console for operators to define runs, start and stop tests, observe node health, inspect active phases, and review results.
2. `Control Plane`
   A backend service that stores run definitions, validates policy gates, plans phase budgets, assigns work to nodes, aggregates telemetry, and generates reports.
3. `Agent Fleet`
   A set of cloud protocol agents that execute assigned traffic patterns and continuously report telemetry and final summaries.

The ticketing backend in [apps/api](D:\CodexFolder\apps\api) is treated as an embedded system-under-test, not as the primary product itself.

## Goals

This design must achieve the following outcomes:

1. Give internal testers a single system to create, run, observe, and evaluate high-fidelity load tests.
2. Make live run visibility first-class, so operators can see current phase, node health, pressure level, and failure behavior while a run is active.
3. Preserve structured task orchestration, so operators can consistently create runs, choose node pools, apply scenarios, and control execution.
4. Reuse the existing ticketing backend as a sample target for rehearsals, validation, and product demos.
5. Keep the first version simple enough for a single internal team while leaving clean boundaries for later growth.

## Non-Goals

This design does not include the following in version 1:

1. a public or customer-facing load-testing product
2. browser-driven agent execution at scale
3. billing, quotas, or multi-tenant commercial controls
4. a full security approval workflow platform
5. a requirement that the miniapp remain a first-class deployment target for the testing product

## Product Reframe

The repository should be understood with these new roles:

1. [apps/admin](D:\CodexFolder\apps\admin)
   Reframed from "ticketing admin console" into the load-testing SaaS control console.
2. [apps/load-control](D:\CodexFolder\apps\load-control)
   Promoted from a technical helper service into the main control-plane backend for the product.
3. [apps/api](D:\CodexFolder\apps\api)
   Treated as the embedded sample ticketing backend and default system-under-test.
4. [apps/miniapp](D:\CodexFolder\apps\miniapp)
   Downgraded to a non-core module for this product line. It may remain in the repo, but it is not part of the core control, execution, or operator loop.

## Architecture Overview

The approved version 1 architecture contains five logical areas:

1. `Control Console`
   The operator-facing SaaS web application.
2. `Control Plane`
   The orchestration, validation, telemetry, and reporting backend.
3. `Agent Fleet`
   Cloud protocol agents grouped into node pools by region and role.
4. `System Under Test`
   The ticketing backend sample in [apps/api](D:\CodexFolder\apps\api).
5. `Runtime Infrastructure`
   Data stores and streaming infrastructure for state, telemetry, and coordination.

## Control Console

The control console should become the main product entry point.

### Core Principles

1. The home page is not a static reporting page.
2. The home page is a live operations surface for active runs.
3. Run orchestration remains a core product feature, not a hidden sub-flow.
4. The console should feel like a "test operations room" rather than a CRUD-heavy admin dashboard.

### Approved Top-Level Areas

The console should expose these version 1 areas:

1. `Overview`
   Live view of currently active runs, node health, current phase, aggregate QPS, error rate, major alerts, and quick actions.
2. `Runs`
   Run creation, run listing, templates, phase editing, node-pool selection, and start/stop actions.
3. `Run Detail`
   A single run's live execution surface, including phase timeline, node states, telemetry charts, event stream, and completion progress.
4. `Node Pools`
   Cloud node inventory by region, role, network profile, capacity, and current allocation.
5. `Reports`
   Baseline versus production comparisons, calibration outcomes, score breakdowns, and exportable summaries.

### Recommended Routes

The version 1 route model should become:

- `/overview`
- `/runs`
- `/runs/:runId`
- `/nodes`
- `/reports/:baselineRunId/:productionRunId`

This route set should replace the current ticket-operations navigation in [apps/admin/src/router.tsx](D:\CodexFolder\apps\admin\src\router.tsx).

## Control Plane

The control plane remains centered in [apps/load-control](D:\CodexFolder\apps\load-control), but its product role changes from "support service" to "platform core."

### Required Responsibilities

1. register and track node availability
2. create and persist runs
3. validate policy gates before planning and before execution
4. transform run definitions into phase assignments
5. coordinate run start and stop actions
6. ingest real-time telemetry
7. ingest final node summaries
8. aggregate live status for the console
9. generate post-run reports and calibration output

### Required Internal Domains

The version 1 control plane should contain the following functional domains:

1. `Run Control`
   Run lifecycle, node registration, assignment ownership, start and stop coordination.
2. `Scenario Planning`
   Phase budget calculation, pool allocation, node-level assignment generation.
3. `Policy Guard`
   Validation for production-like modes, whitelist constraints, and write-path controls.
4. `Realtime Telemetry`
   Live node metrics ingestion, aggregation, stream fan-out, and active run status updates.
5. `Reporting`
   Summary validation, score generation, calibration comparison, and operator-facing results.

The existing modules in [apps/load-control/src/modules](D:\CodexFolder\apps\load-control\src\modules) already cover part of this structure, but `Realtime Telemetry` must become a first-class addition rather than an implicit side effect of summary upload.

## Agent Fleet

Version 1 agents are cloud protocol agents.

### Responsibilities

Each agent must:

1. register itself with the control plane
2. publish region, role, and capacity metadata
3. fetch its assigned run work
4. execute protocol-level traffic within phase windows
5. continuously emit live telemetry during execution
6. emit a final validated summary at run completion

### Explicit Non-Responsibilities

Version 1 agents do not need to:

1. emulate complete browser flows
2. own complex local UI
3. store long-lived state between runs
4. become a general-purpose remote execution framework

## System Under Test

The default system-under-test is [apps/api](D:\CodexFolder\apps\api).

In this design it plays three roles:

1. a demo target for the internal load-testing product
2. a rehearsal environment for end-to-end system wiring
3. a validation sample for queueing, inventory, checkout, refund, and fulfillment behavior

The system-under-test is not part of the load-testing control surface, but it is a first-class integration target.

## Runtime Infrastructure

Version 1 should use:

1. `Postgres`
   Persistent state for runs, node pools, templates, summaries, reports, and auditable operator actions.
2. `Redis`
   Short-lived live state, telemetry fan-out, active-run snapshots, and coordination support for real-time updates.

The current repository already provides Postgres and Redis in [docker-compose.yml](D:\CodexFolder\docker-compose.yml), but persistence must move beyond the current in-memory-only control-plane storage model for this product framing to be durable.

## Primary User Flow

A complete version 1 run should follow this lifecycle:

1. An operator creates a run from the console.
2. The control plane validates the run and stores it.
3. The scenario planner generates per-node assignments.
4. Node agents retrieve assignments and prepare for execution.
5. The operator starts the run.
6. Agents execute phase windows and emit live telemetry.
7. The control plane aggregates telemetry and streams live state to the console.
8. Agents upload final summaries.
9. The run transitions to completed state only after summary validation passes.
10. The operator reviews results and calibration output in the reports surface.

## Data Flow

The approved data flow is:

1. `Console to Control Plane`
   Run definitions, node-pool selection, start/stop commands, report fetches.
2. `Control Plane to Agents`
   Assignment payloads, policy constraints, run timing, stop or scale-down signals.
3. `Agents to System Under Test`
   Protocol traffic for the approved scenario.
4. `Agents to Control Plane`
   Live telemetry and final summary payloads.
5. `Control Plane to Console`
   Live aggregate status, alerts, phase progression, node health, and report results.

## Realtime Observation Model

Real-time observation is a top-priority capability and must shape the product surface.

### Minimum Live Run Signals

The console must be able to show these live signals for an active run:

1. current run state
2. current phase
3. number of active versus unhealthy nodes
4. aggregate QPS
5. aggregate error rate
6. key latency views
7. node-level drift or degradation
8. recent operator-visible alerts or guardrail actions

### Product Consequence

The console homepage should prioritize active-run awareness over static administration. Operators should not need to open multiple pages just to know whether a run is healthy.

## Orchestration Model

Task orchestration remains equally important and should be treated as a peer to observability.

### Minimum Version 1 Orchestration Actions

Operators must be able to:

1. create a run
2. choose a scenario template
3. choose a node pool
4. review the planned phase structure
5. start a run
6. stop a run
7. inspect run history
8. duplicate a previous run as a new draft

The product should not treat orchestration as a hidden backend-only workflow.

## Current Repository Mapping

### Reuse Directly

1. [apps/load-control](D:\CodexFolder\apps\load-control)
   Keep as the control-plane backend and extend it with persistent state and real-time telemetry.
2. [apps/api](D:\CodexFolder\apps\api)
   Keep as the embedded sample target.
3. [packages/contracts](D:\CodexFolder\packages\contracts)
   Continue using shared schemas for run definitions, summaries, and report payloads.

### Repurpose

1. [apps/admin](D:\CodexFolder\apps\admin)
   Replace current ticket-operations pages with load-testing control-console pages.

### Deprioritize

1. [apps/miniapp](D:\CodexFolder\apps\miniapp)
   Keep in the repo if useful, but remove it from the primary product narrative and deployment story.

## Deployment Model

The deployment shape for this reframed product should be:

1. `Control Console`
   A web frontend deployed as the operator-facing SaaS UI.
2. `Control Plane`
   A dedicated backend service, separate from the system-under-test.
3. `Agent Pool`
   One or more cloud node groups deployed by region.
4. `System Under Test`
   The sample ticketing backend deployed as a separate service.
5. `Postgres and Redis`
   Shared supporting infrastructure.

This means the correct product deployment story is not "deploy the system as a miniapp." The correct story is "deploy a web control surface, a control backend, cloud agents, and a sample target backend."

## Version 1 Success Criteria

Version 1 is successful when all of the following are true:

1. Operators can create and start a run from the console.
2. Operators can observe active run health and phase progress without waiting for post-run summaries.
3. Cloud agents can execute planned protocol scenarios and stream telemetry.
4. The control plane can validate and store final summaries.
5. Reports can be generated from completed runs.
6. The product narrative, navigation, and deployment model clearly describe a load-testing SaaS rather than a customer ticketing product.

## Risks

The main version 1 risks are:

1. retaining too much ticketing-admin UX in the console, which would blur the product identity
2. treating telemetry as an afterthought, which would weaken the real-time operating surface
3. keeping control-plane state in memory, which would make runs and reports unreliable
4. letting the miniapp remain in the product center, which would confuse deployment and ownership

## Recommended Next Step

The next approved step after this design is to write an implementation plan that:

1. repurposes the admin frontend into the control console
2. adds persistent run and node state to the control plane
3. adds a real-time telemetry path
4. formalizes node-pool and run orchestration APIs
5. preserves the sample target backend in [apps/api](D:\CodexFolder\apps\api)

That plan should treat the console and telemetry path as version 1 product-critical work, not as polish items.
