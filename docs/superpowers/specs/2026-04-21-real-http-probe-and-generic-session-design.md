# Real HTTP Probe And Generic Session Design

## Context

The current load-testing stack can boot, plan a run, execute an agent, stream
telemetry, and complete a run, but the agent still uses a stub probe that
returns synthetic success. The result is a control-plane smoke test rather than
a real end-to-end pressure path against the sample ticketing backend.

At the same time, the sample backend still carries legacy WeChat-specific
authentication and payment flows:

1. customer login is exposed as `POST /api/auth/wechat/login`
2. payment intent and callback flows are modeled as WeChat JSAPI endpoints
3. environment configuration and contracts still expose `WECHAT_*` and
   `WechatPaymentIntent`

The approved direction is to solve both problems together:

1. replace the agent stub probe with a real HTTP workflow probe that executes
   against `apps/api`
2. remove WeChat-specific login and payment assumptions from the sample backend
   so the pressure-testing platform and sample API are both provider-agnostic

## Goals

1. Make the agent execute real HTTP requests against `apps/api`.
2. Support a stable V1 workflow of:
   `session bootstrap -> viewers -> catalog events -> event detail/tier -> draft order`.
3. Replace WeChat-specific customer login with a generic internal session
   bootstrap flow that works for local, preprod, and controlled load testing.
4. Reframe the sample payments module into a generic payment-intent sandbox so
   the sample backend no longer depends on WeChat-specific routes, contracts, or
   environment variables.
5. Preserve the existing control-plane lifecycle, run model, and phase planner
   so current planning, telemetry, reporting, and battle-station flows continue
   to work.

## Non-Goals

1. Driving real browser automation.
2. Integrating live third-party authentication providers.
3. Introducing a full customer registration product flow.
4. Redesigning the load-control phase model into a step graph in this round.
5. Adding account-pool management UI in this round.
6. Making payment-pressure testing part of the first HTTP probe rollout.

## Approved Approach

### Recommended Approach

Use a dedicated internal session bootstrap endpoint together with a stateful
HTTP workflow probe.

This approach keeps the existing load-control run model intact while upgrading
the execution path from synthetic success to real backend traffic. It also
separates controlled load-testing authentication from external providers, which
keeps local and preprod runs deterministic.

### Rejected Alternatives

1. Reuse `/api/auth/wechat/login` for load testing.
   This would keep the agent coupled to external code exchange, AppId/Secret
   configuration, and unstable provider behavior.
2. Pre-seed tokens in the database and skip login at runtime.
   This would be quick but would hide the login step from the workflow and make
   future multi-account scaling awkward.
3. Only rename WeChat symbols without changing behavior.
   This would leave the backend functionally provider-specific while merely
   hiding the coupling.

## Architecture

The final V1 path has four major pieces:

1. a generic session bootstrap flow in `apps/api`
2. a generic sample payment module in `apps/api`
3. a stateful HTTP workflow probe in `apps/load-control`
4. updated contracts and seeds that no longer encode WeChat-specific semantics

### Runtime Flow

```text
agent assignment
  -> bootstrap customer session
  -> fetch viewers
  -> create viewer if needed
  -> list published events
  -> fetch event detail
  -> choose session/tier
  -> create draft order
  -> report real telemetry and summary
```

## Generic Session Design

### Data Model

`CustomerAccount` becomes provider-neutral.

Current:

```text
CustomerAccount.wechatOpenId
CustomerIdentity.openId
```

New:

```text
CustomerAccount.accountKey
CustomerIdentity.accountKey
```

The `CustomerSession` model remains in place. The token, token hash, expiry, and
customer ownership semantics do not change.

### API

Delete:

```text
POST /api/auth/wechat/login
```

Add:

```text
POST /api/auth/session/bootstrap
```

The endpoint is an internal bootstrap route for the sample backend and
controlled load-testing flows.

Request headers:

```text
x-load-test-secret: <LOAD_TEST_INTERNAL_SECRET>
```

Request body:

```ts
{
  accountKey: string
  displayName?: string
}
```

Response:

```ts
{
  token: string
  customer: {
    id: string
    accountKey: string
  }
  expiresAt: string
}
```

### Behavior

1. If `LOAD_TEST_INTERNAL_SECRET` is missing, the route rejects all requests.
2. `accountKey` is treated as the stable synthetic customer identity.
3. The service upserts `CustomerAccount` by `accountKey`.
4. The service creates a fresh `CustomerSession` token and returns the same
   bearer-token semantics used by the existing `CustomerSessionGuard`.
5. The route does not create viewers or orders. Its only responsibility is
   session bootstrap.

### Security Boundary

This endpoint is intentionally internal-only.

1. It uses a dedicated secret, not `ADMIN_API_SECRET`.
2. It is intended for local, preprod, and controlled internal runs.
3. It should never be described as a public customer login flow in docs or UI.

## Generic Payment Sample Design

### Goal

Keep payment and fulfillment progression in the sample backend without binding
the backend to WeChat JSAPI semantics.

### Contract Change

Replace `WechatPaymentIntent` with a generic `PaymentIntent`.

Current contract shape is SDK-oriented and WeChat-specific. The new contract
should be sample-backend oriented:

```ts
{
  paymentId: string
  orderId: string
  method: 'EXTERNAL_PROVIDER'
  status: 'PENDING'
  intentToken: string
  expiresAt: string
}
```

The exact field names can vary slightly during implementation, but the intent
must remain provider-neutral and suitable for backend-driven sandbox flows.

### Payment Routes

Delete:

```text
POST /api/payments/wechat/intent
POST /api/payments/wechat/callback
```

Add:

```text
POST /api/payments/intents
POST /api/payments/intents/:paymentId/confirm
```

### Payment Behavior

`POST /api/payments/intents`

1. validates that the order belongs to the current customer
2. validates that the order is still pending payment
3. creates or returns a pending sample payment intent
4. returns a generic `PaymentIntent`

`POST /api/payments/intents/:paymentId/confirm`

1. marks the sample payment as successful
2. transitions the order to `PAID_PENDING_FULFILLMENT`
3. triggers the same downstream fulfillment event submission path already used
   by the sample backend

### Prisma Changes

The payment model stays because it still has value for order state progression,
but the provider-specific enum and naming need to be generalized.

Current:

```text
PaymentMethod.WECHAT_PAY
Payment.providerTxnId
```

Recommended V1 target:

```text
PaymentMethod.EXTERNAL_PROVIDER
Payment.externalTxnId
```

If renaming `providerTxnId` turns out to be too invasive for the first pass, the
database field may stay in place temporarily as an internal storage name, but
the API, service naming, and contracts must all become provider-neutral.

## HTTP Workflow Probe Design

### Probe Type

Replace the current stub `TargetProbe` default with a stateful
`HttpWorkflowProbe`.

The probe owns lightweight execution context:

```ts
{
  token?: string
  viewerId?: string
  eventId?: string
  tierId?: string
}
```

### Workflow Rules

The probe keeps the existing load-control pool model but performs real HTTP work
inside each probe call.

#### Query Pool

On each query request:

1. ensure a valid session token exists
2. `GET /api/catalog/events`
3. choose a published event
4. `GET /api/catalog/events/:eventId`
5. choose a session/tier
6. cache `eventId` and `tierId`

#### Order Submit Pool

On each order-submission request:

1. ensure a valid session token exists
2. ensure `tierId` exists, refreshing catalog context if necessary
3. `GET /api/viewers`
4. if no usable viewer exists, `POST /api/viewers`
5. `POST /api/orders/draft`

The viewer payload can be deterministic sample data derived from node id and
worker index so runs are reproducible.

#### Queue And Inventory Pools

The current control-plane model includes queue and inventory pools, but the
sample backend does not yet expose true queue or inventory lock endpoints.

V1 strategy:

1. keep these pools in the assignment model
2. allow the probe to no-op them or map them to lightweight catalog refreshes
3. do not invent fake queue or lock endpoints in this round

## Request Template Alignment

The old request-template defaults point at fictional paths. They need to be
replaced with paths aligned to the sample API:

1. auth bootstrap
2. viewers list/create
3. catalog event list
4. catalog event detail
5. draft order creation

The existing request-template structure does not currently model a multi-step
workflow, so V1 should keep the current outer schema and treat it as a pacing
and timeout envelope while the probe controls the real internal step sequence.

## Error Handling

### Probe Errors

1. Any non-2xx response marks the current request as failed.
2. `401` clears the cached token and forces re-bootstrap on the next attempt.
3. `404`, `400`, and `422` are reported as real failures rather than retried
   away invisibly.
4. Missing or stale `eventId`/`tierId` causes the probe to refresh catalog
   context.

### Bootstrap Errors

If the internal bootstrap secret is missing or invalid, the route fails fast and
the agent request is recorded as failed. This makes environment errors visible
through normal run telemetry.

### Payment Errors

Generic payment intent and confirm endpoints should continue using explicit
validation errors when the order does not belong to the customer, is already
paid, or is otherwise in the wrong state.

## Configuration

### New Environment Variables

Add:

```text
LOAD_TEST_INTERNAL_SECRET=
LOAD_TEST_AGENT_ACCOUNT_PREFIX=node-local-user
```

Optional implementation-time convenience knobs may be added for deterministic
viewer generation, but they should stay minimal in V1.

### Removed Environment Variables

Remove all `WECHAT_*` entries from `.env.example` and from sample-backend
documentation.

## Testing Requirements

### Backend

1. Add auth tests for the new session bootstrap flow.
2. Replace WeChat auth tests with generic session-bootstrap tests.
3. Replace WeChat payment tests with generic payment-intent and confirm tests.
4. Update Prisma-backed tests and fixtures for `accountKey` semantics.

### Contracts

1. Replace the WeChat payment contract test with a generic payment intent test.
2. Update customer session contract tests to assert `accountKey`.

### Agent

1. Add probe tests for token bootstrap, viewer ensure, catalog selection, and
   draft-order submission.
2. Add failure-path coverage for `401`, catalog misses, and order validation
   errors.

### End-To-End Verification

Successful rollout requires a real local run that proves:

1. the agent acquires a bearer token through the generic bootstrap endpoint
2. the agent performs real requests to:
   - `GET /api/viewers`
   - `POST /api/viewers`
   - `GET /api/catalog/events`
   - `GET /api/catalog/events/:eventId`
   - `POST /api/orders/draft`
3. the run still transitions to `COMPLETED`
4. telemetry and summaries reflect real HTTP outcomes rather than stub success

## Migration Strategy

1. Introduce schema and contract changes first.
2. Replace auth and payment modules with generic variants.
3. Update environment examples and docs.
4. Switch the agent default probe from stub to HTTP workflow.
5. Re-seed or migrate local sample data if necessary.

This order keeps the backend stable before the agent begins depending on the
new endpoints.

## Success Criteria

This project is successful when:

1. no WeChat-specific auth or payment routes remain in the sample backend
2. `.env.example` no longer advertises `WECHAT_*` configuration
3. contracts and service naming are provider-neutral
4. the default agent executes real HTTP requests against `apps/api`
5. a local run can complete the approved V1 workflow using real backend traffic
6. the existing control-plane run lifecycle, telemetry, and reporting continue
   to function
