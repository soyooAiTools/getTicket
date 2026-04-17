# Ticketing Persistence Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist the core ticketing MVP flow for viewers, draft orders, payment callbacks, fulfillment callbacks, and refund workflows using Prisma and PostgreSQL.

**Architecture:** Reconcile the Prisma schema to match the current API behavior, add one shared Prisma access layer, then wire each stateful module to stored records while preserving current routes wherever practical. Keep temporary user scoping via client-provided `userId`, and only touch the miniapp where persisted viewer flows need it.

**Tech Stack:** NestJS, Prisma, PostgreSQL, Jest, TypeScript, Taro miniapp

---

## Proposed File Structure

- `apps/api/prisma/schema.prisma`
  Responsibility: persistable schema for viewers, orders, order items, payments, fulfillment events, and refund requests.
- `apps/api/src/common/prisma/prisma.service.ts`
  Responsibility: shared Prisma client lifecycle for the API app.
- `apps/api/src/common/prisma/prisma.module.ts`
  Responsibility: export Prisma service to API modules.
- `apps/api/src/common/prisma/prisma.service.spec.ts`
  Responsibility: smoke-test Prisma service wiring.
- `apps/api/src/app.module.ts`
  Responsibility: register the shared Prisma module once for the API app.
- `apps/api/src/modules/viewers/viewers.service.ts`
  Responsibility: encrypt id-card values, create viewer records, list viewers by temporary user scope.
- `apps/api/src/modules/viewers/viewers.controller.ts`
  Responsibility: validate viewer routes, accept `userId` query for listing, return persisted data.
- `apps/api/src/modules/viewers/viewers.service.spec.ts`
  Responsibility: verify viewer persistence behavior with mocked Prisma delegates.
- `apps/miniapp/src/constants/temp-user.ts`
  Responsibility: centralize the temporary MVP `userId` used before auth persistence exists.
- `apps/miniapp/src/pages/viewers/index.tsx`
  Responsibility: request persisted viewers for the temporary user scope.
- `apps/miniapp/src/pages/viewers/form.tsx`
  Responsibility: create viewers against the persisted API using the shared temporary user id.
- `apps/api/src/modules/checkout/checkout.service.ts`
  Responsibility: create persisted draft orders and order items from validated inputs.
- `apps/api/src/modules/checkout/checkout.service.spec.ts`
  Responsibility: verify draft-order persistence and validation-sensitive branches with mocked Prisma delegates.
- `apps/api/src/modules/orders/orders.controller.ts`
  Responsibility: keep the current draft-order route while delegating to the persisted checkout flow.
- `apps/api/src/modules/checkout/checkout.module.ts`
  Responsibility: provide persisted checkout dependencies.
- `apps/api/src/modules/payments/wechat-pay.service.ts`
  Responsibility: persist payment callback results and advance order status.
- `apps/api/src/modules/payments/payments.service.spec.ts`
  Responsibility: verify persisted payment transitions.
- `apps/api/src/modules/fulfillment/fulfillment-events.service.ts`
  Responsibility: persist manual/vendor fulfillment events and advance order status.
- `apps/api/src/modules/fulfillment/fulfillment-events.service.spec.ts`
  Responsibility: verify persisted fulfillment transitions.
- `apps/api/src/modules/refunds/refunds.service.ts`
  Responsibility: calculate refund fees, persist refund requests, apply vendor refund callbacks.
- `apps/api/src/modules/refunds/refunds.controller.ts`
  Responsibility: validate refund request/callback routes and expose the new persisted request entrypoint.
- `apps/api/src/modules/refunds/refunds.service.spec.ts`
  Responsibility: verify refund fee calculation and refund persistence transitions.

### Task 1: Add Prisma Access And Reconcile Schema

**Files:**
- Create: `apps/api/src/common/prisma/prisma.service.ts`
- Create: `apps/api/src/common/prisma/prisma.module.ts`
- Create: `apps/api/src/common/prisma/prisma.service.spec.ts`
- Modify: `apps/api/prisma/schema.prisma`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Write the failing Prisma service smoke test**

```ts
// apps/api/src/common/prisma/prisma.service.spec.ts
import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  it('can be instantiated and exposes Prisma client methods', () => {
    const service = new PrismaService();

    expect(service).toBeInstanceOf(PrismaService);
    expect(typeof service.$connect).toBe('function');
    expect(typeof service.$disconnect).toBe('function');
  });
});
```

- [ ] **Step 2: Run the new test to confirm the Prisma layer does not exist yet**

Run: `corepack pnpm --filter api test -- prisma.service.spec.ts`

Expected: FAIL with `Cannot find module './prisma.service'`.

- [ ] **Step 3: Add the shared Prisma module and reconcile the schema for persistence**

```ts
// apps/api/src/common/prisma/prisma.service.ts
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

```ts
// apps/api/src/common/prisma/prisma.module.ts
import { Global, Module } from '@nestjs/common';

import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

```prisma
// apps/api/prisma/schema.prisma
model Viewer {
  id              String      @id @default(cuid())
  userId          String
  name            String
  mobile          String
  idCardEncrypted String
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt
  orderItems      OrderItem[]

  @@index([userId, createdAt])
}

model Order {
  id             String             @id @default(cuid())
  orderNumber    String             @unique
  userId         String
  status         OrderStatus
  ticketType     TicketType
  totalAmount    Int
  currency       String             @default("CNY")
  createdAt      DateTime           @default(now())
  updatedAt      DateTime           @updatedAt
  items          OrderItem[]
  payments       Payment[]
  fulfillments   FulfillmentEvent[]
  refundRequests RefundRequest[]

  @@index([userId, createdAt])
}

model OrderItem {
  id           String     @id @default(cuid())
  orderId      String
  ticketTierId String
  viewerId     String
  quantity     Int
  unitPrice    Int
  totalAmount  Int
  createdAt    DateTime   @default(now())
  order        Order      @relation(fields: [orderId], references: [id], onDelete: Cascade)
  ticketTier   TicketTier @relation(fields: [ticketTierId], references: [id])
  viewer       Viewer     @relation(fields: [viewerId], references: [id])

  @@index([orderId])
  @@index([ticketTierId])
  @@index([viewerId])
}

model RefundRequest {
  id              String       @id @default(cuid())
  orderId         String
  refundNo        String?      @unique
  reason          String
  status          RefundStatus
  requestedAmount Int
  serviceFee      Int
  refundAmount    Int
  requestedBy     String?
  requestedAt     DateTime     @default(now())
  processedAt     DateTime?
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt
  order           Order        @relation(fields: [orderId], references: [id], onDelete: Cascade)

  @@index([orderId, requestedAt])
}
```

```ts
// apps/api/src/app.module.ts
import { PrismaModule } from './common/prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    HealthModule,
    AuthModule,
    ViewersModule,
    CatalogModule,
    CheckoutModule,
    FulfillmentModule,
    PaymentsModule,
    RefundsModule,
    RiskModule,
    NotificationsModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
})
export class AppModule {}
```

- [ ] **Step 4: Generate the Prisma client, apply the schema changes, and rerun the smoke test**

Run: `docker compose up -d postgres`

Expected: PASS with the `postgres` service running on port `5432`.

Run: `corepack pnpm --filter api prisma migrate dev --name ticketing_persistence_upgrade`

Expected: PASS with a new migration applied to the local `ticketing` database.

Run: `corepack pnpm --filter api prisma generate`

Expected: PASS with `Prisma Client` generated successfully.

Run: `corepack pnpm --filter api test -- prisma.service.spec.ts`

Expected: PASS with `1 passed`.

- [ ] **Step 5: Commit the Prisma foundation**

```bash
git add apps/api/prisma/schema.prisma apps/api/src/common/prisma apps/api/src/app.module.ts
git commit -m "feat: add prisma foundation for stateful ticketing flow"
```

### Task 2: Persist Viewers And Wire Temporary User Scope In The Miniapp

**Files:**
- Modify: `apps/api/src/modules/viewers/viewers.service.ts`
- Modify: `apps/api/src/modules/viewers/viewers.controller.ts`
- Modify: `apps/api/src/modules/viewers/viewers.service.spec.ts`
- Create: `apps/miniapp/src/constants/temp-user.ts`
- Modify: `apps/miniapp/src/pages/viewers/index.tsx`
- Modify: `apps/miniapp/src/pages/viewers/form.tsx`

- [ ] **Step 1: Rewrite the viewer test to fail on missing persistence behavior**

```ts
// apps/api/src/modules/viewers/viewers.service.spec.ts
import { ViewersService } from './viewers.service';

describe('ViewersService', () => {
  const encryptionKey =
    '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

  beforeEach(() => {
    process.env.VIEWER_ID_CARD_KEY = encryptionKey;
  });

  it('creates a persisted viewer payload with encrypted id card storage', async () => {
    const prisma = {
      viewer: {
        create: jest.fn().mockResolvedValue({
          id: 'viewer_1',
          name: '张三',
          mobile: '13800138000',
        }),
      },
    } as never;
    const service = new ViewersService(prisma);

    const result = await service.createViewer({
      userId: 'mock-user-id',
      name: '张三',
      idCard: '310101199001011234',
      mobile: '13800138000',
    });

    expect(prisma.viewer.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'mock-user-id',
        name: '张三',
        mobile: '13800138000',
        idCardEncrypted: expect.any(String),
      }),
      select: {
        id: true,
        name: true,
        mobile: true,
      },
    });
    expect(result).toEqual({
      id: 'viewer_1',
      name: '张三',
      mobile: '13800138000',
    });
  });

  it('lists persisted viewers by temporary user scope', async () => {
    const prisma = {
      viewer: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'viewer_2', name: '李四', mobile: '13900139000' },
        ]),
      },
    } as never;
    const service = new ViewersService(prisma);

    await expect(service.listViewersByUserId('mock-user-id')).resolves.toEqual([
      { id: 'viewer_2', name: '李四', mobile: '13900139000' },
    ]);
    expect(prisma.viewer.findMany).toHaveBeenCalledWith({
      where: { userId: 'mock-user-id' },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        mobile: true,
      },
    });
  });
});
```

- [ ] **Step 2: Run the viewer test and confirm the current service does not satisfy the persistence API**

Run: `corepack pnpm --filter api test -- viewers.service.spec.ts`

Expected: FAIL with `createViewer is not a function` or `listViewersByUserId is not a function`.

- [ ] **Step 3: Implement persisted viewer create/list behavior and reuse a shared temporary user id in the miniapp**

```ts
// apps/api/src/modules/viewers/viewers.service.ts
import { createCipheriv, randomBytes } from 'crypto';

import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../common/prisma/prisma.service';

type CreateViewerInput = {
  userId: string;
  name: string;
  idCard: string;
  mobile: string;
};

@Injectable()
export class ViewersService {
  private readonly encryptionKey = this.resolveEncryptionKey();

  constructor(private readonly prisma: PrismaService) {}

  async createViewer({ userId, name, idCard, mobile }: CreateViewerInput) {
    return this.prisma.viewer.create({
      data: {
        userId,
        name,
        mobile,
        idCardEncrypted: this.encryptIdCard(idCard),
      },
      select: {
        id: true,
        name: true,
        mobile: true,
      },
    });
  }

  async listViewersByUserId(userId: string) {
    return this.prisma.viewer.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        mobile: true,
      },
    });
  }

  private encryptIdCard(idCard: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv(
      'aes-256-gcm',
      Buffer.from(this.encryptionKey, 'hex'),
      iv,
    );
    const encrypted = Buffer.concat([
      cipher.update(idCard, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return [iv, authTag, encrypted]
      .map((segment) => segment.toString('base64'))
      .join('.');
  }

  private resolveEncryptionKey() {
    const encryptionKey =
      process.env.VIEWER_ID_CARD_KEY ?? process.env.PII_KEY;

    if (!encryptionKey || !/^[0-9a-fA-F]{64}$/.test(encryptionKey)) {
      throw new Error(
        'VIEWER_ID_CARD_KEY must be set to a 64-character hex string.',
      );
    }

    return encryptionKey;
  }
}
```

```ts
// apps/api/src/modules/viewers/viewers.controller.ts
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
} from '@nestjs/common';

import { ViewersService } from './viewers.service';

@Controller('viewers')
export class ViewersController {
  constructor(private readonly viewersService: ViewersService) {}

  @Get()
  async list(@Query('userId') userId?: string) {
    if (!userId || userId.trim().length === 0) {
      throw new BadRequestException('userId query parameter is required.');
    }

    return {
      items: await this.viewersService.listViewersByUserId(userId.trim()),
    };
  }

  @Post()
  async create(@Body() body: { userId: string; name: string; idCard: string; mobile: string }) {
    if (!body || !this.isCreateViewerBody(body)) {
      throw new BadRequestException(
        'userId, name, idCard, and mobile are required.',
      );
    }

    return this.viewersService.createViewer({
      userId: body.userId.trim(),
      name: body.name.trim(),
      idCard: body.idCard.trim(),
      mobile: body.mobile.trim(),
    });
  }

  private isCreateViewerBody(body: {
    userId: string;
    name: string;
    idCard: string;
    mobile: string;
  }) {
    return (
      typeof body.userId === 'string' &&
      body.userId.trim().length > 0 &&
      typeof body.name === 'string' &&
      body.name.trim().length > 0 &&
      typeof body.idCard === 'string' &&
      body.idCard.trim().length === 18 &&
      typeof body.mobile === 'string' &&
      /^1\d{10}$/.test(body.mobile.trim())
    );
  }
}
```

```ts
// apps/miniapp/src/constants/temp-user.ts
export const TEMP_USER_ID = 'mock-user-id';
```

```tsx
// apps/miniapp/src/pages/viewers/index.tsx
import { TEMP_USER_ID } from '../../constants/temp-user';

// inside useLoad:
void request<ViewersResponse>({
  url: `/viewers?userId=${encodeURIComponent(TEMP_USER_ID)}`,
}).then((response) => {
  setItems(response.items ?? []);
});
```

```tsx
// apps/miniapp/src/pages/viewers/form.tsx
import { TEMP_USER_ID } from '../../constants/temp-user';

// inside submit():
await request({
  data: {
    ...formState,
    userId: TEMP_USER_ID,
  } satisfies CreateViewerPayload,
  method: 'POST',
  url: '/viewers',
});
```

- [ ] **Step 4: Run the viewer persistence test**

Run: `corepack pnpm --filter api test -- viewers.service.spec.ts`

Expected: PASS with `2 passed`.

- [ ] **Step 5: Commit the viewer persistence slice**

```bash
git add apps/api/src/modules/viewers apps/miniapp/src/constants/temp-user.ts apps/miniapp/src/pages/viewers
git commit -m "feat: persist viewers by temporary user scope"
```

### Task 3: Persist Draft Orders And Order Items

**Files:**
- Modify: `apps/api/src/modules/checkout/checkout.service.ts`
- Modify: `apps/api/src/modules/checkout/checkout.service.spec.ts`
- Modify: `apps/api/src/modules/orders/orders.controller.ts`
- Modify: `apps/api/src/modules/checkout/checkout.module.ts`

- [ ] **Step 1: Rewrite the checkout test to fail on missing database-backed order creation**

```ts
// apps/api/src/modules/checkout/checkout.service.spec.ts
import { CheckoutService } from './checkout.service';

describe('CheckoutService', () => {
  it('creates a persisted draft order and one order item per viewer', async () => {
    const tx = {
      ticketTier: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'tier_vip',
          price: 128000,
          ticketType: 'E_TICKET',
        }),
      },
      viewer: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'viewer_1', userId: 'mock-user-id' },
          { id: 'viewer_2', userId: 'mock-user-id' },
        ]),
      },
      order: {
        create: jest.fn().mockResolvedValue({
          id: 'ord_1',
          orderNumber: 'ORD-20260417-0001',
          status: 'PENDING_PAYMENT',
          ticketType: 'E_TICKET',
          totalAmount: 256000,
          currency: 'CNY',
          createdAt: new Date('2026-04-17T00:00:00.000Z'),
        }),
      },
      orderItem: {
        createMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    } as never;
    const service = new CheckoutService(prisma);

    const result = await service.createDraftOrder({
      userId: 'mock-user-id',
      tierId: 'tier_vip',
      viewerIds: ['viewer_1', 'viewer_2'],
      quantity: 2,
      ticketType: 'E_TICKET',
    });

    expect(tx.order.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'mock-user-id',
        status: 'PENDING_PAYMENT',
        ticketType: 'E_TICKET',
        totalAmount: 256000,
      }),
    });
    expect(tx.orderItem.createMany).toHaveBeenCalledWith({
      data: [
        {
          orderId: 'ord_1',
          ticketTierId: 'tier_vip',
          viewerId: 'viewer_1',
          quantity: 1,
          unitPrice: 128000,
          totalAmount: 128000,
        },
        {
          orderId: 'ord_1',
          ticketTierId: 'tier_vip',
          viewerId: 'viewer_2',
          quantity: 1,
          unitPrice: 128000,
          totalAmount: 128000,
        },
      ],
    });
    expect(result).toMatchObject({
      id: 'ord_1',
      userId: 'mock-user-id',
      tierId: 'tier_vip',
      viewerIds: ['viewer_1', 'viewer_2'],
      quantity: 2,
      ticketType: 'E_TICKET',
      status: 'PENDING_PAYMENT',
    });
  });
});
```

- [ ] **Step 2: Run the checkout test to confirm the current service is still synthetic**

Run: `corepack pnpm --filter api test -- checkout.service.spec.ts`

Expected: FAIL because `CheckoutService` does not call Prisma and does not create order records.

- [ ] **Step 3: Implement persisted draft-order creation**

```ts
// apps/api/src/modules/checkout/checkout.service.ts
import { BadRequestException, Injectable } from '@nestjs/common';

import { PrismaService } from '../../common/prisma/prisma.service';
import { ORDER_STATUS, type OrderStatus } from '../orders/order-status';

export const DRAFT_ORDER_HOLD_WINDOW_MS = 15 * 60 * 1000;
export type TicketType = 'E_TICKET' | 'PAPER_TICKET';

export interface CreateDraftOrderInput {
  userId: string;
  tierId: string;
  viewerIds: string[];
  quantity: number;
  ticketType: TicketType;
}

export interface DraftOrder {
  id: string;
  userId: string;
  tierId: string;
  viewerIds: string[];
  quantity: number;
  ticketType: TicketType;
  status: OrderStatus;
  createdAt: string;
  inventoryLockExpiresAt: string;
}

@Injectable()
export class CheckoutService {
  constructor(private readonly prisma: PrismaService) {}

  async createDraftOrder(input: CreateDraftOrderInput): Promise<DraftOrder> {
    const createdAt = new Date();
    const inventoryLockExpiresAt = new Date(
      createdAt.getTime() + DRAFT_ORDER_HOLD_WINDOW_MS,
    );

    const order = await this.prisma.$transaction(async (tx) => {
      const tier = await tx.ticketTier.findUnique({
        where: { id: input.tierId },
        select: {
          id: true,
          price: true,
          ticketType: true,
        },
      });

      if (!tier) {
        throw new BadRequestException('tierId does not exist.');
      }

      if (tier.ticketType !== input.ticketType) {
        throw new BadRequestException('ticketType does not match tier.');
      }

      const viewers = await tx.viewer.findMany({
        where: {
          id: { in: input.viewerIds },
          userId: input.userId,
        },
        select: { id: true },
      });

      if (viewers.length !== input.viewerIds.length) {
        throw new BadRequestException(
          'viewerIds must belong to the submitting user.',
        );
      }

      const unitPrice = tier.price;
      const orderRecord = await tx.order.create({
        data: {
          orderNumber: `ORD-${createdAt.getTime()}`,
          userId: input.userId,
          status: ORDER_STATUS.PENDING_PAYMENT,
          ticketType: input.ticketType,
          totalAmount: unitPrice * input.viewerIds.length,
        },
      });

      await tx.orderItem.createMany({
        data: input.viewerIds.map((viewerId) => ({
          orderId: orderRecord.id,
          ticketTierId: input.tierId,
          viewerId,
          quantity: 1,
          unitPrice,
          totalAmount: unitPrice,
        })),
      });

      return orderRecord;
    });

    return {
      id: order.id,
      userId: input.userId,
      tierId: input.tierId,
      viewerIds: [...input.viewerIds],
      quantity: input.quantity,
      ticketType: input.ticketType,
      status: order.status,
      createdAt: order.createdAt.toISOString(),
      inventoryLockExpiresAt: inventoryLockExpiresAt.toISOString(),
    };
  }
}
```

```ts
// apps/api/src/modules/orders/orders.controller.ts
@Post('draft')
async createDraftOrder(@Body() body: unknown) {
  assertCreateDraftOrderInput(body);
  return this.checkoutService.createDraftOrder(body);
}
```

- [ ] **Step 4: Run the checkout persistence test**

Run: `corepack pnpm --filter api test -- checkout.service.spec.ts`

Expected: PASS with `1 passed`.

- [ ] **Step 5: Commit the persisted draft-order slice**

```bash
git add apps/api/src/modules/checkout apps/api/src/modules/orders/orders.controller.ts
git commit -m "feat: persist draft orders and order items"
```

### Task 4: Persist Payment Callback Transitions

**Files:**
- Modify: `apps/api/src/modules/payments/wechat-pay.service.ts`
- Modify: `apps/api/src/modules/payments/payments.service.spec.ts`

- [ ] **Step 1: Rewrite the payment test to fail on missing persisted transition behavior**

```ts
// apps/api/src/modules/payments/payments.service.spec.ts
import { PaymentsService } from './wechat-pay.service';

describe('PaymentsService', () => {
  it('persists the payment callback and advances the order status', async () => {
    const tx = {
      payment: {
        upsert: jest.fn().mockResolvedValue({
          orderId: 'ord_1',
          providerTxnId: 'wx_1',
          amount: 128000,
          paidAt: new Date('2026-04-17T01:00:00.000Z'),
        }),
      },
      order: {
        update: jest.fn().mockResolvedValue({
          id: 'ord_1',
          status: 'PAID_PENDING_FULFILLMENT',
        }),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    } as never;
    const service = new PaymentsService(prisma);

    const result = await service.buildPaidTransition({
      orderId: 'ord_1',
      providerTxnId: 'wx_1',
      amount: 128000,
    });

    expect(tx.payment.upsert).toHaveBeenCalled();
    expect(tx.order.update).toHaveBeenCalledWith({
      where: { id: 'ord_1' },
      data: { status: 'PAID_PENDING_FULFILLMENT' },
    });
    expect(result.orderStatus).toBe('PAID_PENDING_FULFILLMENT');
    expect(result.providerTxnId).toBe('wx_1');
  });
});
```

- [ ] **Step 2: Run the payment test to confirm the current service only maps payloads**

Run: `corepack pnpm --filter api test -- payments.service.spec.ts`

Expected: FAIL because `PaymentsService` does not use Prisma or update order state.

- [ ] **Step 3: Implement persisted payment callbacks**

```ts
// apps/api/src/modules/payments/wechat-pay.service.ts
import { Injectable } from '@nestjs/common';
import { PaymentMethod, PaymentStatus } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import { ORDER_STATUS } from '../orders/order-status';

export type PaidCallbackInput = {
  amount: number;
  orderId: string;
  providerTxnId: string;
};

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async buildPaidTransition({
    amount,
    orderId,
    providerTxnId,
  }: PaidCallbackInput) {
    const paidAt = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.payment.upsert({
        where: { providerTxnId },
        update: {
          amount,
          method: PaymentMethod.WECHAT_PAY,
          status: PaymentStatus.SUCCEEDED,
          paidAt,
        },
        create: {
          orderId,
          amount,
          method: PaymentMethod.WECHAT_PAY,
          status: PaymentStatus.SUCCEEDED,
          providerTxnId,
          paidAt,
        },
      });

      await tx.order.update({
        where: { id: orderId },
        data: {
          status: ORDER_STATUS.PAID_PENDING_FULFILLMENT,
        },
      });
    });

    return {
      amount,
      orderId,
      orderStatus: ORDER_STATUS.PAID_PENDING_FULFILLMENT,
      paidAt: paidAt.toISOString(),
      providerTxnId,
    };
  }
}
```

- [ ] **Step 4: Run the payment transition test**

Run: `corepack pnpm --filter api test -- payments.service.spec.ts`

Expected: PASS with `1 passed`.

- [ ] **Step 5: Commit the payment persistence slice**

```bash
git add apps/api/src/modules/payments
git commit -m "feat: persist payment callback transitions"
```

### Task 5: Persist Fulfillment Events And Order Status Updates

**Files:**
- Modify: `apps/api/src/modules/fulfillment/fulfillment-events.service.ts`
- Modify: `apps/api/src/modules/fulfillment/fulfillment-events.service.spec.ts`

- [ ] **Step 1: Rewrite the fulfillment test to fail on missing event persistence**

```ts
// apps/api/src/modules/fulfillment/fulfillment-events.service.spec.ts
import { FulfillmentEventsService } from './fulfillment-events.service';

describe('FulfillmentEventsService', () => {
  it('persists manual issuance and advances the order to ticket issued', async () => {
    const tx = {
      fulfillmentEvent: {
        create: jest.fn().mockResolvedValue({ id: 'ful_1' }),
      },
      order: {
        update: jest.fn().mockResolvedValue({
          id: 'ord_1',
          status: 'TICKET_ISSUED',
        }),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    } as never;
    const service = new FulfillmentEventsService(prisma);

    const result = await service.recordManualIssued({
      orderId: 'ord_1',
      operatorId: 'admin_1',
      ticketCode: 'ETK123456',
    });

    expect(tx.fulfillmentEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orderId: 'ord_1',
        status: 'ISSUED',
        payload: expect.objectContaining({
          operatorId: 'admin_1',
          ticketCode: 'ETK123456',
        }),
      }),
    });
    expect(tx.order.update).toHaveBeenCalledWith({
      where: { id: 'ord_1' },
      data: { status: 'TICKET_ISSUED' },
    });
    expect(result.nextStatus).toBe('TICKET_ISSUED');
    expect(result.source).toBe('MANUAL');
  });
});
```

- [ ] **Step 2: Run the fulfillment test to confirm the service is still a pure mapper**

Run: `corepack pnpm --filter api test -- fulfillment-events.service.spec.ts`

Expected: FAIL because no Prisma writes happen.

- [ ] **Step 3: Implement persisted fulfillment transitions**

```ts
// apps/api/src/modules/fulfillment/fulfillment-events.service.ts
import { Injectable } from '@nestjs/common';
import { FulfillmentStatus } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';

export type FulfillmentEventSource = 'MANUAL' | 'VENDOR_CALLBACK';

export type FulfillmentTransition = {
  orderId: string;
  ticketCode: string;
  nextStatus: 'TICKET_ISSUED';
  source: FulfillmentEventSource;
  operatorId?: string;
  vendorEventId?: string;
};

@Injectable()
export class FulfillmentEventsService {
  constructor(private readonly prisma: PrismaService) {}

  async recordManualIssued(input: {
    orderId: string;
    operatorId: string;
    ticketCode: string;
  }): Promise<FulfillmentTransition> {
    await this.prisma.$transaction(async (tx) => {
      await tx.fulfillmentEvent.create({
        data: {
          orderId: input.orderId,
          status: FulfillmentStatus.ISSUED,
          payload: {
            operatorId: input.operatorId,
            ticketCode: input.ticketCode,
            source: 'MANUAL',
          },
        },
      });

      await tx.order.update({
        where: { id: input.orderId },
        data: { status: 'TICKET_ISSUED' },
      });
    });

    return {
      ...input,
      nextStatus: 'TICKET_ISSUED',
      source: 'MANUAL',
    };
  }

  async recordVendorCallbackIssued(input: {
    orderId: string;
    vendorEventId: string;
    ticketCode: string;
  }): Promise<FulfillmentTransition> {
    await this.prisma.$transaction(async (tx) => {
      await tx.fulfillmentEvent.create({
        data: {
          orderId: input.orderId,
          status: FulfillmentStatus.ISSUED,
          externalRef: input.vendorEventId,
          payload: {
            vendorEventId: input.vendorEventId,
            ticketCode: input.ticketCode,
            source: 'VENDOR_CALLBACK',
          },
        },
      });

      await tx.order.update({
        where: { id: input.orderId },
        data: { status: 'TICKET_ISSUED' },
      });
    });

    return {
      ...input,
      nextStatus: 'TICKET_ISSUED',
      source: 'VENDOR_CALLBACK',
    };
  }
}
```

- [ ] **Step 4: Run the fulfillment persistence test**

Run: `corepack pnpm --filter api test -- fulfillment-events.service.spec.ts`

Expected: PASS with `1 passed`.

- [ ] **Step 5: Commit the fulfillment persistence slice**

```bash
git add apps/api/src/modules/fulfillment
git commit -m "feat: persist fulfillment events"
```

### Task 6: Persist Refund Requests And Vendor Refund Callbacks

**Files:**
- Modify: `apps/api/src/modules/refunds/refunds.service.ts`
- Modify: `apps/api/src/modules/refunds/refunds.controller.ts`
- Modify: `apps/api/src/modules/refunds/refunds.service.spec.ts`

- [ ] **Step 1: Rewrite the refunds test to fail on missing persisted refund behavior**

```ts
// apps/api/src/modules/refunds/refunds.service.spec.ts
import { RefundsService } from './refunds.service';

describe('RefundsService', () => {
  it('creates a persisted refund request with service-fee math applied', async () => {
    const tx = {
      order: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'ord_1',
          totalAmount: 100000,
        }),
        update: jest.fn().mockResolvedValue({
          id: 'ord_1',
          status: 'REFUND_REVIEWING',
        }),
      },
      refundRequest: {
        create: jest.fn().mockResolvedValue({
          id: 'ref_1',
          refundNo: 'RFD-1713312000000',
          status: 'REVIEWING',
          requestedAmount: 100000,
          serviceFee: 20000,
          refundAmount: 80000,
        }),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    } as never;
    const service = new RefundsService(prisma);

    const result = await service.requestRefund({
      orderId: 'ord_1',
      reasonCode: 'USER_IDENTITY_ERROR',
      daysBeforeStart: 2,
    });

    expect(tx.refundRequest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orderId: 'ord_1',
        refundNo: expect.stringMatching(/^RFD-/),
        status: 'REVIEWING',
        requestedAmount: 100000,
        serviceFee: 20000,
        refundAmount: 80000,
      }),
    });
    expect(result.serviceFee).toBe(20000);
    expect(result.refundAmount).toBe(80000);
  });

  it('updates the persisted refund request when the vendor callback arrives', async () => {
    const tx = {
      refundRequest: {
        update: jest.fn().mockResolvedValue({
          orderId: 'ord_1',
          refundNo: 'RFD-001',
          refundAmount: 80000,
        }),
      },
      order: {
        update: jest.fn().mockResolvedValue({
          id: 'ord_1',
          status: 'REFUNDED',
        }),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    } as never;
    const service = new RefundsService(prisma);

    const result = await service.recordVendorRefund({
      orderId: 'ord_1',
      refundNo: 'RFD-001',
      amount: 80000,
    });

    expect(tx.refundRequest.update).toHaveBeenCalledWith({
      where: { refundNo: 'RFD-001' },
      data: expect.objectContaining({
        status: 'COMPLETED',
        refundAmount: 80000,
      }),
    });
    expect(result.nextStatus).toBe('REFUNDED');
  });
});
```

- [ ] **Step 2: Run the refund test to confirm persistence behavior does not exist yet**

Run: `corepack pnpm --filter api test -- refunds.service.spec.ts`

Expected: FAIL because `requestRefund` and `recordVendorRefund` do not exist.

- [ ] **Step 3: Implement persisted refund request and callback behavior**

```ts
// apps/api/src/modules/refunds/refunds.service.ts
import { BadRequestException, Injectable } from '@nestjs/common';
import { RefundStatus } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';

export type RefundReasonCode = 'USER_IDENTITY_ERROR' | 'OTHER';

@Injectable()
export class RefundsService {
  constructor(private readonly prisma: PrismaService) {}

  calculateServiceFee(input: {
    totalAmount: number;
    reasonCode: RefundReasonCode;
    daysBeforeStart: number;
  }) {
    const serviceFee =
      input.reasonCode === 'USER_IDENTITY_ERROR' && input.daysBeforeStart <= 3
        ? Math.floor(input.totalAmount * 0.2)
        : 0;

    return {
      refundAmount: input.totalAmount - serviceFee,
      serviceFee,
    };
  }

  async requestRefund(input: {
    orderId: string;
    reasonCode: RefundReasonCode;
    daysBeforeStart: number;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: input.orderId },
        select: {
          id: true,
          totalAmount: true,
        },
      });

      if (!order) {
        throw new BadRequestException('orderId does not exist.');
      }

      const fee = this.calculateServiceFee({
        totalAmount: order.totalAmount,
        reasonCode: input.reasonCode,
        daysBeforeStart: input.daysBeforeStart,
      });

      const refundNo = `RFD-${Date.now()}`;

      await tx.refundRequest.create({
        data: {
          orderId: order.id,
          refundNo,
          reason: input.reasonCode,
          status: RefundStatus.REVIEWING,
          requestedAmount: order.totalAmount,
          serviceFee: fee.serviceFee,
          refundAmount: fee.refundAmount,
        },
      });

      await tx.order.update({
        where: { id: order.id },
        data: { status: 'REFUND_REVIEWING' },
      });

      return {
        orderId: order.id,
        refundNo,
        ...fee,
      };
    });
  }

  async recordVendorRefund(input: {
    orderId: string;
    refundNo: string;
    amount: number;
  }) {
    await this.prisma.$transaction(async (tx) => {
      await tx.refundRequest.update({
        where: { refundNo: input.refundNo },
        data: {
          status: RefundStatus.COMPLETED,
          refundAmount: input.amount,
          processedAt: new Date(),
        },
      });

      await tx.order.update({
        where: { id: input.orderId },
        data: { status: 'REFUNDED' },
      });
    });

    return {
      orderId: input.orderId,
      refundNo: input.refundNo,
      amount: input.amount,
      source: 'VENDOR_CALLBACK' as const,
      nextStatus: 'REFUNDED' as const,
    };
  }
}
```

```ts
// apps/api/src/modules/refunds/refunds.controller.ts
@Post('request')
requestRefund(
  @Body()
  body: {
    orderId: string;
    reasonCode: RefundReasonCode;
    daysBeforeStart: number;
  },
) {
  if (
    !body ||
    typeof body.orderId !== 'string' ||
    body.orderId.trim().length === 0 ||
    (body.reasonCode !== 'USER_IDENTITY_ERROR' && body.reasonCode !== 'OTHER') ||
    !Number.isInteger(body.daysBeforeStart) ||
    body.daysBeforeStart < 0
  ) {
    throw new BadRequestException(
      'orderId, reasonCode, and daysBeforeStart are required.',
    );
  }

  return this.refundsService.requestRefund({
    orderId: body.orderId.trim(),
    reasonCode: body.reasonCode,
    daysBeforeStart: body.daysBeforeStart,
  });
}

@Post('vendor-callback')
handleVendorCallback(@Body() body: unknown) {
  assertVendorRefundCallbackRequest(body);

  return this.refundsService.recordVendorRefund({
    orderId: body.orderId,
    refundNo: body.refundNo,
    amount: body.amount,
  });
}
```

- [ ] **Step 4: Run the refund persistence test**

Run: `corepack pnpm --filter api test -- refunds.service.spec.ts`

Expected: PASS with `2 passed` plus the existing fee-calculation checks.

- [ ] **Step 5: Commit the refund persistence slice**

```bash
git add apps/api/src/modules/refunds
git commit -m "feat: persist refund requests and callbacks"
```

### Task 7: Run The Full Persistence Regression Pass

**Files:**
- Verify only: existing repo files from Tasks 1-6

- [ ] **Step 1: Re-run the targeted API persistence tests**

Run: `corepack pnpm --filter api test -- prisma.service.spec.ts viewers.service.spec.ts checkout.service.spec.ts payments.service.spec.ts fulfillment-events.service.spec.ts refunds.service.spec.ts`

Expected: PASS with all targeted suites green.

- [ ] **Step 2: Re-run the repo lint baseline**

Run: `corepack pnpm lint`

Expected: PASS with all workspace lint commands and the repo-level `tests` lint check succeeding.

- [ ] **Step 3: Re-run the repo test baseline**

Run: `corepack pnpm test`

Expected: PASS with API Jest suites, shared contracts tests, and workspace layout tests all green.

- [ ] **Step 4: Validate the final Prisma schema**

Run: `corepack pnpm --filter api prisma validate`

Expected: PASS with `The schema at prisma/schema.prisma is valid`.

- [ ] **Step 5: Commit the persistence upgrade**

```bash
git add apps/api/prisma apps/api/src apps/miniapp/src
git commit -m "feat: persist the core ticketing MVP flow"
```

## Plan Self-Review

### Spec Coverage

- shared Prisma access and PostgreSQL wiring: Task 1
- viewer persistence and temporary user scoping: Task 2
- draft order and order-item persistence: Task 3
- payment callback persistence: Task 4
- fulfillment persistence: Task 5
- refund request and callback persistence: Task 6
- root verification continuity: Task 7

### Placeholder Scan

- no unresolved placeholder markers remain in the tasks
- every task contains exact file paths, commands, and code snippets
- the only deferred behaviors are explicit scope boundaries already captured in the spec

### Type Consistency

- `VIEWER_ID_CARD_KEY`, `userId`, `refundNo`, `ticketType`, and order status strings are spelled consistently across tasks
- viewer persistence uses encrypted id-card storage and list responses with `id/name/mobile` throughout
- refund persistence uses `POST /refunds/request` and `recordVendorRefund()` consistently
