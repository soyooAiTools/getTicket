# Ticket Task Metadata And Console Upgrade Design

## Context

The admin console has already been reframed into a Chinese ticket-grabbing test
console, but two important gaps remain:

1. default templates, node pools, and local seed data still look like generic
   technical fixtures instead of realistic ticket-task defaults
2. the task creation page is still a renamed run form rather than a true
   ticket-task configurator with event, ticket tier, node strategy, and
   execution strategy

The approved direction is to keep the existing run lifecycle, control-plane
APIs, and execution model, while introducing a structured ticket-task metadata
layer and using that layer to power a more realistic creation, listing, and
battle-station experience.

## Goals

1. Add a structured `ticketTask` payload to run definitions.
2. Make default templates and node pools read like realistic ticket-task
   defaults in Chinese.
3. Upgrade the task creation page so operators configure event, ticket tier,
   node strategy, and execution strategy directly.
4. Surface the new ticket-task metadata in the task list and task battle
   station.
5. Keep the current control-plane lifecycle intact so existing create, plan,
   start, stop, live snapshot, and report flows continue to work.

## Non-Goals

1. Adding account-pool management.
2. Adding vendor-specific ticketing adapters.
3. Adding browser automation flows.
4. Replacing the control-plane run model with a new top-level task resource.

## Approved Data Model

The existing `LoadTestRunDefinition` keeps its current fields and gains a new
structured `ticketTask` object.

### ticketTask

The `ticketTask` object contains four sections:

1. `event`
   Business context for the rehearsal target.
2. `ticket`
   The ticket tier and quantity to simulate.
3. `nodeStrategy`
   Which pool to use and how nodes should be launched.
4. `executionStrategy`
   Which part of the purchase flow to target and what pacing controls to use.

### Proposed Shape

```ts
ticketTask: {
  event: {
    platform: string
    eventName: string
    city?: string
    venue?: string
    sessionLabel: string
    saleStartsAt?: string
  }
  ticket: {
    tierLabel: string
    priceLabel?: string
    zoneLabel?: string
    quantity: number
  }
  nodeStrategy: {
    poolId: string
    launchMode: 'SYNC_WITH_JITTER' | 'STAGGERED'
    preferredRegions?: string[]
    expectedNodeCount?: number
  }
  executionStrategy: {
    objective: 'QUEUE_ENTRY' | 'LOCK_ONLY' | 'FULL_SUBMIT'
    prewarmSeconds: number
    workerLaunchIntervalMs?: number
    queuePollIntervalMs?: number
    lockRetryLimit?: number
    orderSubmitLimit?: number
  }
}
```

## Default Data Reframe

The product should no longer seed generic English catalog names.

### Node Pools

The default pools should become:

1. `香港核心节点池`
2. `香港观测节点池`

These names should be consistent in:

1. application-level default control catalog
2. local SQL seed script
3. any admin UI that renders the seeded data

### Scenario Templates

The default templates should become:

1. `预发开售窗口演练`
2. `只观测冒烟演练`
3. `开售瞬时锁票演练`

Each template should include a realistic default `ticketTask` payload so the
console opens with business-shaped defaults instead of abstract test records.

## Console Upgrade

### Task Creation Page

The `/runs` page should become a ticket-task configurator with four sections:

1. `场次信息`
   platform, event name, city, venue, session, sale time
2. `票档目标`
   tier, price, zone, quantity
3. `节点策略`
   node pool, launch mode, preferred regions, expected node count
4. `执行策略`
   objective, prewarm seconds, global QPS, per-node concurrency, launch interval,
   queue polling interval, retry limit, submit limit

The page should keep a top summary strip that condenses the current task into a
single readable line.

The page should expose three actions:

1. `保存任务草稿`
2. `创建并规划`
3. `创建、规划并启动`

### Task List

The task list should surface ticket-task metadata directly:

1. event name and session
2. ticket tier and quantity
3. node pool
4. execution objective
5. status
6. update time

The list should not rely on `runId` as the primary human-readable identity.

### Task Battle Station

The task detail page should add a dedicated ticket-task summary block that shows:

1. event name
2. platform
3. session
4. venue
5. tier and quantity
6. node pool and launch mode
7. execution objective

This summary should sit above the existing live metrics, phase plan, node
states, and summaries.

## Compatibility Strategy

The control plane should continue accepting existing run definitions. The new
`ticketTask` field becomes required for newly seeded templates and newly created
tasks from the console, but old runs without the field must not crash the UI.

The admin app should render safe fallbacks when `ticketTask` is absent.

## Testing Requirements

1. Add contract coverage for the new `ticketTask` schema.
2. Add or update tests for seeded catalog defaults where practical.
3. Add or update admin page tests for the new task-oriented UI wording and
   ticket-task summary rendering.
4. Re-run admin test and build.

## Success Criteria

This upgrade is successful when:

1. the default catalog data looks like realistic Chinese ticket-task defaults
2. creating a task feels like configuring a real ticket rehearsal, not filling
   in a generic run form
3. the task list and battle station surface business context before low-level
   technical identifiers
4. existing plan/start/stop/live/report flows continue to work
