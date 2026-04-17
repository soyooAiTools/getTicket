# Ticketing Persistence Upgrade Design

## Goal

Upgrade the current ticketing MVP from synthetic, in-memory responses to a database-backed flow for the core business path:

- viewer creation and listing
- draft order creation
- payment callback state transitions
- fulfillment state transitions
- refund state transitions

The intent is not to finish every production concern in one pass. The intent is to make the current API/app skeleton share real state through PostgreSQL so the main ticketing flow becomes traceable and demoable end to end.

## Current Problem

The repo already has page flow, API routes, state-machine enums, and Prisma schema groundwork, but the core modules still return computed payloads without persistence. That causes three practical gaps:

1. A created viewer cannot be fetched later.
2. Order/payment/fulfillment/refund transitions do not accumulate into a shared order history.
3. The frontend and admin experiences can only render placeholders, not state backed by stored records.

## Scope

This upgrade covers:

- wiring API modules to Prisma and PostgreSQL
- persisting viewers
- persisting draft orders and order items
- persisting payment records and advancing order status on payment callback
- persisting fulfillment events and advancing order status on issuance
- persisting refund requests/events and advancing order status on refund processing/completion
- minimal schema reconciliation so the current API contract can be represented in the database

This upgrade does not cover:

- full WeChat auth/session persistence
- strict inventory reservation and stock deduction transactions
- per-event purchase-limit enforcement from a true policy source
- full admin data-table rewrites
- production-grade id-card masking/query search features
- full upstream integration behavior beyond current callback scaffolding

## Recommended Approach

Use Prisma directly in the Nest API and keep the implementation intentionally thin.

The API will gain a shared Prisma access layer, then each business module will persist its own records while preserving the current controller shape as much as practical. This is the smallest step that converts the existing system from mapper-style stubs into a real stateful MVP.

## Key Design Decisions

### 1. Temporary User Scope

The repo does not yet have a real persisted user/session model that matches the miniapp flow. To avoid blocking persistence on an auth rewrite, this upgrade uses a temporary user-scope rule:

- business reads/writes are scoped by a client-provided `userId`
- write endpoints continue accepting that user scope from current request bodies where already present
- `GET /viewers` will accept `userId` as a query parameter in this phase
- miniapp pages that need persisted user data will pass a stable temporary user id until auth persistence is added

This is an explicit transition design, not the final identity architecture.

### 2. Persist the Main State Machine, Not Every Optimization

Order progression is the critical missing capability, so this upgrade persists state transitions first:

- `PENDING_PAYMENT`
- `PAID_PENDING_FULFILLMENT`
- `TICKET_ISSUED`
- `REFUND_REVIEWING`
- `REFUND_PROCESSING`
- `REFUNDED`

Inventory reservation timing, purchase-limit policy lookup, and advanced concurrency controls are deferred.

### 3. Prefer Secure Storage for Sensitive Viewer Data

The viewer id-card value should be stored encrypted, not as plaintext. The current viewer pages only need id, name, and mobile for selection, so this upgrade will not broaden plaintext exposure just to satisfy persistence.

## Schema Reconciliation

The current Prisma schema and the current API shape do not line up. This upgrade reconciles them with the smallest change set needed for the MVP flow.

### Viewer

Viewer records need to belong to a logical user scope and store encrypted id-card data.

Target shape:

- `id`
- `userId`
- `name`
- `mobile`
- `idCardEncrypted`
- `createdAt`
- `updatedAt`

Notes:

- `idCardEncrypted` replaces plaintext `idCard`
- viewer list responses remain minimal and should not expose plaintext id-card data

### Order

Orders need to belong to a logical user scope and represent a multi-viewer purchase.

Target shape:

- `id`
- `orderNumber`
- `userId`
- `status`
- `ticketType`
- `totalAmount`
- `currency`
- `createdAt`
- `updatedAt`

Notes:

- the current singular `viewerId` relationship on `Order` does not match the draft-order API and should be removed from the persistence path

### OrderItem

Order items need to connect each purchased ticket selection to a viewer and tier.

Target shape:

- `id`
- `orderId`
- `ticketTierId`
- `viewerId`
- `quantity`
- `unitPrice`
- `totalAmount`
- `createdAt`

### Payment

Payments remain order-linked records and should persist callback results.

Target shape:

- `id`
- `orderId`
- `amount`
- `method`
- `status`
- `providerTxnId`
- `paidAt`
- `createdAt`
- `updatedAt`

### FulfillmentEvent

Fulfillment records remain append-only order-linked events.

Target shape:

- `id`
- `orderId`
- `status` or equivalent fulfillment type/state
- `externalRef`
- `payload`
- `occurredAt`
- `createdAt`

### RefundRequest

Refund persistence needs to retain both rule evaluation and downstream processing state.

Target shape:

- `id`
- `orderId`
- `refundNo`
- `reason`
- `status`
- `requestedAmount`
- `serviceFee`
- `refundAmount`
- `requestedAt`
- `processedAt`
- `createdAt`
- `updatedAt`

## Module Changes

### Prisma Access

Add a shared Prisma service/module in the API app and use it from:

- viewers
- checkout/orders
- payments
- fulfillment
- refunds

The goal is simple database access, not a full repository abstraction layer.

### Viewers Module

Behavior after upgrade:

- `POST /viewers` encrypts the id-card and inserts a viewer row
- `GET /viewers` returns persisted viewers for the current temporary user scope

Response shape for list:

- `id`
- `name`
- `mobile`

### Checkout / Orders Module

Behavior after upgrade:

- `POST /orders/draft` validates inputs as it does now
- creates one order row
- creates one order-item row per viewer selection
- computes total amount from tier price and quantity
- returns the persisted draft order metadata

This keeps the current draft-order UX but makes the order retrievable and transitionable.

### Payments Module

Behavior after upgrade:

- payment callback creates or updates a payment record
- advances the related order to `PAID_PENDING_FULFILLMENT`
- returns persisted transition metadata

### Fulfillment Module

Behavior after upgrade:

- manual issuance writes a fulfillment event row
- vendor callback issuance writes a fulfillment event row
- both advance the order to `TICKET_ISSUED`

### Refunds Module

Behavior after upgrade:

- refund calculation remains a pure rule helper
- add a minimal `POST /refunds/request` route so the system can create a persisted refund request instead of only calculating fees
- `POST /refunds/request` creates a `RefundRequest` in `REFUND_REVIEWING` and assigns a persisted `refundNo`
- `POST /refunds/vendor-callback` updates the persisted refund record matched by `refundNo` and advances the order toward `REFUND_PROCESSING` or `REFUNDED`

## API Compatibility Strategy

Keep existing controller routes where possible so the frontend does not need a major route rewrite:

- keep `POST /viewers`
- keep `GET /viewers`
- keep `POST /orders/draft`
- keep existing payment/fulfillment/refund callback routes
- add only one new persistence route: `POST /refunds/request`

If a route needs temporary user scoping, prefer small request-shape additions over broad controller redesign.

## Verification Plan

This upgrade is complete when all of the following are true:

1. Creating a viewer writes a database record and `GET /viewers` returns it.
2. Creating a draft order writes an order and order items.
3. Payment callback writes a payment record and updates order status.
4. Fulfillment callback/manual action writes a fulfillment event and updates order status.
5. Refund persistence writes a refund record and updates order status.
6. Existing root verification still passes:
   - `corepack pnpm lint`
   - `corepack pnpm test`

Additional targeted verification should include API unit tests for the new persistence behavior.

## Risks

### Schema Drift Risk

The current Prisma schema already diverges from some API contracts. This upgrade should fix only the parts needed for viewer/order/payment/fulfillment/refund persistence and avoid unrelated schema churn.

### Identity Boundary Risk

Temporary client-provided `userId` is acceptable for this MVP persistence step, but it is not the final auth model. The next phase should replace that with a persisted authenticated user identity.

### Inventory Risk

Because this pass does not add strict inventory locking, persisted draft orders should still be treated as draft/order-state records, not guaranteed stock reservations.

## Non-Goals For This Pass

- no true session/auth redesign
- no upstream contract rewrite
- no advanced refund workflow automation
- no deep admin reporting layer
- no strict stock transaction engine

## Output of This Design

After implementation, the repo should still be an MVP, but it should be a stateful MVP:

- viewer data survives beyond a single request
- orders accumulate real transitions
- callbacks mutate stored order state
- frontend/admin placeholders can begin reading real records instead of synthetic responses
