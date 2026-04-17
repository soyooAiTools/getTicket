# Ticketing High-Fidelity Load Testing Design

## Context

This document defines the approved design for an internal, authorized high-fidelity load-testing system for the ticketing platform.

The target is not a generic benchmark tool. The target is a controlled testing system that can validate three concerns with higher realism than ordinary pre-production stress tests:

1. network-latency realism across multiple regions
2. business concurrency realism across queueing, inventory, and order-submission paths
3. multi-node concurrency realism under coordinated peak-start conditions

The agreed strategy is `Plan B`: use pre-production as the main load-testing environment, then connect to production through tightly controlled observation, whitelist, and gray-validation windows to calibrate the model against real conditions.

## Agreed Scope

The approved scope includes the following:

- a Hong Kong control plane for orchestration and result aggregation
- multiple geographically distributed load nodes, with Hong Kong as the anchor region
- realistic sale-phase traffic modeling rather than flat benchmark traffic
- pre-production large-scale replay and stress testing
- production observation and restricted real-environment calibration
- unified scoring and calibration loops between pre-production and production
- isolated tagging, inventory, accounts, and reporting for online validation runs

The system is intended for internal testing of the authorized ticketing platform only.

## Goals

The design must achieve these outcomes:

1. Reproduce sale-window pressure with enough realism that pre-production findings are useful for production decisions.
2. Measure the effect of different regional network conditions on queueing, inventory locking, and order submission.
3. Compare behavior between anchor nodes and edge nodes during the same release window.
4. Quantify the gap between pre-production results and production results, then use that gap to improve the next round of testing.
5. Give the team a controlled way to run online validation without polluting live operations data or risking uncontrolled impact.

## Non-Goals

This design does not pursue the following:

1. A full adversarial red-team system that reproduces every external abuse technique.
2. Unrestricted production stress runs against real inventory.
3. A permanent feature-rich console in the first iteration.
4. End-user facing product features or customer workflows.
5. Broad capacity planning for every future business line before this testing loop is proven.

The first iteration should prefer controlled realism over breadth.

## Success Criteria

The testing system is considered successful when all of the following are true:

1. It can run the same approved scenario against pre-production and online validation environments with shared orchestration and reporting.
2. It can distinguish node-side effects from application-side effects using node timing, latency, and synchronization data.
3. It can isolate and report queueing pressure, inventory-lock contention, rollback behavior, and recovery behavior as separate signals.
4. It can stop or scale down an online validation run through hard guardrails rather than manual guesswork.
5. It can produce a calibration report that explains where pre-production differs from production and which parameters should be updated for the next run.

## Testing Principles

The approved design follows these principles:

1. `Realistic phases over flat pressure`
   Sale traffic should be modeled as a timed curve with warm-up, ramp, spike, high-pressure decay, and recovery.
2. `Multi-pool concurrency over single-QPS reporting`
   Query, queue polling, inventory lock, and order submission should be measured separately because they stress different parts of the system.
3. `Anchor-and-edge node design over symmetric node assumptions`
   Hong Kong acts as the anchor baseline, while other regions provide comparison profiles rather than pretending all nodes are equal.
4. `Pre-production first, production to calibrate`
   Production is used to improve the model, not to replace the main load-testing environment.
5. `Isolation first`
   Online validation must separate traffic identity, inventory, accounts, and reporting from normal operations.

## Architecture Overview

The system is split into four layers and one feedback loop:

1. `Control Layer`
   A Hong Kong orchestration service schedules runs, groups nodes, distributes scenarios, applies guardrails, and aggregates results.
2. `Execution Layer`
   Lightweight node agents in multiple regions receive instructions, prewarm connections, execute approved traffic scripts, and report node-local metrics.
3. `Target Layer`
   The main target is the existing backend in [apps/api](D:\CodexFolder\apps\api), running in a production-like pre-production topology, with limited and isolated production validation paths.
4. `Observation Layer`
   Unified metrics collect node, gateway, queueing, inventory, order, database, cache, and message-backlog signals.
5. `Calibration Loop`
   Production observation and whitelist validation runs update pre-production latency, concurrency, and contention parameters for later rehearsals.

## Repository Placement

The recommended code layout is:

1. `apps/load-control`
   Orchestration logic, shared execution types, run scheduling, node registration, and guardrail controls.
2. `tests/perf`
   Scenario definitions, runtime profiles, calibration rules, reporting templates, and automated perf-test entry points.
3. `apps/admin` later, only if a visual console becomes necessary after the command-driven flow proves useful.

The first delivery should not embed the load-testing control path into [apps/api](D:\CodexFolder\apps\api). Keeping the control plane separate reduces coupling and makes rollback safer.

## Core Components

### Orchestrator

The orchestrator runs in Hong Kong and owns the following responsibilities:

- define test runs and scenario assignments
- group nodes by role and region
- align node clocks and readiness state before a run
- distribute concurrency curves and time windows
- enforce per-run, per-node, and global limits
- trigger emergency stop or graceful scale-down
- aggregate results and emit run summaries

The orchestrator must act as a control plane, not as a traffic generator.

### Node Agent

Each load node runs a lightweight agent that:

- registers with the orchestrator
- reports network and timing health
- prewarms approved target connections
- executes assigned scenario steps
- records local send timing, latency, and error data
- uploads structured run evidence back to the control plane

The node agent should remain stateless between runs except for controlled local caches used for connection warm-up.

### Scenario Engine

The scenario engine defines realistic sale behavior in timed stages instead of flat benchmark loops.

The approved first scenario contains five phases:

1. `T-30m to T-5m`
   Low-frequency warm-up traffic for browsing, status checks, and baseline path health.
2. `T-5m to T-10s`
   Ramping traffic that increases query frequency, refreshes session state, and warms critical paths.
3. `T-10s to T+5s`
   Peak-start window with the highest queue-entry, inventory-contention, and order-submission pressure.
4. `T+5s to T+60s`
   High-pressure decay that includes retries, queue polling, partial failures, and rollback effects.
5. `T+60s onward`
   Recovery and tail observation to measure stabilization after the initial burst.

### Shadow Calibrator

The calibrator compares pre-production results with production observation and restricted validation data.

It should update:

- regional latency distributions
- TLS and connection-establishment timing assumptions
- hotspot request concentration
- queueing wait distributions
- inventory-lock contention ratios
- node-start synchronization tolerance

Calibration data should change explicit configuration values rather than hiding adjustments inside scenario code.

### Observability

The observation layer should collect four families of signals:

1. `Node signals`
   RTT, TLS timing, clock skew, startup skew, send cadence, and local failure categories.
2. `Gateway and edge signals`
   QPS, rate limiting, error rate, response distributions, and queue-entry behavior.
3. `Business signals`
   queue wait distribution, inventory-lock success rate, rollback rate, idempotency conflict rate, and order-submission success rate.
4. `System signals`
   CPU, memory, cache hit rate, database hot rows, lock contention, and message backlog.

## Traffic Model

The traffic model must look like a release window rather than a synthetic benchmark.

The agreed design uses separate concurrency pools:

1. `query concurrency`
2. `queue polling concurrency`
3. `inventory-lock concurrency`
4. `order-submission concurrency`

This separation is required because each pool stresses different resources and failure modes. A single total-QPS number is not sufficient for diagnosis.

## Node Strategy

Nodes should be split into three roles:

1. `Hong Kong anchor nodes`
   These provide the main baseline and carry the most important comparative load.
2. `Overseas edge nodes`
   These model regional variation in latency, jitter, and distance from the primary baseline.
3. `Control nodes`
   These remain stable across runs and exist to detect whether result changes come from the platform or from uncontrolled node variation.

Runs should begin with synchronized readiness, but not with perfectly rigid zero-jitter starts. Controlled micro-jitter should be introduced to better match real user populations while preserving comparable timing.

## Network Profiles

Each node group should use explicit network profiles instead of a single fixed delay number.

The initial profile set should include:

1. `low-latency stable`
2. `medium-latency light-jitter`
3. `medium-high-latency heavy-jitter`
4. `occasional loss and retransmission`

The purpose is to explain how the system behaves under realistic network variance, not only under average latency.

## Production Validation Design

Production access is part of the approved design, but only through isolated validation modes.

### Online Validation Modes

1. `Observation mode`
   Read-only or near-read-only probing that captures live network and queueing characteristics without exercising full write paths.
2. `Whitelist full-path mode`
   Controlled end-to-end validation using whitelist events, whitelist accounts, and isolated inventory pools so queueing, lock, submit, and rollback behavior can be observed safely.
3. `Gray validation mode`
   A smaller-scale production run used only after observation and whitelist mode are stable, to compare model assumptions with controlled live behavior.

### Isolation Requirements

Every online validation run must isolate:

1. `traffic identity`
   All requests carry a clear run identifier, node identifier, scenario phase, and test classification.
2. `inventory resources`
   Validation uses shadow inventory or dedicated whitelist pools rather than normal sale inventory.
3. `account identity`
   Test accounts, devices, and node identities are managed independently of normal user activity.
4. `results and reporting`
   Validation orders, metrics, alerts, and reports are separated from normal operational views.

## Online Guardrails

The production validation path must define hard controls before any run begins.

Every run should declare:

- maximum concurrency per node
- maximum global QPS
- maximum duration per stage
- maximum validation inventory consumption
- automatic stop thresholds

Automatic stop thresholds should include:

- abnormal gateway error-rate increase
- uncontrolled queue growth
- abnormal inventory-lock failure increase
- database or queue-backlog saturation
- node loss or excessive clock skew

The Hong Kong control plane must be able to stop all agents quickly and record the reason for the stop.

## Scoring Model

Results should be judged using four scores rather than a single pass/fail output:

1. `Realism score`
   How close pre-production distributions are to online validation distributions for latency, queueing, inventory-lock success, and node-start behavior.
2. `Capacity score`
   How well the platform remains stable at each release phase, including error-rate behavior and recovery time.
3. `Fairness score`
   How evenly the platform behaves across different network profiles and node groups.
4. `Control score`
   How reliable the testing system itself is, including time sync, orchestration accuracy, and emergency-stop behavior.

## Recommended Thresholds

The agreed first-pass thresholds are:

- key pre-production versus production deviations should remain within `15%`
- peak-phase errors and timeouts should show explainable threshold behavior rather than random instability
- stop controls should trigger and recover as configured
- every incident in a run should be traceable to node, phase, request pool, and platform signal

If these conditions are not met, either the system under test or the testing system itself needs revision before wider adoption.

## PoC Scope

The first PoC should stay intentionally narrow and prove the feedback loop, not the final scale target.

### Included in the PoC

1. one Hong Kong orchestrator instance
2. three node groups:
   - Hong Kong anchor group
   - one near-Asia overseas group
   - one long-distance overseas group
3. one complete release-window scenario
4. one pre-production large-scale run
5. one production observation run
6. one production whitelist full-path run
7. one unified report that compares pre-production and production outputs

### Required PoC Outputs

1. `Network profile report`
   Compare actual node behavior by region and profile.
2. `Concurrency stability report`
   Show where the system destabilizes during the release curve.
3. `Calibration parameter table`
   List the exact parameters that should be updated before the next rehearsal.

## Recommended Implementation Sequence

The implementation order should be:

1. build the Hong Kong orchestrator and node-agent registration path
2. define the first shared scenario format and staged concurrency model
3. add node metrics, timing capture, and result aggregation
4. connect pre-production target execution
5. add production observation mode with strict tagging
6. add whitelist full-path validation with isolated inventory and account pools
7. generate calibration reports and scoring outputs

This order delivers a working loop quickly without waiting for a full visual console.

## Open Operational Requirements

Before implementation begins, the team should prepare the following non-code inputs:

1. approved production validation windows
2. whitelist event or shadow-inventory strategy
3. test-account management rules
4. run-approval and emergency-stop ownership
5. observability destinations and report recipients

These are operational prerequisites, not unresolved design gaps.

## Recommended Next Step

The next implementation slice should build the minimum closed loop:

1. `Hong Kong orchestrator`
2. `multi-node agents`
3. `one release-window scenario`
4. `pre-production execution`
5. `production observation and whitelist validation`
6. `realism, capacity, fairness, and control scoring`

This is the smallest useful version that can answer whether the model is trustworthy enough to guide future sale-window readiness work.
