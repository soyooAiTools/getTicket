# Ticketing B Internal Beta Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the current persisted ticketing skeleton into a single-event `B` internal beta with authenticated miniapp customers, real WeChat payment, interface-driven fulfillment/refund flow, and live admin operations consoles.

**Architecture:** Add a persistent customer-session auth layer for miniapp traffic, replace synthetic event and order reads with Prisma-backed services, then wire the checkout, payment, fulfillment, refund, and admin screens to real APIs. Keep scope fixed to one live event, but make the main sales path fully real-money and callback-driven while preserving small-scale operational recovery tools.

**Tech Stack:** NestJS, Prisma, PostgreSQL, Taro miniapp, React + Ant Design admin, Zod, Jest, Vitest, WeChat Mini Program login/payment APIs

---

## Proposed File Structure

- `apps/api/prisma/schema.prisma`
  Responsibility: add customer accounts/sessions plus event operational flags used by the beta.
- `apps/api/prisma/migrations/<timestamp>_ticketing_b_internal_beta/migration.sql`
  Responsibility: persist the schema changes for customer auth and event switches.
- `packages/contracts/src/auth.ts`
  Responsibility: shared login/session response schema for miniapp auth.
- `packages/contracts/src/payment.ts`
  Responsibility: shared WeChat payment-intent schema for checkout.
- `packages/contracts/src/event.ts`
  Responsibility: shared event-detail and event-operations schemas.
- `packages/contracts/src/order.ts`
  Responsibility: shared order-list, order-detail timeline, and refund-entry schemas.
- `packages/contracts/src/index.ts`
  Responsibility: export new contract schemas.
- `packages/contracts/src/contracts.spec.ts`
  Responsibility: keep new contracts validated with fast schema tests.
- `apps/api/src/modules/auth/wechat-auth.service.ts`
  Responsibility: exchange WeChat login code, upsert customer account, create customer session token.
- `apps/api/src/modules/auth/auth.controller.ts`
  Responsibility: expose the real miniapp login route.
- `apps/api/src/modules/auth/wechat-auth.service.spec.ts`
  Responsibility: verify customer account upsert and session token issuance.
- `apps/api/src/common/auth/current-customer.decorator.ts`
  Responsibility: surface the authenticated customer on request handlers.
- `apps/api/src/common/auth/customer-session.guard.ts`
  Responsibility: resolve and verify bearer session tokens for miniapp routes.
- `apps/api/src/common/auth/customer-session.guard.spec.ts`
  Responsibility: verify token-hash lookup and expired-session rejection.
- `apps/api/src/modules/viewers/viewers.controller.ts`
  Responsibility: bind viewer routes to authenticated customers instead of caller-supplied `userId`.
- `apps/api/src/modules/orders/orders.controller.ts`
  Responsibility: expose authenticated draft-order create, order list, and order detail APIs.
- `apps/api/src/modules/orders/orders.service.ts`
  Responsibility: query current-customer orders, timeline data, and order detail payloads.
- `apps/api/src/modules/orders/orders.service.spec.ts`
  Responsibility: verify order list/detail projection logic.
- `apps/api/src/modules/catalog/catalog.service.ts`
  Responsibility: query the single beta event, event detail, and admin sale/refund switch state from Prisma.
- `apps/api/src/modules/catalog/catalog.controller.ts`
  Responsibility: expose public event browse routes plus narrow admin event-operation routes.
- `apps/api/src/modules/catalog/catalog.service.spec.ts`
  Responsibility: verify event listing/detail and admin toggle behavior.
- `apps/api/src/modules/payments/wechat-pay.gateway.ts`
  Responsibility: create real WeChat JSAPI payment intents.
- `apps/api/src/modules/payments/wechat-pay.service.ts`
  Responsibility: build payment intents, persist callback success, and hand paid orders into fulfillment submission.
- `apps/api/src/modules/payments/payments.controller.ts`
  Responsibility: expose create-intent and callback routes.
- `apps/api/src/modules/payments/payments.service.spec.ts`
  Responsibility: verify payment-intent creation and callback transition behavior.
- `apps/api/src/common/vendors/upstream-ticketing.gateway.ts`
  Responsibility: submit paid orders and refund requests to the upstream ticketing interface.
- `apps/api/src/common/vendors/upstream-ticketing.gateway.spec.ts`
  Responsibility: verify upstream request payload shaping and error mapping.
- `apps/api/src/modules/fulfillment/fulfillment-events.service.ts`
  Responsibility: submit paid orders upstream, record callbacks, and expose fulfillment admin list data.
- `apps/api/src/modules/fulfillment/fulfillment.controller.ts`
  Responsibility: expose vendor callback and admin query routes.
- `apps/api/src/modules/fulfillment/fulfillment-events.service.spec.ts`
  Responsibility: verify upstream submission and callback state transitions.
- `apps/api/src/modules/refunds/refunds.service.ts`
  Responsibility: create refund requests, call upstream refund interface, and record refund callbacks.
- `apps/api/src/modules/refunds/refunds.controller.ts`
  Responsibility: expose authenticated refund request plus admin list and vendor callback routes.
- `apps/api/src/modules/refunds/refunds.service.spec.ts`
  Responsibility: verify fee calculation, upstream refund submission, and callback transitions.
- `apps/miniapp/src/services/session.ts`
  Responsibility: bootstrap miniapp login with `wx.login`, persist customer session, and expose `ensureSession()`.
- `apps/miniapp/src/services/request.ts`
  Responsibility: attach bearer tokens to miniapp API requests automatically.
- `apps/miniapp/src/utils/pay.ts`
  Responsibility: normalize WeChat payment request invocation for the new intent payload.
- `apps/miniapp/src/pages/home/index.tsx`
  Responsibility: show the single beta event and sale state from live data.
- `apps/miniapp/src/pages/events/index.tsx`
  Responsibility: list the one live event from the catalog API.
- `apps/miniapp/src/pages/event-detail/index.tsx`
  Responsibility: show real session/tier detail, rules, and refund timing copy.
- `apps/miniapp/src/pages/viewers/index.tsx`
  Responsibility: load authenticated viewers without temporary user ids.
- `apps/miniapp/src/pages/viewers/form.tsx`
  Responsibility: create authenticated viewers.
- `apps/miniapp/src/pages/checkout/index.tsx`
  Responsibility: create a draft order and start real WeChat payment.
- `apps/miniapp/src/pages/payment-result/index.tsx`
  Responsibility: show the immediate post-payment state and redirect into order detail.
- `apps/miniapp/src/pages/orders/index.tsx`
  Responsibility: show current-customer orders with high-signal statuses.
- `apps/miniapp/src/pages/order-detail/index.tsx`
  Responsibility: show the canonical customer order state, timeline, refund entry, and support messaging.
- `apps/miniapp/src/pages/after-sales/index.tsx`
  Responsibility: submit refund requests and explain the 20% late information-error fee rule.
- `apps/miniapp/src/pages/me/index.tsx`
  Responsibility: aggregate order, attendee, support, and policy entry points.
- `apps/miniapp/package.json`
  Responsibility: add the missing Taro React framework plugin needed for build verification.
- `apps/admin/src/services/request.ts`
  Responsibility: shared API client for admin pages.
- `apps/admin/src/pages/events/index.tsx`
  Responsibility: operate the single beta event and its sale/refund switches.
- `apps/admin/src/pages/orders/index.tsx`
  Responsibility: show paid, issued, failed, and abnormal orders with filters.
- `apps/admin/src/pages/fulfillment/index.tsx`
  Responsibility: show vendor submission and issuance exceptions.
- `apps/admin/src/pages/refunds/index.tsx`
  Responsibility: show refund requests, processing state, and callback outcome.
- `.env.example`
  Responsibility: document every secret and switch required for beta auth, payment, and upstream integration.
- `README.md`
  Responsibility: document local setup, callback testing, and single-event rehearsal commands.

### Task 1: Add Customer Accounts, Sessions, And Real Miniapp Login

**Files:**
- Create: `packages/contracts/src/auth.ts`
- Modify: `packages/contracts/src/index.ts`
- Modify: `packages/contracts/src/contracts.spec.ts`
- Modify: `apps/api/prisma/schema.prisma`
- Modify: `apps/api/src/modules/auth/wechat-auth.service.ts`
- Modify: `apps/api/src/modules/auth/auth.controller.ts`
- Create: `apps/api/src/modules/auth/wechat-auth.service.spec.ts`
- Modify: `.env.example`

- [ ] **Step 1: Write the failing auth service test**

```ts
// apps/api/src/modules/auth/wechat-auth.service.spec.ts
import { WechatAuthService } from './wechat-auth.service';

describe('WechatAuthService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('exchanges a WeChat code, upserts the customer, and returns a session token', async () => {
    const prisma = {
      customerAccount: {
        upsert: jest.fn().mockResolvedValue({
          id: 'cust_1',
          wechatOpenId: 'openid_123',
        }),
      },
      customerSession: {
        create: jest.fn().mockResolvedValue({
          id: 'sess_1',
        }),
      },
    } as never;

    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        openid: 'openid_123',
        session_key: 'session-key',
      }),
    } as Response);

    const service = new WechatAuthService(prisma);

    const result = await service.loginWithCode('wx-code-1');

    expect(prisma.customerAccount.upsert).toHaveBeenCalled();
    expect(prisma.customerSession.create).toHaveBeenCalled();
    expect(result.customer.id).toBe('cust_1');
    expect(result.customer.openId).toBe('openid_123');
    expect(result.token).toEqual(expect.any(String));
  });
});
```

- [ ] **Step 2: Run the new auth test to confirm the real login flow does not exist yet**

Run: `corepack pnpm --filter api test -- wechat-auth.service.spec.ts`

Expected: FAIL with `loginWithCode is not a function` or missing Prisma delegate errors.

- [ ] **Step 3: Implement customer-account persistence and session token issuance**

```prisma
// apps/api/prisma/schema.prisma
model CustomerAccount {
  id           String            @id @default(cuid())
  wechatOpenId String            @unique
  nickname     String?
  createdAt    DateTime          @default(now())
  updatedAt    DateTime          @updatedAt
  sessions     CustomerSession[]
}

model CustomerSession {
  id         String          @id @default(cuid())
  customerId String
  tokenHash  String          @unique
  expiresAt  DateTime
  lastSeenAt DateTime        @default(now())
  createdAt  DateTime        @default(now())
  customer   CustomerAccount @relation(fields: [customerId], references: [id], onDelete: Cascade)

  @@index([customerId, expiresAt])
}

model Event {
  id                 String         @id @default(cuid())
  title              String
  city               String
  venueName          String
  venueAddress       String?
  coverImageUrl      String?
  description        String?
  saleStatus         SaleStatus
  published          Boolean        @default(false)
  refundEntryEnabled Boolean        @default(true)
  minPrice           Int
  createdAt          DateTime       @default(now())
  updatedAt          DateTime       @updatedAt
  sessions           EventSession[]
}
```

```ts
// packages/contracts/src/auth.ts
import { z } from 'zod';

export const miniappSessionSchema = z.object({
  token: z.string().min(1),
  customer: z.object({
    id: z.string().min(1),
    openId: z.string().min(1),
  }),
  expiresAt: z.string().datetime(),
});

export type MiniappSession = z.infer<typeof miniappSessionSchema>;
```

```ts
// apps/api/src/modules/auth/wechat-auth.service.ts
import { BadRequestException, Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';

import { PrismaService } from '../../common/prisma/prisma.service';

type WechatCode2SessionResponse = {
  errmsg?: string;
  errcode?: number;
  openid?: string;
  session_key?: string;
};

@Injectable()
export class WechatAuthService {
  constructor(private readonly prisma: PrismaService) {}

  async loginWithCode(code: string) {
    const response = await fetch(
      `https://api.weixin.qq.com/sns/jscode2session?appid=${process.env.WECHAT_APP_ID}&secret=${process.env.WECHAT_APP_SECRET}&js_code=${code}&grant_type=authorization_code`,
    );
    const payload =
      (await response.json()) as WechatCode2SessionResponse;

    if (!response.ok || !payload.openid) {
      throw new BadRequestException(
        payload.errmsg ?? 'WeChat login exchange failed.',
      );
    }

    const customer = await this.prisma.customerAccount.upsert({
      where: { wechatOpenId: payload.openid },
      update: {},
      create: { wechatOpenId: payload.openid },
      select: { id: true, wechatOpenId: true },
    });

    const rawToken = randomBytes(24).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.prisma.customerSession.create({
      data: {
        customerId: customer.id,
        expiresAt,
        tokenHash,
      },
    });

    return {
      token: rawToken,
      customer: {
        id: customer.id,
        openId: customer.wechatOpenId,
      },
      expiresAt: expiresAt.toISOString(),
    };
  }
}
```

```ts
// apps/api/src/modules/auth/auth.controller.ts
import { BadRequestException, Body, Controller, Post } from '@nestjs/common';

import { WechatAuthService } from './wechat-auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly wechatAuthService: WechatAuthService) {}

  @Post('wechat/login')
  login(@Body() body: { code: string }) {
    if (!body || typeof body.code !== 'string' || body.code.trim().length === 0) {
      throw new BadRequestException('code is required.');
    }

    return this.wechatAuthService.loginWithCode(body.code.trim());
  }
}
```

```ts
// packages/contracts/src/index.ts
export {
  miniappSessionSchema,
  type MiniappSession,
} from './auth';
```

```dotenv
// .env.example
WECHAT_APP_ID=your-wechat-app-id
WECHAT_APP_SECRET=your-wechat-miniapp-secret
WECHAT_MCH_ID=your-wechat-merchant-id
WECHAT_API_V3_KEY=your-wechat-pay-api-v3-key
```

- [ ] **Step 4: Generate Prisma artifacts and rerun the auth contract/service checks**

Run: `corepack pnpm --filter api prisma:generate`

Expected: PASS with Prisma Client regenerated.

Run: `corepack pnpm --filter api test -- wechat-auth.service.spec.ts`

Expected: PASS with `1 passed`.

Run: `corepack pnpm --filter @ticketing/contracts test -- contracts.spec.ts`

Expected: PASS with the new auth contract schema covered.

- [ ] **Step 5: Commit the auth foundation**

```bash
git add apps/api/prisma/schema.prisma apps/api/src/modules/auth packages/contracts/src .env.example
git commit -m "feat: add persistent miniapp customer login"
```

### Task 2: Replace Temporary User Scope With Authenticated Customer Scope

**Files:**
- Create: `apps/api/src/common/auth/current-customer.decorator.ts`
- Create: `apps/api/src/common/auth/customer-session.guard.ts`
- Create: `apps/api/src/common/auth/customer-session.guard.spec.ts`
- Modify: `apps/api/src/modules/viewers/viewers.controller.ts`
- Modify: `apps/api/src/modules/orders/orders.controller.ts`
- Modify: `apps/miniapp/src/services/request.ts`
- Create: `apps/miniapp/src/services/session.ts`
- Modify: `apps/miniapp/src/pages/viewers/index.tsx`
- Modify: `apps/miniapp/src/pages/viewers/form.tsx`
- Modify: `apps/miniapp/package.json`
- Delete: `apps/miniapp/src/constants/temp-user.ts`

- [ ] **Step 1: Write the failing session-guard test**

```ts
// apps/api/src/common/auth/customer-session.guard.spec.ts
import { UnauthorizedException } from '@nestjs/common';

import { CustomerSessionGuard } from './customer-session.guard';

describe('CustomerSessionGuard', () => {
  it('loads the customer from a bearer token', async () => {
    const prisma = {
      customerSession: {
        findFirst: jest.fn().mockResolvedValue({
          customer: { id: 'cust_1', wechatOpenId: 'openid_123' },
          expiresAt: new Date(Date.now() + 60_000),
          id: 'sess_1',
        }),
      },
    } as never;

    const guard = new CustomerSessionGuard(prisma);
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: {
            authorization: 'Bearer raw-token',
          },
        }),
      }),
    } as never;

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('rejects missing bearer tokens', async () => {
    const prisma = {
      customerSession: {
        findFirst: jest.fn(),
      },
    } as never;

    const guard = new CustomerSessionGuard(prisma);
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ headers: {} }),
      }),
    } as never;

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
```

- [ ] **Step 2: Run the guard test to confirm the authenticated customer layer does not exist yet**

Run: `corepack pnpm --filter api test -- customer-session.guard.spec.ts`

Expected: FAIL with `Cannot find module './customer-session.guard'`.

- [ ] **Step 3: Implement bearer-session resolution and remove caller-supplied `userId` from miniapp flows**

```ts
// apps/api/src/common/auth/current-customer.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentCustomer = createParamDecorator(
  (_data: unknown, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest();
    return request.customer as { id: string; openId: string };
  },
);
```

```ts
// apps/api/src/common/auth/customer-session.guard.ts
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash } from 'crypto';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CustomerSessionGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const authorization = request.headers.authorization;

    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Miniapp bearer token is required.');
    }

    const rawToken = authorization.slice('Bearer '.length).trim();
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const session = await this.prisma.customerSession.findFirst({
      where: {
        tokenHash,
        expiresAt: { gt: new Date() },
      },
      select: {
        customer: {
          select: {
            id: true,
            wechatOpenId: true,
          },
        },
      },
    });

    if (!session) {
      throw new UnauthorizedException('Miniapp session is invalid or expired.');
    }

    request.customer = {
      id: session.customer.id,
      openId: session.customer.wechatOpenId,
    };

    return true;
  }
}
```

```ts
// apps/api/src/modules/viewers/viewers.controller.ts
import { UseGuards } from '@nestjs/common';
import { CustomerSessionGuard } from '../../common/auth/customer-session.guard';
import { CurrentCustomer } from '../../common/auth/current-customer.decorator';

@UseGuards(CustomerSessionGuard)
@Controller('viewers')
export class ViewersController {
  @Get()
  async list(
    @CurrentCustomer() customer: { id: string },
  ) {
    return {
      items: await this.viewersService.listViewersByUserId(customer.id),
    };
  }

  @Post()
  async create(
    @CurrentCustomer() customer: { id: string },
    @Body() body: { name: string; idCard: string; mobile: string },
  ) {
    return this.viewersService.createViewer({
      userId: customer.id,
      name: body.name.trim(),
      idCard: body.idCard.trim(),
      mobile: body.mobile.trim(),
    });
  }
}
```

```ts
// apps/api/src/modules/orders/orders.controller.ts
@UseGuards(CustomerSessionGuard)
@Controller('orders')
export class OrdersController {
  @Post('draft')
  async createDraftOrder(
    @CurrentCustomer() customer: { id: string },
    @Body() body: Omit<CreateDraftOrderInput, 'userId'>,
  ) {
    return this.checkoutService.createDraftOrder({
      ...body,
      userId: customer.id,
    });
  }
}
```

```ts
// apps/miniapp/src/services/session.ts
import Taro from '@tarojs/taro';

const SESSION_STORAGE_KEY = 'miniapp-session';
let inflightSessionPromise: Promise<string> | null = null;

async function postLogin(code: string) {
  return new Promise<{ token: string }>((resolve, reject) => {
    wx.request({
      data: { code },
      header: { 'content-type': 'application/json' },
      method: 'POST',
      success: (response) => {
        if (response.statusCode >= 200 && response.statusCode < 300) {
          resolve(response.data as { token: string });
          return;
        }

        reject(new Error('Miniapp login failed.'));
      },
      fail: reject,
      url: 'http://localhost:3000/api/auth/wechat/login',
    });
  });
}

export async function ensureSession() {
  const existingToken = Taro.getStorageSync<string>(SESSION_STORAGE_KEY);

  if (existingToken) {
    return existingToken;
  }

  if (!inflightSessionPromise) {
    inflightSessionPromise = Taro.login()
      .then((result) => postLogin(result.code))
      .then((session) => {
        Taro.setStorageSync(SESSION_STORAGE_KEY, session.token);
        return session.token;
      })
      .finally(() => {
        inflightSessionPromise = null;
      });
  }

  return inflightSessionPromise;
}
```

```ts
// apps/miniapp/src/services/request.ts
import { ensureSession } from './session';

export async function request<TResponse, TData = Record<string, unknown>>({
  data,
  method = 'GET',
  url,
}: RequestOptions<TData>) {
  const token = url.startsWith('/auth/') ? null : await ensureSession();

  return new Promise<TResponse>((resolve, reject) => {
    wx.request({
      data,
      header: {
        'content-type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      method,
      success: (response) => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error('Request failed.'));
          return;
        }

        resolve(response.data as TResponse);
      },
      fail: reject,
      url: `${API_BASE_URL}${url}`,
    });
  });
}
```

```tsx
// apps/miniapp/src/pages/viewers/form.tsx
await request({
  data: formState,
  method: 'POST',
  url: '/viewers',
});
```

```json
// apps/miniapp/package.json
{
  "devDependencies": {
    "@tarojs/cli": "^4.1.6",
    "@tarojs/plugin-framework-react": "^4.1.6",
    "@tarojs/plugin-platform-weapp": "^4.1.6"
  }
}
```

- [ ] **Step 4: Verify the new auth scope and miniapp build path**

Run: `corepack pnpm --filter api test -- customer-session.guard.spec.ts viewers.service.spec.ts checkout.service.spec.ts`

Expected: PASS with the guard plus viewer/order ownership tests green.

Run: `corepack pnpm --filter miniapp build:weapp`

Expected: PASS with the previous missing-plugin build blocker removed.

- [ ] **Step 5: Commit the authenticated customer scope slice**

```bash
git add apps/api/src/common/auth apps/api/src/modules/viewers apps/api/src/modules/orders apps/miniapp/src/services apps/miniapp/src/pages/viewers apps/miniapp/package.json
git commit -m "feat: authenticate miniapp viewer and order flows"
```

### Task 3: Back The Single Beta Event With Prisma And Expose Sale/Refund Switches

**Files:**
- Modify: `packages/contracts/src/event.ts`
- Modify: `packages/contracts/src/index.ts`
- Modify: `packages/contracts/src/contracts.spec.ts`
- Modify: `apps/api/src/modules/catalog/catalog.service.ts`
- Modify: `apps/api/src/modules/catalog/catalog.controller.ts`
- Modify: `apps/api/src/modules/catalog/catalog.service.spec.ts`

- [ ] **Step 1: Write the failing catalog service test for real event detail and toggle support**

```ts
// apps/api/src/modules/catalog/catalog.service.spec.ts
import { CatalogService } from './catalog.service';

describe('CatalogService', () => {
  it('lists only published beta events and exposes their switches', async () => {
    const prisma = {
      event: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'event_beta_1',
            title: 'Beta Concert',
            city: 'Shanghai',
            venueName: 'Expo Arena',
            saleStatus: 'ON_SALE',
            published: true,
            refundEntryEnabled: true,
            minPrice: 79900,
          },
        ]),
      },
    } as never;

    const service = new CatalogService(prisma);

    await expect(service.listPublishedEvents()).resolves.toEqual([
      expect.objectContaining({
        id: 'event_beta_1',
        published: true,
        refundEntryEnabled: true,
      }),
    ]);
  });
});
```

- [ ] **Step 2: Run the catalog test to confirm the service is still using synthetic event arrays**

Run: `corepack pnpm --filter api test -- catalog.service.spec.ts`

Expected: FAIL because `CatalogService` does not use Prisma yet.

- [ ] **Step 3: Replace synthetic catalog data with Prisma reads and narrow admin event toggles**

```ts
// packages/contracts/src/event.ts
export const ticketTierSummarySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  price: z.number().int().nonnegative(),
  inventory: z.number().int().nonnegative(),
  ticketType: z.enum(['E_TICKET', 'PAPER_TICKET']),
});

export const eventDetailSchema = eventSummarySchema.extend({
  description: z.string().optional(),
  published: z.boolean(),
  refundEntryEnabled: z.boolean(),
  sessions: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      startsAt: z.string().datetime(),
      ticketTiers: z.array(ticketTierSummarySchema),
    }),
  ),
});

export type EventDetail = z.infer<typeof eventDetailSchema>;
```

```ts
// packages/contracts/src/index.ts
export {
  eventDetailSchema,
  ticketTierSummarySchema,
  type EventDetail,
} from './event';
```

```ts
// packages/contracts/src/contracts.spec.ts
import { eventDetailSchema } from './event';

it('parses the beta event detail contract', () => {
  expect(() =>
    eventDetailSchema.parse({
      id: 'event_beta_1',
      title: 'Beta Concert',
      city: 'Shanghai',
      venueName: 'Expo Arena',
      saleStatus: 'ON_SALE',
      minPrice: 79900,
      published: true,
      refundEntryEnabled: true,
      sessions: [],
    }),
  ).not.toThrow();
});
```

```ts
// apps/api/src/modules/catalog/catalog.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async listPublishedEvents() {
    return this.prisma.event.findMany({
      where: { published: true },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        city: true,
        venueName: true,
        coverImageUrl: true,
        saleStatus: true,
        minPrice: true,
        published: true,
        refundEntryEnabled: true,
      },
    });
  }

  async getEventDetail(eventId: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: {
        sessions: {
          include: {
            ticketTiers: true,
          },
          orderBy: { startsAt: 'asc' },
        },
      },
    });

    if (!event || !event.published) {
      throw new NotFoundException('Event not found.');
    }

    return event;
  }

  async updateEventOperations(eventId: string, input: {
    published?: boolean;
    refundEntryEnabled?: boolean;
    saleStatus?: 'UPCOMING' | 'ON_SALE' | 'SOLD_OUT';
  }) {
    return this.prisma.event.update({
      where: { id: eventId },
      data: input,
    });
  }
}
```

```ts
// apps/api/src/modules/catalog/catalog.controller.ts
import { BadRequestException, Body, Controller, Get, Param, Patch } from '@nestjs/common';

@Controller('catalog')
export class CatalogController {
  @Get('events')
  listEvents() {
    return { items: this.catalogService.listPublishedEvents() };
  }

  @Get('events/:eventId')
  getEvent(@Param('eventId') eventId: string) {
    return this.catalogService.getEventDetail(eventId);
  }

  @Patch('admin/events/:eventId')
  updateEventOperations(
    @Param('eventId') eventId: string,
    @Body() body: {
      published?: boolean;
      refundEntryEnabled?: boolean;
      saleStatus?: 'UPCOMING' | 'ON_SALE' | 'SOLD_OUT';
    },
  ) {
    if (!body || Object.keys(body).length === 0) {
      throw new BadRequestException('At least one event operation field is required.');
    }

    return this.catalogService.updateEventOperations(eventId, body);
  }
}
```

- [ ] **Step 4: Re-run catalog tests and confirm the event API shape**

Run: `corepack pnpm --filter api test -- catalog.service.spec.ts`

Expected: PASS with the service loading Prisma-backed event data.

Run: `corepack pnpm --filter @ticketing/contracts test -- contracts.spec.ts`

Expected: PASS with `eventDetailSchema` and event-operations parsing covered.

- [ ] **Step 5: Commit the single-event catalog slice**

```bash
git add packages/contracts/src/event.ts packages/contracts/src/index.ts packages/contracts/src/contracts.spec.ts apps/api/src/modules/catalog
git commit -m "feat: back the beta event catalog with prisma"
```

### Task 4: Add Current-Customer Order Queries And Real Miniapp Browse/Order Pages

**Files:**
- Modify: `packages/contracts/src/order.ts`
- Modify: `packages/contracts/src/index.ts`
- Modify: `packages/contracts/src/contracts.spec.ts`
- Create: `apps/api/src/modules/orders/orders.service.ts`
- Modify: `apps/api/src/modules/orders/orders.controller.ts`
- Modify: `apps/api/src/modules/orders/order-timeline.service.ts`
- Create: `apps/api/src/modules/orders/orders.service.spec.ts`
- Modify: `apps/miniapp/src/pages/home/index.tsx`
- Modify: `apps/miniapp/src/pages/events/index.tsx`
- Modify: `apps/miniapp/src/pages/event-detail/index.tsx`
- Modify: `apps/miniapp/src/pages/orders/index.tsx`
- Modify: `apps/miniapp/src/pages/order-detail/index.tsx`
- Modify: `apps/miniapp/src/pages/me/index.tsx`

- [ ] **Step 1: Write the failing orders service test for current-customer list/detail reads**

```ts
// apps/api/src/modules/orders/orders.service.spec.ts
import { OrdersService } from './orders.service';

describe('OrdersService', () => {
  it('lists the current customer orders in reverse chronological order', async () => {
    const prisma = {
      order: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'ord_1',
            orderNumber: 'ORD-001',
            status: 'PAID_PENDING_FULFILLMENT',
            ticketType: 'E_TICKET',
            totalAmount: 159800,
            currency: 'CNY',
            createdAt: new Date('2026-04-17T12:00:00.000Z'),
            items: [
              {
                ticketTier: {
                  session: {
                    event: {
                      id: 'event_beta_1',
                      title: 'Beta Concert',
                      city: 'Shanghai',
                      venueName: 'Expo Arena',
                      saleStatus: 'ON_SALE',
                      minPrice: 79900,
                    },
                  },
                },
              },
            ],
          },
        ]),
      },
    } as never;

    const timeline = {
      toTimelineItem: jest.fn().mockReturnValue({
        title: 'Pending Fulfillment',
        description: 'E-ticket confirmation arrives no later than 3 days before the show.',
      }),
    } as never;

    const service = new OrdersService(prisma, timeline);

    const result = await service.listCustomerOrders('cust_1');

    expect(result[0]).toMatchObject({
      id: 'ord_1',
      orderNumber: 'ORD-001',
      status: 'PAID_PENDING_FULFILLMENT',
    });
  });
});
```

- [ ] **Step 2: Run the order-query test to confirm current-customer read APIs are missing**

Run: `corepack pnpm --filter api test -- orders.service.spec.ts`

Expected: FAIL with `Cannot find module './orders.service'`.

- [ ] **Step 3: Implement current-customer order reads and wire the miniapp pages to live data**

```ts
// packages/contracts/src/order.ts
export const orderTimelineItemSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
});

export const orderListItemSchema = z.object({
  id: z.string().min(1),
  orderNumber: z.string().min(1),
  status: orderStatusSchema,
  ticketType: ticketTypeSchema,
  totalAmount: z.number().int().nonnegative(),
  currency: z.string().min(1),
  createdAt: z.string().datetime(),
  event: eventSummarySchema,
  timeline: orderTimelineItemSchema,
  refundEntryEnabled: z.boolean(),
});

export type OrderListItem = z.infer<typeof orderListItemSchema>;
```

```ts
// packages/contracts/src/index.ts
export {
  orderListItemSchema,
  orderTimelineItemSchema,
  type OrderListItem,
} from './order';
```

```ts
// packages/contracts/src/contracts.spec.ts
import { orderListItemSchema } from './order';

it('parses the beta order list contract', () => {
  expect(() =>
    orderListItemSchema.parse({
      id: 'ord_1',
      orderNumber: 'ORD-001',
      status: 'PAID_PENDING_FULFILLMENT',
      ticketType: 'E_TICKET',
      totalAmount: 159800,
      currency: 'CNY',
      createdAt: new Date().toISOString(),
      refundEntryEnabled: true,
      timeline: {
        title: 'Pending Fulfillment',
        description: 'E-ticket confirmation arrives no later than 3 days before the show.',
      },
      event: {
        id: 'event_beta_1',
        title: 'Beta Concert',
        city: 'Shanghai',
        venueName: 'Expo Arena',
        saleStatus: 'ON_SALE',
        minPrice: 79900,
      },
    }),
  ).not.toThrow();
});
```

```ts
// apps/api/src/modules/orders/orders.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../common/prisma/prisma.service';
import { OrderTimelineService } from './order-timeline.service';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orderTimelineService: OrderTimelineService,
  ) {}

  async listCustomerOrders(customerId: string) {
    const orders = await this.prisma.order.findMany({
      where: { userId: customerId },
      include: {
        items: {
          include: {
            ticketTier: {
              include: {
                session: {
                  include: {
                    event: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return orders.map((order) => {
      const event = order.items[0].ticketTier.session.event;

      return {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        ticketType: order.ticketType,
        totalAmount: order.totalAmount,
        currency: order.currency,
        createdAt: order.createdAt.toISOString(),
        refundEntryEnabled: event.refundEntryEnabled,
        event,
        timeline: this.orderTimelineService.toTimelineItem(
          order.status,
          order.ticketType,
        ),
      };
    });
  }

  async getCustomerOrderDetail(customerId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        userId: customerId,
      },
      include: {
        items: {
          include: {
            viewer: true,
            ticketTier: {
              include: {
                session: {
                  include: {
                    event: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found.');
    }

    return order;
  }
}
```

```ts
// apps/api/src/modules/orders/orders.controller.ts
import { Get, Param, UseGuards } from '@nestjs/common';

@UseGuards(CustomerSessionGuard)
@Controller('orders')
export class OrdersController {
  constructor(
    private readonly checkoutService: CheckoutService,
    private readonly ordersService: OrdersService,
  ) {}

  @Get('my')
  listMyOrders(@CurrentCustomer() customer: { id: string }) {
    return { items: this.ordersService.listCustomerOrders(customer.id) };
  }

  @Get(':orderId')
  getMyOrder(
    @CurrentCustomer() customer: { id: string },
    @Param('orderId') orderId: string,
  ) {
    return this.ordersService.getCustomerOrderDetail(customer.id, orderId);
  }
}
```

```tsx
// apps/miniapp/src/pages/event-detail/index.tsx
import { useLoad } from '@tarojs/taro';
import { useState } from 'react';

import { request } from '../../services/request';

export default function EventDetailPage() {
  const [eventDetail, setEventDetail] = useState<any>(null);

  useLoad((params) => {
    if (!params?.id) {
      return;
    }

    void request<any>({
      url: `/catalog/events/${params.id}`,
    }).then(setEventDetail);
  });

  if (!eventDetail) {
    return <View>Loading...</View>;
  }

  return <View>{eventDetail.title}</View>;
}
```

```tsx
// apps/miniapp/src/pages/orders/index.tsx
useDidShow(() => {
  void request<{ items: Array<any> }>({
    url: '/orders/my',
  }).then((response) => {
    setOrders(response.items ?? []);
  });
});
```

```tsx
// apps/miniapp/src/pages/order-detail/index.tsx
useLoad((params) => {
  if (!params?.id) {
    return;
  }

  void request<any>({
    url: `/orders/${params.id}`,
  }).then(setOrderDetail);
});
```

- [ ] **Step 4: Verify order-query logic and the live miniapp browse/order screens**

Run: `corepack pnpm --filter api test -- orders.service.spec.ts order-timeline.service.spec.ts`

Expected: PASS with the new list/detail projection tests green.

Run: `corepack pnpm --filter miniapp build:weapp`

Expected: PASS with home, event detail, orders, and order detail pages compiling against live request flows.

- [ ] **Step 5: Commit the event browsing and current-customer order read slice**

```bash
git add packages/contracts/src/order.ts packages/contracts/src/index.ts packages/contracts/src/contracts.spec.ts apps/api/src/modules/orders apps/miniapp/src/pages/home apps/miniapp/src/pages/events apps/miniapp/src/pages/event-detail apps/miniapp/src/pages/orders apps/miniapp/src/pages/order-detail apps/miniapp/src/pages/me
git commit -m "feat: add live beta event and current-customer order reads"
```

### Task 5: Create Real WeChat Payment Intents And Wire Checkout To Paid Orders

**Files:**
- Create: `packages/contracts/src/payment.ts`
- Modify: `packages/contracts/src/index.ts`
- Modify: `packages/contracts/src/contracts.spec.ts`
- Create: `apps/api/src/modules/payments/wechat-pay.gateway.ts`
- Modify: `apps/api/src/modules/payments/wechat-pay.service.ts`
- Modify: `apps/api/src/modules/payments/payments.controller.ts`
- Modify: `apps/api/src/modules/payments/payments.service.spec.ts`
- Modify: `apps/miniapp/src/pages/checkout/index.tsx`
- Modify: `apps/miniapp/src/pages/payment-result/index.tsx`
- Modify: `apps/miniapp/src/utils/pay.ts`

- [ ] **Step 1: Rewrite the payment service test to fail on missing payment-intent creation**

```ts
// apps/api/src/modules/payments/payments.service.spec.ts
import { PaymentsService } from './wechat-pay.service';

describe('PaymentsService', () => {
  it('creates a WeChat JSAPI payment intent for the current customer order', async () => {
    const prisma = {
      order: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'ord_1',
          orderNumber: 'ORD-001',
          totalAmount: 159800,
          items: [
            {
              ticketTier: {
                session: {
                  event: {
                    title: 'Beta Concert',
                  },
                },
              },
            },
          ],
        }),
      },
    } as never;

    const gateway = {
      createJsapiIntent: jest.fn().mockResolvedValue({
        appId: 'wx-app-id',
        nonceStr: 'nonce',
        packageValue: 'prepay_id=wx123',
        paySign: 'signature',
        signType: 'RSA',
        timeStamp: '1713355200',
      }),
    } as never;

    const service = new PaymentsService(prisma, gateway, {
      submitPaidOrder: jest.fn(),
    } as never);

    const result = await service.createWechatIntent({
      customerId: 'cust_1',
      orderId: 'ord_1',
      openId: 'openid_123',
    });

    expect(gateway.createJsapiIntent).toHaveBeenCalled();
    expect(result.packageValue).toContain('prepay_id=');
  });
});
```

- [ ] **Step 2: Run the payment test to confirm intent creation is not implemented yet**

Run: `corepack pnpm --filter api test -- payments.service.spec.ts`

Expected: FAIL because `createWechatIntent` and `wechat-pay.gateway.ts` do not exist.

- [ ] **Step 3: Implement real payment-intent generation and start it from checkout**

```ts
// packages/contracts/src/payment.ts
import { z } from 'zod';

export const wechatPaymentIntentSchema = z.object({
  appId: z.string().min(1),
  nonceStr: z.string().min(1),
  packageValue: z.string().min(1),
  paySign: z.string().min(1),
  signType: z.enum(['RSA', 'MD5', 'HMAC-SHA256']),
  timeStamp: z.string().min(1),
});

export type WechatPaymentIntent = z.infer<typeof wechatPaymentIntentSchema>;
```

```ts
// packages/contracts/src/index.ts
export {
  wechatPaymentIntentSchema,
  type WechatPaymentIntent,
} from './payment';
```

```ts
// packages/contracts/src/contracts.spec.ts
import { wechatPaymentIntentSchema } from './payment';

it('parses the wechat payment intent contract', () => {
  expect(() =>
    wechatPaymentIntentSchema.parse({
      appId: 'wx-app-id',
      nonceStr: 'nonce',
      packageValue: 'prepay_id=wx123',
      paySign: 'signature',
      signType: 'RSA',
      timeStamp: '1713355200',
    }),
  ).not.toThrow();
});
```

```ts
// apps/api/src/modules/payments/wechat-pay.gateway.ts
import { Injectable } from '@nestjs/common';
import { createSign, randomBytes } from 'crypto';

@Injectable()
export class WechatPayGateway {
  private buildWechatPaySignature(input: {
    appId: string;
    nonceStr: string;
    packageValue: string;
    timeStamp: string;
  }) {
    const signer = createSign('RSA-SHA256');
    signer.update(
      `${input.appId}\n${input.timeStamp}\n${input.nonceStr}\n${input.packageValue}\n`,
    );
    signer.end();

    return signer.sign(process.env.WECHAT_PRIVATE_KEY_PEM ?? '', 'base64');
  }

  async createJsapiIntent(input: {
    amount: number;
    description: string;
    notifyUrl: string;
    openId: string;
    outTradeNo: string;
  }) {
    const response = await fetch(
      'https://api.mch.weixin.qq.com/v3/pay/transactions/jsapi',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          amount: {
            currency: 'CNY',
            total: input.amount,
          },
          appid: process.env.WECHAT_APP_ID,
          description: input.description,
          mchid: process.env.WECHAT_MCH_ID,
          notify_url: input.notifyUrl,
          out_trade_no: input.outTradeNo,
          payer: {
            openid: input.openId,
          },
        }),
      },
    );

    const payload = (await response.json()) as { prepay_id: string };
    const appId = process.env.WECHAT_APP_ID ?? '';
    const nonceStr = randomBytes(16).toString('hex');
    const packageValue = `prepay_id=${payload.prepay_id}`;
    const timeStamp = `${Math.floor(Date.now() / 1000)}`;

    return {
      appId,
      nonceStr,
      packageValue,
      paySign: this.buildWechatPaySignature({
        appId,
        nonceStr,
        packageValue,
        timeStamp,
      }),
      signType: 'RSA' as const,
      timeStamp,
    };
  }
}
```

```ts
// apps/api/src/modules/payments/wechat-pay.service.ts
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wechatPayGateway: WechatPayGateway,
    private readonly fulfillmentEventsService: FulfillmentEventsService,
  ) {}

  async createWechatIntent(input: {
    customerId: string;
    orderId: string;
    openId: string;
  }) {
    const order = await this.prisma.order.findFirst({
      where: {
        id: input.orderId,
        userId: input.customerId,
        status: ORDER_STATUS.PENDING_PAYMENT,
      },
      include: {
        items: {
          include: {
            ticketTier: {
              include: {
                session: {
                  include: {
                    event: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!order) {
      throw new BadRequestException('Pending order not found.');
    }

    const eventTitle = order.items[0].ticketTier.session.event.title;

    return this.wechatPayGateway.createJsapiIntent({
      amount: order.totalAmount,
      description: eventTitle,
      notifyUrl: process.env.WECHAT_NOTIFY_URL ?? '',
      openId: input.openId,
      outTradeNo: order.orderNumber,
    });
  }
}
```

```ts
// apps/api/src/modules/payments/payments.controller.ts
import { UseGuards } from '@nestjs/common';

@UseGuards(CustomerSessionGuard)
@Controller('payments')
export class PaymentsController {
  @Post('wechat/intent')
  createWechatIntent(
    @CurrentCustomer() customer: { id: string; openId: string },
    @Body() body: { orderId: string },
  ) {
    return this.paymentsService.createWechatIntent({
      customerId: customer.id,
      orderId: body.orderId,
      openId: customer.openId,
    });
  }
}
```

```tsx
// apps/miniapp/src/pages/checkout/index.tsx
import Taro from '@tarojs/taro';

import { request } from '../../services/request';
import { startWechatPay } from '../../utils/pay';

async function submitOrderAndPay() {
  const draftOrder = await request<{ id: string }, Record<string, unknown>>({
    data: {
      tierId: selectedTierId,
      viewerIds: selectedViewerIds,
      quantity: selectedViewerIds.length,
      ticketType: selectedTicketType,
    },
    method: 'POST',
    url: '/orders/draft',
  });

  const paymentIntent = await request<any, { orderId: string }>({
    data: { orderId: draftOrder.id },
    method: 'POST',
    url: '/payments/wechat/intent',
  });

  await startWechatPay(paymentIntent);

  void Taro.navigateTo({
    url: `/pages/payment-result/index?orderId=${draftOrder.id}`,
  });
}
```

```tsx
// apps/miniapp/src/pages/payment-result/index.tsx
useLoad((params) => {
  setOrderId(params?.orderId ?? '');
});
```

- [ ] **Step 4: Verify payment-intent creation and the checkout compilation path**

Run: `corepack pnpm --filter api test -- payments.service.spec.ts`

Expected: PASS with the payment-intent and callback tests green.

Run: `corepack pnpm --filter miniapp build:weapp`

Expected: PASS with checkout and payment-result pages compiling against the new payment intent API.

- [ ] **Step 5: Commit the real checkout/payment slice**

```bash
git add packages/contracts/src/payment.ts packages/contracts/src/index.ts packages/contracts/src/contracts.spec.ts apps/api/src/modules/payments apps/miniapp/src/pages/checkout apps/miniapp/src/pages/payment-result apps/miniapp/src/utils/pay.ts
git commit -m "feat: add real wechat payment intent flow"
```

### Task 6: Submit Paid Orders Upstream, Process Refunds Upstream, And Wire After-Sales

**Files:**
- Create: `apps/api/src/common/vendors/upstream-ticketing.gateway.ts`
- Create: `apps/api/src/common/vendors/upstream-ticketing.gateway.spec.ts`
- Modify: `apps/api/src/modules/payments/wechat-pay.service.ts`
- Modify: `apps/api/src/modules/fulfillment/fulfillment-events.service.ts`
- Modify: `apps/api/src/modules/fulfillment/fulfillment.controller.ts`
- Modify: `apps/api/src/modules/fulfillment/fulfillment-events.service.spec.ts`
- Modify: `apps/api/src/modules/refunds/refunds.service.ts`
- Modify: `apps/api/src/modules/refunds/refunds.controller.ts`
- Modify: `apps/api/src/modules/refunds/refunds.service.spec.ts`
- Modify: `apps/miniapp/src/pages/after-sales/index.tsx`
- Modify: `apps/miniapp/src/pages/order-detail/index.tsx`

- [ ] **Step 1: Rewrite the fulfillment/refund tests to fail on missing upstream submission behavior**

```ts
// apps/api/src/modules/fulfillment/fulfillment-events.service.spec.ts
import { FulfillmentEventsService } from './fulfillment-events.service';

describe('FulfillmentEventsService', () => {
  it('submits a paid order upstream and advances it to submitted-to-vendor', async () => {
    const prisma = {
      order: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'ord_1',
          status: 'PAID_PENDING_FULFILLMENT',
        }),
        update: jest.fn().mockResolvedValue({
          id: 'ord_1',
          status: 'SUBMITTED_TO_VENDOR',
        }),
      },
      fulfillmentEvent: {
        create: jest.fn().mockResolvedValue({ id: 'ful_1' }),
      },
    } as never;

    const gateway = {
      submitOrder: jest.fn().mockResolvedValue({
        externalRef: 'vendor_submit_1',
      }),
    } as never;

    const service = new FulfillmentEventsService(prisma, gateway);

    const result = await service.submitPaidOrder('ord_1');

    expect(gateway.submitOrder).toHaveBeenCalledWith({ orderId: 'ord_1' });
    expect(result.nextStatus).toBe('SUBMITTED_TO_VENDOR');
  });
});
```

```ts
// apps/api/src/modules/refunds/refunds.service.spec.ts
it('submits a refund request upstream after persisting the fee calculation', async () => {
  const prisma = {
    $transaction: jest.fn(async (callback: (client: any) => unknown) =>
      callback({
        order: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'ord_1',
            status: 'TICKET_ISSUED',
            totalAmount: 100000,
          }),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        refundRequest: {
          create: jest.fn().mockResolvedValue({
            refundNo: 'RFD-001',
            refundAmount: 80000,
            serviceFee: 20000,
          }),
        },
      }),
    ),
  } as never;

  const gateway = {
    submitRefund: jest.fn().mockResolvedValue({
      externalRef: 'vendor_refund_1',
    }),
  } as never;

  const service = new RefundsService(prisma, gateway);

  await service.requestRefund({
    orderId: 'ord_1',
    reasonCode: 'USER_IDENTITY_ERROR',
    daysBeforeStart: 2,
  });

  expect(gateway.submitRefund).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the fulfillment/refund tests to confirm upstream gateway logic does not exist yet**

Run: `corepack pnpm --filter api test -- fulfillment-events.service.spec.ts refunds.service.spec.ts`

Expected: FAIL because the upstream gateway and submission methods do not exist.

- [ ] **Step 3: Implement paid-order submission, refund submission, and live after-sales UI**

```ts
// apps/api/src/common/vendors/upstream-ticketing.gateway.ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class UpstreamTicketingGateway {
  async submitOrder(input: { orderId: string }) {
    const response = await fetch(`${process.env.VENDOR_API_BASE_URL}/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.VENDOR_API_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(input),
    });

    return (await response.json()) as { externalRef: string };
  }

  async submitRefund(input: { orderId: string; refundNo: string; amount: number }) {
    const response = await fetch(`${process.env.VENDOR_API_BASE_URL}/refunds`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.VENDOR_API_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(input),
    });

    return (await response.json()) as { externalRef: string };
  }
}
```

```ts
// apps/api/src/modules/fulfillment/fulfillment-events.service.ts
export class FulfillmentEventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly upstreamTicketingGateway: UpstreamTicketingGateway,
  ) {}

  async submitPaidOrder(orderId: string) {
    const upstream = await this.upstreamTicketingGateway.submitOrder({ orderId });

    await this.prisma.$transaction(async (tx) => {
      await tx.fulfillmentEvent.create({
        data: {
          orderId,
          externalRef: upstream.externalRef,
          payload: {
            source: 'UPSTREAM_SUBMISSION',
          },
          status: FulfillmentStatus.SUBMITTED,
        },
      });

      await tx.order.update({
        where: { id: orderId },
        data: { status: ORDER_STATUS.SUBMITTED_TO_VENDOR },
      });
    });

    return {
      externalRef: upstream.externalRef,
      nextStatus: ORDER_STATUS.SUBMITTED_TO_VENDOR,
      orderId,
    };
  }
}
```

```ts
// apps/api/src/modules/payments/wechat-pay.service.ts
async buildPaidTransition(input: PaidCallbackInput): Promise<PaidTransitionPayload> {
  const transition = await this.prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: input.orderId },
      select: {
        id: true,
        status: true,
        totalAmount: true,
      },
    });

    if (!order || order.totalAmount !== input.amount) {
      throw new BadRequestException('Callback amount does not match order total.');
    }

    const paidAt = new Date();

    await tx.payment.upsert({
      where: { providerTxnId: input.providerTxnId },
      create: {
        amount: input.amount,
        method: PaymentMethod.WECHAT_PAY,
        orderId: input.orderId,
        paidAt,
        providerTxnId: input.providerTxnId,
        status: PaymentStatus.SUCCEEDED,
      },
      update: {
        amount: input.amount,
        paidAt,
        status: PaymentStatus.SUCCEEDED,
      },
    });

    await tx.order.updateMany({
      where: {
        id: input.orderId,
        status: ORDER_STATUS.PENDING_PAYMENT,
      },
      data: {
        status: ORDER_STATUS.PAID_PENDING_FULFILLMENT,
      },
    });

    return {
      amount: input.amount,
      orderId: input.orderId,
      orderStatus: ORDER_STATUS.PAID_PENDING_FULFILLMENT,
      paidAt: new Date().toISOString(),
      providerTxnId: input.providerTxnId,
    };
  });

  if (transition.orderStatus === ORDER_STATUS.PAID_PENDING_FULFILLMENT) {
    await this.fulfillmentEventsService.submitPaidOrder(transition.orderId);
  }

  return transition;
}
```

```ts
// apps/api/src/modules/refunds/refunds.service.ts
export class RefundsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly upstreamTicketingGateway: UpstreamTicketingGateway,
  ) {}

  async requestRefund(input: RequestRefundInput) {
    const refundRequest = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: input.orderId },
        select: {
          id: true,
          status: true,
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

      const transitionResult = await tx.order.updateMany({
        data: {
          status: ORDER_STATUS.REFUND_REVIEWING,
        },
        where: {
          id: order.id,
          status: {
            in: [
              ORDER_STATUS.PAID_PENDING_FULFILLMENT,
              ORDER_STATUS.SUBMITTED_TO_VENDOR,
              ORDER_STATUS.TICKET_ISSUED,
              ORDER_STATUS.TICKET_FAILED,
            ],
          },
        },
      });

      if (transitionResult.count === 0) {
        throw new BadRequestException('order is not eligible for refund request.');
      }

      return tx.refundRequest.create({
        data: {
          orderId: order.id,
          reason: input.reasonCode,
          refundAmount: fee.refundAmount,
          refundNo: this.generateRefundNo(),
          requestedAmount: order.totalAmount,
          serviceFee: fee.serviceFee,
          status: 'REVIEWING',
        },
        select: {
          refundAmount: true,
          refundNo: true,
          serviceFee: true,
        },
      });
    });

    await this.upstreamTicketingGateway.submitRefund({
      amount: refundRequest.refundAmount,
      orderId: input.orderId,
      refundNo: refundRequest.refundNo,
    });

    await this.prisma.order.update({
      where: { id: input.orderId },
      data: { status: ORDER_STATUS.REFUND_PROCESSING },
    });

    return refundRequest;
  }
}
```

```tsx
// apps/miniapp/src/pages/after-sales/index.tsx
async function submitRefundRequest() {
  await request({
    data: {
      daysBeforeStart,
      orderId,
      reasonCode,
    },
    method: 'POST',
    url: '/refunds/request',
  });

  void Taro.navigateBack();
}
```

```tsx
// apps/miniapp/src/pages/order-detail/index.tsx
{orderDetail?.status === 'TICKET_ISSUED' && orderDetail?.event?.refundEntryEnabled ? (
  <Button
    onClick={() =>
      Taro.navigateTo({
        url: `/pages/after-sales/index?orderId=${orderDetail.id}`,
      })
    }
  >
    Request Refund
) : null}
```

- [ ] **Step 4: Verify upstream submission logic and the after-sales page**

Run: `corepack pnpm --filter api test -- fulfillment-events.service.spec.ts refunds.service.spec.ts`

Expected: PASS with upstream submission and callback tests green.

Run: `corepack pnpm --filter miniapp build:weapp`

Expected: PASS with after-sales and order detail pages compiling against live refund flows.

- [ ] **Step 5: Commit the upstream fulfillment/refund slice**

```bash
git add apps/api/src/common/vendors apps/api/src/modules/fulfillment apps/api/src/modules/refunds apps/miniapp/src/pages/after-sales apps/miniapp/src/pages/order-detail
git commit -m "feat: submit paid orders and refunds to upstream interfaces"
```

### Task 7: Replace Admin Placeholders With Live Operations Consoles

**Files:**
- Create: `apps/admin/src/services/request.ts`
- Modify: `apps/admin/src/pages/events/index.tsx`
- Modify: `apps/admin/src/pages/orders/index.tsx`
- Modify: `apps/admin/src/pages/fulfillment/index.tsx`
- Modify: `apps/admin/src/pages/refunds/index.tsx`
- Modify: `apps/api/src/modules/orders/orders.controller.ts`
- Modify: `apps/api/src/modules/orders/orders.service.ts`
- Modify: `apps/api/src/modules/fulfillment/fulfillment.controller.ts`
- Modify: `apps/api/src/modules/fulfillment/fulfillment-events.service.ts`
- Modify: `apps/api/src/modules/refunds/refunds.controller.ts`
- Modify: `apps/api/src/modules/refunds/refunds.service.ts`

- [ ] **Step 1: Write the failing admin build expectation by introducing live request imports**

```ts
// apps/admin/src/services/request.ts
export async function request<TResponse>(path: string) {
  const response = await fetch(`http://localhost:3000/api${path}`);

  if (!response.ok) {
    throw new Error(`Admin request failed for ${path}`);
  }

  return (await response.json()) as TResponse;
}
```

```tsx
// apps/admin/src/pages/orders/index.tsx
import { useEffect, useState } from 'react';

import { request } from '../../services/request';

export function OrdersPage() {
  const [rows, setRows] = useState<Array<any>>([]);

  useEffect(() => {
    void request<{ items: Array<any> }>('/orders/admin').then((response) => {
      setRows(response.items ?? []);
    });
  }, []);

  return <Table dataSource={rows} rowKey='id' />;
}
```

- [ ] **Step 2: Run the admin build to confirm the live request layer and admin routes do not exist yet**

Run: `corepack pnpm --filter admin build`

Expected: FAIL because `apps/admin/src/services/request.ts` and matching API routes do not exist yet.

- [ ] **Step 3: Expose live admin APIs and replace placeholder tables with real fetch-driven pages**

```ts
// apps/api/src/modules/orders/orders.controller.ts
@Get('admin')
listAdminOrders() {
  return this.ordersService.listAdminOrders();
}
```

```ts
// apps/api/src/modules/orders/orders.service.ts
async listAdminOrders() {
  return this.prisma.order.findMany({
    include: {
      items: {
        include: {
          ticketTier: {
            include: {
              session: {
                include: {
                  event: true,
                },
              },
            },
          },
        },
      },
      payments: true,
      refundRequests: true,
    },
    orderBy: { createdAt: 'desc' },
  });
}
```

```ts
// apps/api/src/modules/fulfillment/fulfillment.controller.ts
@Get('admin')
listFulfillmentOperations() {
  return this.fulfillmentEventsService.listAdminOperations();
}
```

```ts
// apps/api/src/modules/fulfillment/fulfillment-events.service.ts
async listAdminOperations() {
  return this.prisma.fulfillmentEvent.findMany({
    include: {
      order: true,
    },
    orderBy: { occurredAt: 'desc' },
  });
}
```

```ts
// apps/api/src/modules/refunds/refunds.controller.ts
@Get('admin')
listRefundOperations() {
  return this.refundsService.listAdminRequests();
}
```

```ts
// apps/api/src/modules/refunds/refunds.service.ts
async listAdminRequests() {
  return this.prisma.refundRequest.findMany({
    include: {
      order: true,
    },
    orderBy: { requestedAt: 'desc' },
  });
}
```

```tsx
// apps/admin/src/pages/events/index.tsx
useEffect(() => {
  void request<{ items: Array<any> }>('/catalog/events').then((response) => {
    setRows(response.items ?? []);
  });
}, []);

async function toggleRefundEntry(eventId: string, refundEntryEnabled: boolean) {
  await fetch(`http://localhost:3000/api/catalog/admin/events/${eventId}`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      refundEntryEnabled: !refundEntryEnabled,
    }),
  });
}
```

```tsx
// apps/admin/src/pages/fulfillment/index.tsx
useEffect(() => {
  void request<{ items: Array<any> }>('/fulfillment/admin').then((response) => {
    setRows(response.items ?? []);
  });
}, []);
```

```tsx
// apps/admin/src/pages/refunds/index.tsx
useEffect(() => {
  void request<{ items: Array<any> }>('/refunds/admin').then((response) => {
    setRows(response.items ?? []);
  });
}, []);
```

- [ ] **Step 4: Verify the admin console build and API list endpoints**

Run: `corepack pnpm --filter admin build`

Expected: PASS with the events, orders, fulfillment, and refunds pages compiling against live APIs.

Run: `corepack pnpm --filter api test -- orders.service.spec.ts fulfillment-events.service.spec.ts refunds.service.spec.ts catalog.service.spec.ts`

Expected: PASS with admin list projections covered by service tests.

- [ ] **Step 5: Commit the live admin operations slice**

```bash
git add apps/admin/src/services apps/admin/src/pages/events apps/admin/src/pages/orders apps/admin/src/pages/fulfillment apps/admin/src/pages/refunds apps/api/src/modules/orders apps/api/src/modules/fulfillment apps/api/src/modules/refunds
git commit -m "feat: replace admin placeholders with live operations consoles"
```

### Task 8: Add Runtime Configuration Docs And Run The Full Beta Regression Pass

**Files:**
- Modify: `.env.example`
- Modify: `README.md`
- Verify only: `apps/api/src`, `apps/miniapp/src`, `apps/admin/src`, `packages/contracts/src`

- [ ] **Step 1: Document every beta secret, callback endpoint, and emergency switch**

```dotenv
// .env.example
WECHAT_NOTIFY_URL=https://example.com/api/payments/wechat/callback
WECHAT_CALLBACK_SECRET=replace-me
VENDOR_API_BASE_URL=https://vendor.example.com
VENDOR_API_KEY=replace-me
VENDOR_CALLBACK_SECRET=replace-me
BETA_EVENT_ID=event_beta_1
BETA_SALES_FORCE_OFF=false
BETA_REFUNDS_FORCE_OFF=false
```

```md
// README.md
## B Internal Beta Runbook

1. Configure `.env` from `.env.example`, including WeChat miniapp login secrets, payment notify URL, and upstream vendor credentials.
2. Start PostgreSQL and apply Prisma migrations.
3. Seed the single beta event identified by `BETA_EVENT_ID`.
4. Start `api`, `miniapp`, and `admin`.
5. Verify the following manual path:
   - miniapp login
   - browse the single event
   - add attendees
   - create draft order
   - create WeChat payment intent
   - receive payment callback
   - submit upstream order
   - receive issuance callback
   - open order detail
   - request refund
   - receive refund callback
6. Use admin pages to pause refund entry or switch sale visibility if an exception surge occurs.
```

- [ ] **Step 2: Run the targeted package checks for auth, catalog, payments, fulfillment, refunds, and orders**

Run: `corepack pnpm --filter api test -- wechat-auth.service.spec.ts customer-session.guard.spec.ts catalog.service.spec.ts orders.service.spec.ts payments.service.spec.ts fulfillment-events.service.spec.ts refunds.service.spec.ts`

Expected: PASS with all beta-critical API suites green.

Run: `corepack pnpm --filter @ticketing/contracts test -- contracts.spec.ts`

Expected: PASS with auth, event, order, and payment contract schemas green.

- [ ] **Step 3: Run workspace build and baseline verification**

Run: `corepack pnpm --filter admin build`

Expected: PASS with live admin operations pages compiled.

Run: `corepack pnpm --filter miniapp build:weapp`

Expected: PASS with authenticated miniapp, checkout, payment, order, and refund pages compiled.

Run: `corepack pnpm lint`

Expected: PASS with repo lint green.

Run: `corepack pnpm test`

Expected: PASS with repo tests green.

- [ ] **Step 4: Validate Prisma and capture the dress-rehearsal checklist**

Run: `corepack pnpm --filter api exec prisma validate`

Expected: PASS with `The schema at prisma/schema.prisma is valid`.

Run: `corepack pnpm --filter api prisma:generate`

Expected: PASS with Prisma Client regenerated for the final beta schema.

Manual checklist to record in the handoff:
- one real event published
- refund entry switch visible in admin
- one successful real-money order
- one successful vendor issuance callback
- one successful refund request and vendor refund callback
- one simulated abnormal order triaged through admin

- [ ] **Step 5: Commit the beta implementation pass**

```bash
git add .env.example README.md apps/api/src apps/miniapp/src apps/admin/src packages/contracts/src apps/api/prisma
git commit -m "feat: deliver the ticketing b internal beta flow"
```

## Plan Self-Review

### Spec Coverage

- real WeChat login and customer identity: Tasks 1-2
- single-event browse flow with sale and refund switches: Tasks 3-4
- real checkout and WeChat payment: Task 5
- upstream fulfillment and refund interfaces: Task 6
- order detail, refund entry, and customer-facing status clarity: Tasks 4-6
- admin event, order, fulfillment, and refund consoles: Task 7
- environment setup, emergency switches, and rehearsal verification: Task 8

### Placeholder Scan

- no TODO, TBD, implement later, or vague handle appropriately steps remain
- every task includes exact file paths, code snippets, and verification commands
- the only manual work left is the explicit real-world dress rehearsal listed in Task 8

### Type Consistency

- `customerId` is used for authenticated miniapp ownership while persisted order/viewer records continue using the existing `userId` column value to store the customer id
- `refundEntryEnabled`, `published`, `packageValue`, and `miniappSessionSchema` are named consistently across contracts, API, and UI tasks
- order statuses remain aligned with the existing `ORDER_STATUS` constants: `PENDING_PAYMENT`, `PAID_PENDING_FULFILLMENT`, `SUBMITTED_TO_VENDOR`, `TICKET_ISSUED`, `REFUND_PROCESSING`, and `REFUNDED`
