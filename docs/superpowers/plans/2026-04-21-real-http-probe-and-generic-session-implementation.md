# Real HTTP Probe And Generic Session Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the stub agent probe with a real HTTP workflow against `apps/api`, while removing WeChat-specific auth and payment flows from the sample backend.

**Architecture:** Introduce a provider-neutral session bootstrap flow and generic payment intent sample flow in `apps/api`, then switch `apps/load-control` from a stub probe to a stateful HTTP workflow probe that exercises `session bootstrap -> viewers -> catalog -> draft order`. Keep the existing run lifecycle, phase model, telemetry, and reporting intact.

**Tech Stack:** NestJS, Prisma, Zod contracts, Vitest/Jest, PostgreSQL, Redis, pnpm workspace

---

## Status

- `design reference`: [2026-04-21-real-http-probe-and-generic-session-design.md](D:\CodexFolder\.worktrees\load-testing-saas-reframe\docs\superpowers\specs\2026-04-21-real-http-probe-and-generic-session-design.md)
- `execution state`: completed on branch `codex/load-testing-saas-reframe`
- `latest acceptance smoke`: `run-handoff-smoke-20260421184833` completed on `2026-04-21`
- `acceptance evidence`: fresh local stack bootstrap, real HTTP workflow execution, successful summary persistence, and clean `api.err.log` / `load-control.err.log` after the final smoke

## Delivered Scope

- generic customer-session bootstrap replaced the WeChat-specific auth path used by the load test
- provider-neutral payment intent sample flow replaced the WeChat-only payment sample flow
- the default load agent now uses `HttpWorkflowProbe` instead of stubbed request simulation
- the probe now executes against `/auth/session/bootstrap`, `/viewers`, `/catalog/events`, and `/orders/draft`
- concurrent bootstrap races were closed in both `SessionBootstrapService` and `HttpWorkflowProbe`
- `401 Unauthorized` now clears the cached token and surfaces the failure instead of fabricating a synthetic retry path

### Task 1: Reframe shared contracts and persistence models

**Files:**
- Modify: `packages/contracts/src/auth.ts`
- Modify: `packages/contracts/src/payment.ts`
- Modify: `packages/contracts/src/index.ts`
- Modify: `packages/contracts/src/contracts.spec.ts`
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/20260421110000_generic_session_and_payment_sample/migration.sql`

- [ ] **Step 1: Write the failing contract tests**

```ts
// packages/contracts/src/contracts.spec.ts
it('validates the generic customer session contract', () => {
  customerSessionSchema.parse({
    token: 'token_123',
    customer: {
      accountKey: 'loadtest:node-local-user-01',
      id: 'cust_1',
    },
    expiresAt: new Date().toISOString(),
  });
});

it('validates the generic payment intent contract', () => {
  paymentIntentSchema.parse({
    expiresAt: new Date().toISOString(),
    intentToken: 'intent_123',
    method: 'EXTERNAL_PROVIDER',
    orderId: 'ord_1',
    paymentId: 'pay_1',
    status: 'PENDING',
  });
});
```

- [ ] **Step 2: Run contract tests to verify they fail**

Run: `corepack pnpm --filter @ticketing/contracts test`

Expected: FAIL because `accountKey` and `paymentIntentSchema` are not defined in the current contract surface.

- [ ] **Step 3: Implement the generic contracts**

```ts
// packages/contracts/src/auth.ts
export const customerIdentitySchema = z
  .object({
    id: z.string().min(1),
    accountKey: z.string().min(1),
  })
  .strict();

// packages/contracts/src/payment.ts
export const paymentIntentSchema = z
  .object({
    paymentId: z.string().min(1),
    orderId: z.string().min(1),
    method: z.enum(['EXTERNAL_PROVIDER']),
    status: z.enum(['PENDING']),
    intentToken: z.string().min(1),
    expiresAt: z.string().datetime(),
  })
  .strict();
```

```prisma
// apps/api/prisma/schema.prisma
enum PaymentMethod {
  ALIPAY
  EXTERNAL_PROVIDER
  BANK_CARD
}

model CustomerAccount {
  id         String            @id @default(cuid())
  accountKey String            @unique
  createdAt  DateTime          @default(now())
  updatedAt  DateTime          @updatedAt
  sessions   CustomerSession[]
}
```

```sql
-- apps/api/prisma/migrations/20260421110000_generic_session_and_payment_sample/migration.sql
ALTER TYPE "PaymentMethod" RENAME VALUE 'WECHAT_PAY' TO 'EXTERNAL_PROVIDER';
ALTER TABLE "CustomerAccount" RENAME COLUMN "wechatOpenId" TO "accountKey";
```

- [ ] **Step 4: Run the updated contract and Prisma checks**

Run:
- `corepack pnpm --filter @ticketing/contracts test`
- `corepack pnpm --filter api prisma:generate`
- `corepack pnpm exec tsc -p apps/api/tsconfig.json --noEmit`

Expected: PASS for contracts and TypeScript; Prisma client regenerates without schema errors.

- [ ] **Step 5: Commit**

```bash
git add packages/contracts/src/auth.ts packages/contracts/src/payment.ts packages/contracts/src/index.ts packages/contracts/src/contracts.spec.ts apps/api/prisma/schema.prisma apps/api/prisma/migrations/20260421110000_generic_session_and_payment_sample/migration.sql
git commit -m "refactor: make session and payment models provider neutral"
```

### Task 2: Replace WeChat auth with generic session bootstrap

**Files:**
- Modify: `apps/api/src/modules/auth/auth.controller.ts`
- Modify: `apps/api/src/modules/auth/auth.module.ts`
- Delete: `apps/api/src/modules/auth/wechat-auth.service.ts`
- Delete: `apps/api/src/modules/auth/wechat-auth.service.spec.ts`
- Create: `apps/api/src/modules/auth/session-bootstrap.service.ts`
- Create: `apps/api/src/modules/auth/session-bootstrap.service.spec.ts`
- Modify: `apps/api/src/common/auth/customer-session.guard.ts`
- Modify: `apps/api/src/common/auth/current-customer.decorator.ts`
- Modify: `.env.example`

- [ ] **Step 1: Write the failing bootstrap tests**

```ts
// apps/api/src/modules/auth/session-bootstrap.service.spec.ts
it('creates a session token for a synthetic account key', async () => {
  const prismaMock = {
    customerAccount: {
      upsert: vi.fn().mockResolvedValue({
        accountKey: 'loadtest:node-local-user-01',
        id: 'cust_1',
      }),
    },
    customerSession: {
      create: vi.fn().mockResolvedValue(undefined),
    },
  } as never;

  const service = new SessionBootstrapService(prismaMock);
  const result = await service.bootstrapSession('loadtest:node-local-user-01');

  expect(result.customer).toEqual({
    accountKey: 'loadtest:node-local-user-01',
    id: 'cust_1',
  });
  expect(result.token).toMatch(/[a-f0-9]{48}/);
});
```

```ts
// apps/api/src/modules/auth/auth.controller.spec.ts (or module test)
await request(app.getHttpServer())
  .post('/api/auth/session/bootstrap')
  .set('x-load-test-secret', 'secret_123')
  .send({ accountKey: 'loadtest:node-local-user-01' })
  .expect(201);
```

- [ ] **Step 2: Run auth tests to verify they fail**

Run: `corepack pnpm --filter api test -- auth`

Expected: FAIL because `SessionBootstrapService` and `/auth/session/bootstrap` do not exist.

- [ ] **Step 3: Implement the bootstrap service and controller**

```ts
// apps/api/src/modules/auth/session-bootstrap.service.ts
@Injectable()
export class SessionBootstrapService {
  constructor(private readonly prisma: PrismaService) {}

  async bootstrapSession(accountKey: string) {
    const customer = await this.prisma.customerAccount.upsert({
      where: { accountKey },
      update: {},
      create: { accountKey },
      select: { accountKey: true, id: true },
    });

    const token = randomBytes(24).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.prisma.customerSession.create({
      data: {
        customerId: customer.id,
        expiresAt,
        tokenHash,
      },
    });

    return {
      token,
      customer,
      expiresAt: expiresAt.toISOString(),
    };
  }
}
```

```ts
// apps/api/src/modules/auth/auth.controller.ts
@Post('session/bootstrap')
bootstrapSession(
  @Headers('x-load-test-secret') providedSecret: string | undefined,
  @Body() body: { accountKey?: string },
) {
  if (providedSecret !== process.env.LOAD_TEST_INTERNAL_SECRET) {
    throw new UnauthorizedException('Load-test bootstrap secret is required.');
  }

  if (!body?.accountKey?.trim()) {
    throw new BadRequestException('accountKey is required.');
  }

  return this.sessionBootstrapService.bootstrapSession(body.accountKey.trim());
}
```

```env
# .env.example
LOAD_TEST_INTERNAL_SECRET=change-me-load-test-secret
LOAD_TEST_AGENT_ACCOUNT_PREFIX=node-local-user
```

- [ ] **Step 4: Run auth and API tests**

Run:
- `corepack pnpm --filter api test -- auth`
- `corepack pnpm --filter api test -- viewers`
- `corepack pnpm exec tsc -p apps/api/tsconfig.json --noEmit`

Expected: PASS; current customer semantics now use `accountKey` instead of `openId`.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/auth apps/api/src/common/auth .env.example
git commit -m "feat: add generic session bootstrap flow"
```

### Task 3: Replace the WeChat payment module with a generic sample payment intent flow

**Files:**
- Modify: `apps/api/src/modules/payments/payments.module.ts`
- Modify: `apps/api/src/modules/payments/payments.controller.ts`
- Delete: `apps/api/src/modules/payments/wechat-pay.service.ts`
- Delete: `apps/api/src/modules/payments/wechat-pay.gateway.ts`
- Create: `apps/api/src/modules/payments/payments.service.ts`
- Modify: `apps/api/src/modules/payments/payments.service.spec.ts`
- Modify: `packages/contracts/src/index.ts`
- Modify: `packages/contracts/src/payment.ts`

- [ ] **Step 1: Write the failing payment tests**

```ts
// apps/api/src/modules/payments/payments.service.spec.ts
it('creates a generic payment intent for a pending order', async () => {
  const result = await service.createPaymentIntent({
    customerId: 'cust_1',
    orderId: 'ord_1',
  });

  expect(result).toEqual({
    paymentId: expect.any(String),
    orderId: 'ord_1',
    method: 'EXTERNAL_PROVIDER',
    status: 'PENDING',
    intentToken: expect.any(String),
    expiresAt: expect.any(String),
  });
});

it('confirms a pending payment and transitions the order', async () => {
  await service.confirmPaymentIntent({
    amount: 159800,
    paymentId: 'pay_1',
  });

  expect(fulfillmentEventsService.submitPaidOrder).toHaveBeenCalledWith('ord_1');
});
```

- [ ] **Step 2: Run the payment tests to verify they fail**

Run: `corepack pnpm --filter api test -- payments`

Expected: FAIL because `createPaymentIntent` and `confirmPaymentIntent` do not exist.

- [ ] **Step 3: Implement the generic payment service and routes**

```ts
// apps/api/src/modules/payments/payments.controller.ts
@Post('intents')
@UseGuards(CustomerSessionGuard)
createIntent(
  @Body() body: { orderId?: string },
  @CurrentCustomer() customer: CurrentCustomerPrincipal,
) {
  if (!body?.orderId?.trim()) {
    throw new BadRequestException('orderId is required.');
  }

  return this.paymentsService.createPaymentIntent({
    customerId: customer.id,
    orderId: body.orderId.trim(),
  });
}

@Post('intents/:paymentId/confirm')
confirmIntent(
  @Param('paymentId') paymentId: string,
  @Body() body: { amount?: number },
) {
  return this.paymentsService.confirmPaymentIntent({
    amount: body.amount ?? 0,
    paymentId,
  });
}
```

```ts
// apps/api/src/modules/payments/payments.service.ts
async createPaymentIntent(input: { customerId: string; orderId: string }): Promise<PaymentIntent> {
  const order = await this.prisma.order.findFirst({
    where: {
      id: input.orderId,
      status: ORDER_STATUS.PENDING_PAYMENT,
      userId: input.customerId,
    },
  });

  if (!order) {
    throw new BadRequestException('Pending order not found.');
  }

  const payment = await this.prisma.payment.create({
    data: {
      amount: order.totalAmount,
      method: PaymentMethod.EXTERNAL_PROVIDER,
      orderId: order.id,
      status: PaymentStatus.PENDING,
    },
  });

  return {
    paymentId: payment.id,
    orderId: order.id,
    method: 'EXTERNAL_PROVIDER',
    status: 'PENDING',
    intentToken: randomBytes(16).toString('hex'),
    expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  };
}
```

- [ ] **Step 4: Run payment, fulfillment, and contract tests**

Run:
- `corepack pnpm --filter api test -- payments`
- `corepack pnpm --filter api test -- fulfillment`
- `corepack pnpm --filter @ticketing/contracts test`

Expected: PASS; the sample backend no longer exposes WeChat payment semantics.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/payments packages/contracts/src/payment.ts packages/contracts/src/index.ts
git commit -m "refactor: replace wechat payment sample with generic intents"
```

### Task 4: Replace the stub probe with a stateful HTTP workflow probe

**Files:**
- Modify: `apps/load-control/src/agent/main.ts`
- Modify: `apps/load-control/src/agent/agent-runner.ts`
- Create: `apps/load-control/src/agent/http-workflow.probe.ts`
- Create: `apps/load-control/src/agent/http-workflow.probe.spec.ts`
- Modify: `apps/load-control/src/agent/main.spec.ts`
- Modify: `apps/load-control/src/modules/control/default-control-catalog.ts`
- Modify: `scripts/sql/seed-load-control-local.sql`

- [ ] **Step 1: Write the failing probe tests**

```ts
// apps/load-control/src/agent/http-workflow.probe.spec.ts
it('bootstraps a session, ensures a viewer, resolves a tier, and creates a draft order', async () => {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(jsonResponse({ token: 'tok_1', customer: { id: 'cust_1', accountKey: 'loadtest:node-local-user-01' }, expiresAt: new Date().toISOString() }))
    .mockResolvedValueOnce(jsonResponse({ items: [] }))
    .mockResolvedValueOnce(jsonResponse({ id: 'viewer_1' }))
    .mockResolvedValueOnce(jsonResponse({ items: [{ id: 'event_1' }] }))
    .mockResolvedValueOnce(jsonResponse({ id: 'event_1', sessions: [{ ticketTiers: [{ id: 'tier_1', ticketType: 'E_TICKET' }] }] }))
    .mockResolvedValueOnce(jsonResponse({ id: 'ord_1' }));

  const probe = new HttpWorkflowProbe({ fetchImpl: fetchMock as typeof fetch });
  const result = await probe.execute(makeOrderSubmitRequest());

  expect(result.success).toBe(true);
  expect(fetchMock).toHaveBeenCalledTimes(6);
});
```

- [ ] **Step 2: Run the load-control agent tests to verify they fail**

Run: `corepack pnpm --filter load-control test -- agent`

Expected: FAIL because `HttpWorkflowProbe` does not exist and the default probe is still synthetic.

- [ ] **Step 3: Implement the workflow probe and switch the bootstrap**

```ts
// apps/load-control/src/agent/http-workflow.probe.ts
export class HttpWorkflowProbe implements TargetProbe {
  private token?: string;
  private viewerId?: string;
  private eventId?: string;
  private tierId?: string;

  async execute(request: ProbeRequest): Promise<ProbeResult> {
    const startedAt = Date.now();

    if (request.pool === 'query') {
      await this.ensureSession(request);
      await this.refreshCatalogContext(request);
      return { success: true, latencyMs: Date.now() - startedAt };
    }

    if (request.pool === 'orderSubmit') {
      await this.ensureSession(request);
      await this.ensureCatalogContext(request);
      await this.ensureViewer(request);
      await this.createDraftOrder(request);
      return { success: true, latencyMs: Date.now() - startedAt };
    }

    return { success: true, latencyMs: Date.now() - startedAt };
  }
}
```

```ts
// apps/load-control/src/agent/main.ts
const probe =
  options.probe ??
  new HttpWorkflowProbe({
    accountPrefix: readEnv(env, ['LOAD_TEST_AGENT_ACCOUNT_PREFIX'], 'node-local-user'),
    fetchImpl: fetch,
    loadTestSecret: readEnv(env, ['LOAD_TEST_INTERNAL_SECRET']),
  });
```

- [ ] **Step 4: Run the load-control tests**

Run:
- `corepack pnpm --filter load-control test`
- `corepack pnpm exec tsc -p apps/load-control/tsconfig.json --noEmit`

Expected: PASS; stub success is gone and agent tests cover the real HTTP workflow.

- [ ] **Step 5: Commit**

```bash
git add apps/load-control/src/agent apps/load-control/src/modules/control/default-control-catalog.ts scripts/sql/seed-load-control-local.sql
git commit -m "feat: add real http workflow probe for sample backend"
```

### Task 5: Align sample data, docs, and local stack smoke flow

**Files:**
- Modify: `README.md`
- Modify: `.env.example`
- Modify: `docs/superpowers/guides/2026-04-18-load-testing-saas-operator-guide.md`
- Modify: `scripts/start-local-stack.ps1`
- Modify: `scripts/status-local-stack.ps1`
- Modify: `tests/workspace/local-stack-launchers.spec.ts`

- [ ] **Step 1: Write the failing launcher/doc tests**

```ts
// tests/workspace/local-stack-launchers.spec.ts
it('documents the generic bootstrap secret in the local stack launcher output', async () => {
  const script = await fs.promises.readFile(
    path.join(worktreeRoot, 'scripts', 'start-local-stack.ps1'),
    'utf8',
  );

  expect(script).toContain('LOAD_TEST_INTERNAL_SECRET');
});
```

- [ ] **Step 2: Run the workspace launcher test to verify it fails**

Run: `corepack pnpm exec vitest run tests/workspace/local-stack-launchers.spec.ts`

Expected: FAIL because the launcher and docs do not mention the generic bootstrap flow yet.

- [ ] **Step 3: Update docs and local stack helpers**

```powershell
# scripts/start-local-stack.ps1
if (-not $env:LOAD_TEST_INTERNAL_SECRET) {
  $env:LOAD_TEST_INTERNAL_SECRET = 'change-me-load-test-secret'
}
```

```md
# docs/superpowers/guides/2026-04-18-load-testing-saas-operator-guide.md
- Generic bootstrap login: `POST /api/auth/session/bootstrap`
- Generic payment sample: `POST /api/payments/intents`
- Agent V1 workflow: `session bootstrap -> viewers -> catalog -> draft order`
```

- [ ] **Step 4: Run launcher/docs verification**

Run:
- `corepack pnpm exec vitest run tests/workspace/local-stack-launchers.spec.ts`
- `corepack pnpm --filter admin build`

Expected: PASS; docs and startup helpers describe the new generic sample flow.

- [ ] **Step 5: Commit**

```bash
git add README.md .env.example docs/superpowers/guides/2026-04-18-load-testing-saas-operator-guide.md scripts/start-local-stack.ps1 scripts/status-local-stack.ps1 tests/workspace/local-stack-launchers.spec.ts
git commit -m "docs: align local stack with generic sample backend flow"
```

### Task 6: Run the full verification and local end-to-end smoke

**Files:**
- Modify only if needed based on failures discovered during verification

- [ ] **Step 1: Apply Prisma migration and reseed local data**

Run:
- `docker compose up -d`
- `corepack pnpm --filter api prisma:migrate`
- `corepack pnpm --filter api prisma:generate`
- `corepack pnpm install`

Expected: PASS; database and generated client match the generic schema.

- [ ] **Step 2: Run the automated test suite**

Run:
- `corepack pnpm --filter @ticketing/contracts test`
- `corepack pnpm --filter api test`
- `corepack pnpm --filter load-control test`
- `corepack pnpm exec vitest run tests/workspace/local-stack-launchers.spec.ts`
- `corepack pnpm --filter admin build`

Expected: PASS across all targeted suites.

- [ ] **Step 3: Start the local stack and run a real HTTP smoke**

Run:
- `cmd /c "D:\\CodexFolder\\.worktrees\\load-testing-saas-reframe\\start-local-stack.cmd --no-browser"`
- `Invoke-RestMethod http://localhost:3000/api/health`
- `Invoke-RestMethod http://localhost:3001/control/health`
- register node and start a seeded run
- `corepack pnpm --filter load-control dev:agent`

Expected:
- `api` and `load-control` health endpoints return `status: ok`
- run reaches `COMPLETED`
- logs show real requests to `/api/auth/session/bootstrap`, `/api/viewers`, `/api/catalog/events`, `/api/catalog/events/:eventId`, and `/api/orders/draft`

- [ ] **Step 4: Inspect run results and confirm real telemetry**

Run:
- `Invoke-RestMethod http://localhost:3001/control/runs/run-local-demo-01`
- `Invoke-RestMethod http://localhost:3001/control/runs/run-local-demo-01/live`

Expected:
- summary `requestCount` and latency now come from real HTTP requests
- no WeChat routes are called during the smoke

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "test: verify real http probe against generic sample backend"
```
