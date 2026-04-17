# Ticketing B Internal Beta Design

## Context

This document defines the next delivery target for the authorized ticketing miniapp after the persistence upgrade is complete.

The agreed target is a `B`-stage internal beta focused on validating a single real event with real payment, real fulfillment callbacks, and real refund callbacks. The purpose of this phase is not broad launch readiness. The purpose is to prove that the core business loop can run reliably with a small public audience and limited operational scale.

## Agreed Scope

The internal beta is based on the following confirmed constraints:

- `1` live event only
- real WeChat payment
- small-scale public selling, not whitelist-only
- fulfillment and refund both use interfaces in this phase
- validate ticket purchase, fulfillment, and after-sales together
- the highest priority is the real sales loop from browsing to issued ticket

## Goals

The internal beta must validate these five outcomes:

1. Users can complete the real flow of `browse -> real-name submit -> order -> pay -> issue -> after-sales`.
2. Upstream interfaces can return stable fulfillment and refund results under real orders.
3. Operations can receive and resolve a small number of abnormal orders without losing control of customer communication.
4. The miniapp expresses purchase rules clearly enough to reduce avoidable complaints around real-name requirements, issuance timing, and refund windows.
5. Basic risk controls can stop common order abuse and user-data mistakes before they become operational incidents.

## Non-Goals

This phase explicitly does not pursue the following:

1. Multi-event inventory rollout
2. Deep seat-selection capability
3. Membership, points, referral, or growth systems
4. Fully automated operations with no manual fallback
5. Broad public launch readiness across many cities or upstreams

Manual operational fallback is allowed for edge cases, but the main purchase, fulfillment, and refund paths must remain interface-driven.

## Success Criteria

The internal beta is considered successful when all of the following are true:

1. A real customer can complete payment and receive a final, visible ticketing outcome through the miniapp.
2. The order detail page accurately reflects every important order state after callback processing.
3. The team can identify and handle fulfillment failures, refund exceptions, and user-information problems from the admin console.
4. The refund policy and the `20%` service-fee deduction rule are applied consistently when the user enters incorrect information within the defined late window.
5. The team can safely pause sales, inspect problematic orders, and communicate a clear next step to the user.

## Business Rules

### Real-Name Rules

- Real-name ticketing is mandatory.
- The user cannot modify bound attendee information after order submission and before ticket issuance.
- If user information is wrong and cannot be recorded within `3` days before the event, the platform deducts a `20%` service fee.

### Ticket Type Timing

- Electronic tickets follow the `3 days before event start` timing rule.
- Paper tickets follow the `7 days before event start` timing rule.

### Beta Selling Shape

- The platform supports all three ticketing shapes in the long term: fixed tier, tier plus rough area, and seat selection.
- This beta uses `fixed tier` and `tier + rough area` as the primary selling modes.
- Explicit seat selection is not a core requirement for this phase and should not expand the delivery scope.

## Frontend Scope

The beta miniapp should keep the front-stage experience compact and clear. The recommended page scope is:

1. `Home`
   Show the featured event, sale status, purchase rules, refund rules, customer-service entry, and limited event-intelligence content for browsing value.
2. `Event Detail`
   Show session details, price tiers or areas, issuance notes, real-name policy, refund windows, ticket-type differences, and FAQ content.
3. `Checkout Confirmation`
   Confirm selected ticket option, attendees, amount breakdown, warnings, and agreement confirmation.
4. `Viewer Management`
   Add, edit, and view attendees, while enforcing the rule that attendees already bound to a submitted order cannot be edited during the issuance window.
5. `Payment Result`
   Distinguish clearly between `payment failed`, `payment successful and pending issuance`, and any payment-success-but-still-confirming state.
6. `Order List`
   Focus on a small, high-signal set of states: `pending issuance`, `issued`, `refund in progress`, `refunded`, and `abnormal pending handling`.
7. `Order Detail`
   Act as the main user control center for status, attendee info, issuance progress, refund entry, customer-service entry, and rule reminders.
8. `After-Sales Request`
   Support refund application, reason selection, rule acknowledgement, and progress lookup.

The `Me` page should stay lightweight in this phase and mainly aggregate orders, attendees, support entry points, and policy links.

## Primary User Flow

The core transaction path is:

`Home/Event Detail -> select ticket tier or area -> choose attendees -> create draft order -> inventory and risk validation -> initiate real WeChat payment -> payment callback updates order -> call upstream fulfillment interface -> receive fulfillment callback -> update order detail -> user checks status or contacts support -> if needed user requests refund -> call upstream refund interface -> receive refund callback -> refund completed`

This flow depends on three strict design rules:

1. `Payment successful` must never be treated as `ticket issued`.
2. The order detail page is the primary place where users resolve uncertainty.
3. Refund logic must consistently enforce the agreed timing rules and the `20%` late information-error deduction rule.

## Admin Scope

The internal beta admin should stay narrow but operationally strong. The minimum module set is:

1. `Event Operations Console`
   Manage the event basics, tier or area configuration, sale switches, notices, real-name copy, refund copy, and public-facing content.
2. `Order Operations Console`
   Search and filter orders by state, payment status, fulfillment status, attendee data, refund state, and exception markers. Support notes and manual follow-up actions.
3. `Fulfillment Monitoring Console`
   Highlight orders that are paid but not issued, upstream timeout cases, upstream failures, or callback mismatches.
4. `Refund Operations Console`
   Show refund requests, policy decisions, upstream refund state, callback results, failure reasons, and operator notes.
5. `Customer Support Console`
   Provide enough context for support to inspect orders, classify the issue, and maintain a visible handling record.

The operational design goal is not a feature-heavy admin. The goal is that every abnormal order can be received, understood, and processed.

## Risk Control Scope

The beta should include five baseline controls:

1. purchase limits by user, attendee identity, and phone number for the event
2. short-window high-frequency order protection
3. attendee and identity-format validation before payment
4. draft-order timeout with inventory release
5. refund-window and fee-rule evaluation before entering manual handling

These controls should prevent the most common scaling and abuse problems without introducing heavy anti-fraud complexity.

## Exception Handling Design

Every important exception must produce a visible order or refund state rather than only a hidden log entry. The admin must handle at least these cases:

1. `paid but no fulfillment result yet`
   The order moves into a visible `pending fulfillment confirmation` or equivalent state.
2. `upstream fulfillment failed`
   The order moves into an exception state with a visible reason and a next-step path.
3. `repeated payment callbacks or inconsistent callback state`
   The system handles idempotency automatically and keeps an audit trail.
4. `user attendee information invalid`
   When this causes late recording failure within the final `3` days, the order must record the `20%` service fee deduction basis.
5. `upstream refund timeout or failure`
   The refund remains visible as in-progress or abnormal so support can communicate clearly.
6. `manual support takeover`
   Any unresolved order can be marked as manually followed so the team knows the case is owned.

## Technical Delivery Priorities

The implementation order for this beta should be:

1. `Real WeChat login and user identity`
   Replace the temporary miniapp user identity with a real binding based on `openid` and platform user records.
2. `Real transaction chain integration`
   Complete the live chain for order submission, WeChat payment, payment callbacks, upstream fulfillment interface, fulfillment callbacks, refund interface, and refund callbacks.
3. `Operations and exception tooling`
   Deliver the core admin tools that allow the team to watch, search, and recover abnormal orders.
4. `Environment controls and observability`
   Add environment separation, signature validation, critical logs, alerting, and emergency switches such as sale stop and refund-entry disable switches.
5. `Single-event dress rehearsal`
   Rehearse the one-event flow across normal purchase, payment failure, pending issuance, issuance failure, refund request, refund success, refund failure, and manual takeover.

## Launch Readiness Checklist

Before opening the internal beta to real users, the following must all be true:

1. WeChat login, user binding, and order ownership are verified.
2. WeChat merchant settings, callback URLs, and signature verification are working.
3. Upstream fulfillment and refund interfaces have completed real joint testing, including timeout and duplicate-callback handling.
4. Backend order states and frontend user copy are aligned.
5. The real-name rules, refund rules, and `20%` fee rule are shown clearly on checkout, order, and after-sales screens.
6. Electronic-ticket and paper-ticket timing nodes are configured according to the agreed rules.
7. Customer-support scripts are prepared for every major exception state.
8. The admin can quickly filter orders in `pending issuance`, `issuance failure`, `refund in progress`, and `refund abnormal`.
9. Payment, fulfillment, refund, and manual operations are all auditable.
10. The team can stop sales, hide the event, pause the refund entry, or shift to manual handling through controlled switches.
11. A complete end-to-end rehearsal has been executed without duplicate-order corruption or state drift.
12. Staff coverage exists during sale windows and callback peaks.

## Recommended Next Implementation Slice

The next concrete build slice should focus on these three deliverables:

1. `Real WeChat login and user identity system`
2. `Real payment plus upstream fulfillment and refund integration`
3. `Order operations and exception-handling admin tools`

These three deliverables are the shortest path from the current persisted skeleton to a beta that can handle real money and real customers.
