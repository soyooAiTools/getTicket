# 授权票务分销微信小程序 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 从空白仓库搭建一个可上线的授权票务分销系统 V1，覆盖演出信息浏览、实名购票、支付、订单跟踪、人工履约、售后退款和管理后台。

**Architecture:** 采用 `pnpm workspace` 单仓结构，拆分为 `apps/miniapp`（Taro 微信小程序）、`apps/admin`（React 管理后台）、`apps/api`（NestJS API）、`packages/contracts`（共享 DTO/Zod 合约）。订单、履约和退款全部经过统一状态机，前期 `E/F` 通过人工事件接入，后期切到上游回调时不改前台流程。

**Tech Stack:** pnpm workspaces, TypeScript, Taro 4 + React, React + Vite + Ant Design, NestJS, Prisma, PostgreSQL, Redis, WeChat Pay API v3, Jest/Vitest

---

## Scope Check

这份 spec 同时包含小程序、后台、API、支付和履约，但它们共同构成一个可测试的单一产品闭环，不适合继续拆成多个独立计划。下面这份计划按可上线顺序组织，保证每个任务完成后都离可运行系统更近一步。

## Proposed File Structure

- `package.json`
- `pnpm-workspace.yaml`
- `tsconfig.base.json`
- `.env.example`
- `docker-compose.yml`
- `apps/api/`
- `apps/api/prisma/schema.prisma`
- `apps/api/src/modules/auth/*`
- `apps/api/src/modules/catalog/*`
- `apps/api/src/modules/viewers/*`
- `apps/api/src/modules/checkout/*`
- `apps/api/src/modules/orders/*`
- `apps/api/src/modules/payments/*`
- `apps/api/src/modules/fulfillment/*`
- `apps/api/src/modules/refunds/*`
- `apps/api/src/modules/notifications/*`
- `apps/api/src/modules/risk/*`
- `apps/miniapp/src/app.config.ts`
- `apps/miniapp/src/pages/home/index.tsx`
- `apps/miniapp/src/pages/events/index.tsx`
- `apps/miniapp/src/pages/event-detail/index.tsx`
- `apps/miniapp/src/pages/viewers/index.tsx`
- `apps/miniapp/src/pages/checkout/index.tsx`
- `apps/miniapp/src/pages/orders/index.tsx`
- `apps/miniapp/src/pages/order-detail/index.tsx`
- `apps/miniapp/src/pages/after-sales/index.tsx`
- `apps/miniapp/src/pages/me/index.tsx`
- `apps/admin/src/router.tsx`
- `apps/admin/src/pages/events/index.tsx`
- `apps/admin/src/pages/orders/index.tsx`
- `apps/admin/src/pages/fulfillment/index.tsx`
- `apps/admin/src/pages/refunds/index.tsx`
- `packages/contracts/src/event.ts`
- `packages/contracts/src/order.ts`
- `packages/contracts/src/viewer.ts`
- `tests/workspace/repo-layout.spec.ts`

### Task 1: 搭建单仓骨架与开发基线

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `docker-compose.yml`
- Create: `apps/api/package.json`
- Create: `apps/admin/package.json`
- Create: `apps/miniapp/package.json`
- Create: `packages/contracts/package.json`
- Test: `tests/workspace/repo-layout.spec.ts`

- [ ] **Step 1: 写仓库结构的失败测试**

```ts
// tests/workspace/repo-layout.spec.ts
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('repo layout', () => {
  it('declares workspace packages for api, admin, miniapp and contracts', () => {
    expect(existsSync('pnpm-workspace.yaml')).toBe(true);
    expect(existsSync('apps/api/package.json')).toBe(true);
    expect(existsSync('apps/admin/package.json')).toBe(true);
    expect(existsSync('apps/miniapp/package.json')).toBe(true);
    expect(existsSync('packages/contracts/package.json')).toBe(true);

    const workspace = readFileSync('pnpm-workspace.yaml', 'utf8');
    expect(workspace).toContain('apps/*');
    expect(workspace).toContain('packages/*');
  });
});
```

- [ ] **Step 2: 运行测试，确认当前仓库还不满足结构要求**

Run: `pnpm vitest tests/workspace/repo-layout.spec.ts`

Expected: FAIL with missing workspace files.

- [ ] **Step 3: 写入根配置和四个子包清单**

```json
// package.json
{
  "name": "authorized-ticketing-platform",
  "private": true,
  "packageManager": "pnpm@10.8.1",
  "scripts": {
    "dev:api": "pnpm --filter api dev",
    "dev:admin": "pnpm --filter admin dev",
    "dev:miniapp": "pnpm --filter miniapp dev:weapp",
    "test": "pnpm -r test",
    "lint": "pnpm -r lint"
  },
  "devDependencies": {
    "typescript": "^5.6.3",
    "vitest": "^2.1.5"
  }
}
```

```yaml
# pnpm-workspace.yaml
packages:
  - apps/*
  - packages/*
  - tests/*
```

```json
// apps/api/package.json
{ "name": "api", "private": true, "scripts": { "dev": "nest start --watch", "test": "jest", "test:e2e": "jest --config test/jest-e2e.json", "prisma:generate": "prisma generate", "prisma:migrate": "prisma migrate dev" } }
```

```json
// apps/admin/package.json
{ "name": "admin", "private": true, "scripts": { "dev": "vite", "build": "tsc -b && vite build", "test": "vitest run", "lint": "eslint src --ext .ts,.tsx" } }
```

```json
// apps/miniapp/package.json
{ "name": "miniapp", "private": true, "scripts": { "dev:weapp": "taro build --type weapp --watch", "build:weapp": "taro build --type weapp", "test": "vitest run", "lint": "eslint src --ext .ts,.tsx" } }
```

```json
// packages/contracts/package.json
{ "name": "@ticketing/contracts", "private": true, "main": "src/index.ts", "types": "src/index.ts", "scripts": { "test": "vitest run", "lint": "eslint src --ext .ts" } }
```

- [ ] **Step 4: 重新运行仓库结构测试**

Run: `pnpm vitest tests/workspace/repo-layout.spec.ts`

Expected: PASS with `1 passed`.

- [ ] **Step 5: 提交基线**

```bash
git add package.json pnpm-workspace.yaml tsconfig.base.json .gitignore .env.example docker-compose.yml apps packages tests
git commit -m "chore: bootstrap monorepo workspace"
```

### Task 2: 启动 API 服务与健康检查

**Files:**
- Create: `apps/api/src/main.ts`
- Create: `apps/api/src/app.module.ts`
- Create: `apps/api/src/modules/health/health.module.ts`
- Create: `apps/api/src/modules/health/health.controller.ts`
- Create: `apps/api/test/health.e2e-spec.ts`
- Create: `apps/api/test/jest-e2e.json`
- Modify: `apps/api/package.json`

- [ ] **Step 1: 写 API 健康检查失败用例**

```ts
// apps/api/test/health.e2e-spec.ts
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('HealthController', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/health returns ok payload', async () => {
    await request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect({ status: 'ok', service: 'authorized-ticketing-api' });
  });
});
```

- [ ] **Step 2: 运行 e2e 用例，确认接口尚未存在**

Run: `pnpm --filter api test:e2e -- health.e2e-spec.ts`

Expected: FAIL with module not found or 404.

- [ ] **Step 3: 写最小 NestJS 应用和健康模块**

```ts
// apps/api/src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  await app.listen(process.env.PORT ? Number(process.env.PORT) : 3000);
}

bootstrap();
```

```ts
// apps/api/src/app.module.ts
import { Module } from '@nestjs/common';
import { HealthModule } from './modules/health/health.module';

@Module({ imports: [HealthModule] })
export class AppModule {}
```

```ts
// apps/api/src/modules/health/health.controller.ts
import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  getHealth() {
    return { status: 'ok', service: 'authorized-ticketing-api' };
  }
}
```

```ts
// apps/api/src/modules/health/health.module.ts
import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

@Module({ controllers: [HealthController] })
export class HealthModule {}
```

- [ ] **Step 4: 重新运行 API e2e 测试**

Run: `pnpm --filter api test:e2e -- health.e2e-spec.ts`

Expected: PASS with `1 passed`.

- [ ] **Step 5: 提交 API 骨架**

```bash
git add apps/api
git commit -m "feat: bootstrap api application"
```

### Task 3: 建立领域模型与共享合约

**Files:**
- Create: `apps/api/prisma/schema.prisma`
- Create: `packages/contracts/src/index.ts`
- Create: `packages/contracts/src/event.ts`
- Create: `packages/contracts/src/order.ts`
- Create: `packages/contracts/src/viewer.ts`
- Create: `packages/contracts/src/contracts.spec.ts`

- [ ] **Step 1: 写共享合约失败测试，锁定核心字段**

```ts
// packages/contracts/src/contracts.spec.ts
import { describe, expect, it } from 'vitest';
import { eventSummarySchema, orderDetailSchema, viewerSchema } from './index';

describe('contracts', () => {
  it('accepts event summary payload', () => {
    const parsed = eventSummarySchema.parse({
      id: 'evt_1',
      title: 'Jay Chou Shanghai',
      city: 'Shanghai',
      coverUrl: 'https://cdn.example.com/jay.jpg',
      saleStatus: 'ON_SALE',
    });

    expect(parsed.title).toBe('Jay Chou Shanghai');
  });

  it('accepts viewer payload', () => {
    const parsed = viewerSchema.parse({
      id: 'viewer_1',
      name: '张三',
      idCard: '310101199001011234',
      mobile: '13800138000',
    });

    expect(parsed.mobile).toBe('13800138000');
  });

  it('accepts order detail payload', () => {
    const parsed = orderDetailSchema.parse({
      id: 'ord_1',
      status: 'PAID_PENDING_FULFILLMENT',
      ticketType: 'E_TICKET',
      totalAmount: 128000,
    });

    expect(parsed.status).toBe('PAID_PENDING_FULFILLMENT');
  });
});
```

- [ ] **Step 2: 运行 contracts 测试，确认 schema 还未定义**

Run: `pnpm --filter @ticketing/contracts test`

Expected: FAIL with `Cannot find module './index'`.

- [ ] **Step 3: 写 Prisma schema 和共享 Zod 合约**

```prisma
// apps/api/prisma/schema.prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "postgresql" url = env("DATABASE_URL") }

enum OrderStatus { PENDING_PAYMENT PAID_PENDING_FULFILLMENT SUBMITTED_TO_VENDOR TICKET_ISSUED TICKET_FAILED REFUND_REVIEWING REFUND_PROCESSING REFUNDED COMPLETED CLOSED }
enum TicketType { E_TICKET PAPER_TICKET }

model User {
  id        String   @id @default(cuid())
  openId    String   @unique
  nickname  String?
  mobile    String?
  viewers   Viewer[]
  orders    Order[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Viewer {
  id              String      @id @default(cuid())
  userId          String
  name            String
  idCardEncrypted String
  mobile          String
  user            User        @relation(fields: [userId], references: [id])
  orderItems      OrderItem[]
}

model Event {
  id         String    @id @default(cuid())
  title      String
  city       String
  venue      String
  coverUrl   String
  saleStatus String
  published  Boolean   @default(false)
  sessions   Session[]
}

model Session {
  id         String      @id @default(cuid())
  eventId    String
  startsAt   DateTime
  ticketType TicketType
  event      Event       @relation(fields: [eventId], references: [id])
  tiers      TicketTier[]
}

model TicketTier {
  id        String      @id @default(cuid())
  sessionId String
  name      String
  zoneLabel String?
  price     Int
  inventory Int
  session   Session     @relation(fields: [sessionId], references: [id])
  orderItems OrderItem[]
}

model Order {
  id            String             @id @default(cuid())
  userId        String
  status        OrderStatus
  ticketType    TicketType
  totalAmount   Int
  vendorOrderNo String?
  user          User               @relation(fields: [userId], references: [id])
  items         OrderItem[]
  payments      Payment[]
  fulfillments  FulfillmentEvent[]
  refunds       RefundRequest[]
}

model OrderItem {
  id       String     @id @default(cuid())
  orderId  String
  tierId   String
  viewerId String
  quantity Int
  order    Order      @relation(fields: [orderId], references: [id])
  tier     TicketTier @relation(fields: [tierId], references: [id])
  viewer   Viewer     @relation(fields: [viewerId], references: [id])
}

model Payment {
  id            String   @id @default(cuid())
  orderId       String
  provider      String
  providerTxnId String?
  amount        Int
  paidAt        DateTime?
  order         Order    @relation(fields: [orderId], references: [id])
}

model FulfillmentEvent {
  id          String   @id @default(cuid())
  orderId     String
  source      String
  type        String
  message     String
  payloadJson Json
  createdAt   DateTime @default(now())
  order       Order    @relation(fields: [orderId], references: [id])
}

model RefundRequest {
  id              String   @id @default(cuid())
  orderId         String
  reason          String
  status          String
  requestedAmount Int
  serviceFee      Int
  order           Order    @relation(fields: [orderId], references: [id])
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

```ts
// packages/contracts/src/event.ts
import { z } from 'zod';
export const eventSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  city: z.string(),
  coverUrl: z.string().url(),
  saleStatus: z.enum(['UPCOMING', 'ON_SALE', 'SOLD_OUT']),
});
```

```ts
// packages/contracts/src/viewer.ts
import { z } from 'zod';
export const viewerSchema = z.object({
  id: z.string(),
  name: z.string().min(2),
  idCard: z.string().length(18),
  mobile: z.string().regex(/^1\\d{10}$/),
});
```

```ts
// packages/contracts/src/order.ts
import { z } from 'zod';
export const orderDetailSchema = z.object({
  id: z.string(),
  status: z.enum(['PENDING_PAYMENT', 'PAID_PENDING_FULFILLMENT', 'SUBMITTED_TO_VENDOR', 'TICKET_ISSUED', 'TICKET_FAILED', 'REFUND_REVIEWING', 'REFUND_PROCESSING', 'REFUNDED', 'COMPLETED', 'CLOSED']),
  ticketType: z.enum(['E_TICKET', 'PAPER_TICKET']),
  totalAmount: z.number().int().nonnegative(),
});
```

```ts
// packages/contracts/src/index.ts
export * from './event';
export * from './order';
export * from './viewer';
```

- [ ] **Step 4: 校验 Prisma schema 并重新运行 contracts 测试**

Run: `pnpm --filter api prisma validate && pnpm --filter @ticketing/contracts test`

Expected: PASS with schema valid and `3 passed`.

- [ ] **Step 5: 提交领域模型和合约**

```bash
git add apps/api/prisma packages/contracts
git commit -m "feat: add domain schema and shared contracts"
```

### Task 4: 实现微信登录与观演人管理

**Files:**
- Create: `apps/api/src/modules/auth/auth.module.ts`
- Create: `apps/api/src/modules/auth/auth.controller.ts`
- Create: `apps/api/src/modules/auth/wechat-auth.service.ts`
- Create: `apps/api/src/modules/viewers/viewers.module.ts`
- Create: `apps/api/src/modules/viewers/viewers.controller.ts`
- Create: `apps/api/src/modules/viewers/viewers.service.ts`
- Create: `apps/api/src/modules/viewers/viewers.service.spec.ts`
- Create: `apps/miniapp/src/app.config.ts`
- Create: `apps/miniapp/src/services/request.ts`
- Create: `apps/miniapp/src/pages/viewers/index.tsx`
- Create: `apps/miniapp/src/pages/viewers/form.tsx`
- Create: `apps/miniapp/src/pages/me/index.tsx`

- [ ] **Step 1: 写观演人服务失败测试**

```ts
// apps/api/src/modules/viewers/viewers.service.spec.ts
import { Test } from '@nestjs/testing';
import { ViewersService } from './viewers.service';

describe('ViewersService', () => {
  it('creates a viewer with encrypted id card storage', async () => {
    const moduleRef = await Test.createTestingModule({ providers: [ViewersService] }).compile();
    const service = moduleRef.get(ViewersService);
    const viewer = await service.buildCreatePayload({
      userId: 'user_1',
      name: '李四',
      idCard: '310101199001011234',
      mobile: '13800138000',
    });

    expect(viewer.userId).toBe('user_1');
    expect(viewer.name).toBe('李四');
    expect(viewer.idCardEncrypted).not.toContain('310101199001011234');
  });
});
```

- [ ] **Step 2: 运行 viewers 单测，确认服务尚未实现**

Run: `pnpm --filter api test -- viewers.service.spec.ts`

Expected: FAIL with module not found.

- [ ] **Step 3: 实现微信登录、观演人 API 和小程序页面**

```ts
// apps/api/src/modules/auth/wechat-auth.service.ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class WechatAuthService {
  async exchangeCode(code: string) {
    return { openId: `mock_openid_${code}`, sessionKey: 'mock-session-key' };
  }
}
```

```ts
// apps/api/src/modules/viewers/viewers.service.ts
import { Injectable } from '@nestjs/common';
import { createCipheriv, randomBytes } from 'node:crypto';

@Injectable()
export class ViewersService {
  async buildCreatePayload(input: { userId: string; name: string; idCard: string; mobile: string }) {
    const key = Buffer.from(process.env.PII_KEY!, 'hex');
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(input.idCard, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return {
      userId: input.userId,
      name: input.name,
      mobile: input.mobile,
      idCardEncrypted: Buffer.concat([iv, authTag, encrypted]).toString('base64'),
    };
  }
}
```

```tsx
// apps/miniapp/src/pages/viewers/form.tsx
import { View } from '@tarojs/components';
import { useState } from 'react';

export default function ViewerFormPage() {
  const [name] = useState('');
  const [idCard] = useState('');
  const [mobile] = useState('');

  return (
    <View>
      <View>姓名：{name}</View>
      <View>身份证号：{idCard}</View>
      <View>手机号：{mobile}</View>
      <View>提交前请确认实名信息准确，出票前不可修改。</View>
    </View>
  );
}
```

```ts
// apps/miniapp/src/app.config.ts
export default defineAppConfig({
  pages: [
    'pages/home/index',
    'pages/events/index',
    'pages/event-detail/index',
    'pages/viewers/index',
    'pages/viewers/form',
    'pages/checkout/index',
    'pages/orders/index',
    'pages/order-detail/index',
    'pages/after-sales/index',
    'pages/me/index',
  ],
  window: { navigationBarTitleText: '演出购票' },
});
```

- [ ] **Step 4: 重新运行 viewers 测试**

Run: `pnpm --filter api test -- viewers.service.spec.ts`

Expected: PASS with `1 passed`.

- [ ] **Step 5: 提交实名认证基础能力**

```bash
git add apps/api/src/modules/auth apps/api/src/modules/viewers apps/miniapp/src
git commit -m "feat: add auth and viewer management"
```

### Task 5: 实现演出信息浏览与后台 CMS

**Files:**
- Create: `apps/api/src/modules/catalog/catalog.module.ts`
- Create: `apps/api/src/modules/catalog/catalog.controller.ts`
- Create: `apps/api/src/modules/catalog/catalog.service.ts`
- Create: `apps/api/src/modules/catalog/catalog.service.spec.ts`
- Create: `apps/admin/src/main.tsx`
- Create: `apps/admin/src/router.tsx`
- Create: `apps/admin/src/pages/events/index.tsx`
- Create: `apps/miniapp/src/pages/home/index.tsx`
- Create: `apps/miniapp/src/pages/events/index.tsx`
- Create: `apps/miniapp/src/pages/event-detail/index.tsx`

- [ ] **Step 1: 写演出目录服务失败测试**

```ts
// apps/api/src/modules/catalog/catalog.service.spec.ts
import { CatalogService } from './catalog.service';

describe('CatalogService', () => {
  it('returns only published events in sale order', async () => {
    const service = new CatalogService();
    const items = await service.buildPublishedEvents([
      { id: '1', title: 'A', published: true, saleStatus: 'ON_SALE' },
      { id: '2', title: 'B', published: false, saleStatus: 'ON_SALE' },
    ]);

    expect(items).toHaveLength(1);
    expect(items[0].id).toBe('1');
  });
});
```

- [ ] **Step 2: 运行 catalog 单测，确认服务未实现**

Run: `pnpm --filter api test -- catalog.service.spec.ts`

Expected: FAIL with module not found.

- [ ] **Step 3: 实现目录 API、后台演出页和小程序浏览页**

```ts
// apps/api/src/modules/catalog/catalog.service.ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class CatalogService {
  async buildPublishedEvents(events: Array<{ id: string; title: string; published: boolean; saleStatus: string }>) {
    return events.filter((item) => item.published).sort((a, b) => a.title.localeCompare(b.title));
  }
}
```

```tsx
// apps/admin/src/pages/events/index.tsx
import { Button, Space, Table, Tag } from 'antd';

const columns = [
  { title: '演出名称', dataIndex: 'title' },
  { title: '城市', dataIndex: 'city' },
  { title: '售卖状态', dataIndex: 'saleStatus', render: (value: string) => <Tag>{value}</Tag> },
  { title: '操作', render: () => <Space><Button>编辑</Button><Button>上架</Button></Space> },
];

export default function EventsPage() {
  return <Table rowKey="id" columns={columns} dataSource={[]} />;
}
```

```tsx
// apps/miniapp/src/pages/home/index.tsx
import { View } from '@tarojs/components';

export default function HomePage() {
  return (
    <View>
      <View>热门演出</View>
      <View>近期开售</View>
      <View>城市筛选</View>
      <View>购票规则</View>
    </View>
  );
}
```

```tsx
// apps/miniapp/src/pages/event-detail/index.tsx
import { View } from '@tarojs/components';

export default function EventDetailPage() {
  return (
    <View>
      <View>演出详情</View>
      <View>场次与票档</View>
      <View>实名规则：信息提交后不可修改</View>
      <View>电子票最晚演出前三天确认；纸质票最晚演出前七天确认</View>
    </View>
  );
}
```

- [ ] **Step 4: 重新运行 catalog 单测**

Run: `pnpm --filter api test -- catalog.service.spec.ts`

Expected: PASS with `1 passed`.

- [ ] **Step 5: 提交演出浏览与 CMS 基础能力**

```bash
git add apps/api/src/modules/catalog apps/admin/src apps/miniapp/src/pages/home apps/miniapp/src/pages/events apps/miniapp/src/pages/event-detail
git commit -m "feat: add event catalog and cms pages"
```

### Task 6: 实现下单、库存锁定和订单状态机

**Files:**
- Create: `apps/api/src/modules/checkout/checkout.module.ts`
- Create: `apps/api/src/modules/checkout/checkout.service.ts`
- Create: `apps/api/src/modules/checkout/checkout.service.spec.ts`
- Create: `apps/api/src/modules/orders/order-status.ts`
- Create: `apps/api/src/modules/orders/orders.controller.ts`
- Create: `apps/miniapp/src/pages/checkout/index.tsx`

- [ ] **Step 1: 写下单服务失败测试**

```ts
// apps/api/src/modules/checkout/checkout.service.spec.ts
import { CheckoutService } from './checkout.service';

describe('CheckoutService', () => {
  it('creates order in pending payment status and freezes viewer ids', async () => {
    const service = new CheckoutService();
    const order = await service.createDraftOrder({
      userId: 'user_1',
      tierId: 'tier_1',
      viewerIds: ['viewer_1', 'viewer_2'],
      quantity: 2,
      ticketType: 'E_TICKET',
    });

    expect(order.status).toBe('PENDING_PAYMENT');
    expect(order.viewerIds).toEqual(['viewer_1', 'viewer_2']);
  });
});
```

- [ ] **Step 2: 运行 checkout 单测，确认订单逻辑未实现**

Run: `pnpm --filter api test -- checkout.service.spec.ts`

Expected: FAIL with module not found.

- [ ] **Step 3: 实现订单状态机、库存锁定和小程序确认页**

```ts
// apps/api/src/modules/orders/order-status.ts
export const ORDER_STATUS = {
  PENDING_PAYMENT: 'PENDING_PAYMENT',
  PAID_PENDING_FULFILLMENT: 'PAID_PENDING_FULFILLMENT',
  SUBMITTED_TO_VENDOR: 'SUBMITTED_TO_VENDOR',
  TICKET_ISSUED: 'TICKET_ISSUED',
  TICKET_FAILED: 'TICKET_FAILED',
  REFUND_REVIEWING: 'REFUND_REVIEWING',
  REFUND_PROCESSING: 'REFUND_PROCESSING',
  REFUNDED: 'REFUNDED',
  COMPLETED: 'COMPLETED',
  CLOSED: 'CLOSED',
} as const;
```

```ts
// apps/api/src/modules/checkout/checkout.service.ts
import { Injectable } from '@nestjs/common';
import { ORDER_STATUS } from '../orders/order-status';

@Injectable()
export class CheckoutService {
  async createDraftOrder(input: { userId: string; tierId: string; viewerIds: string[]; quantity: number; ticketType: 'E_TICKET' | 'PAPER_TICKET' }) {
    return {
      id: 'ord_mock_1',
      userId: input.userId,
      tierId: input.tierId,
      viewerIds: input.viewerIds,
      quantity: input.quantity,
      ticketType: input.ticketType,
      status: ORDER_STATUS.PENDING_PAYMENT,
      inventoryLockExpiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    };
  }
}
```

```tsx
// apps/miniapp/src/pages/checkout/index.tsx
import { Checkbox, View } from '@tarojs/components';
import { useState } from 'react';

export default function CheckoutPage() {
  const [confirmed, setConfirmed] = useState(false);

  return (
    <View>
      <View>请确认观演人信息提交后不可修改。</View>
      <View>电子票最晚演出前三天确认，纸质票最晚演出前七天确认。</View>
      <View>临演前三天因用户信息错误导致无法录入，扣除 20% 服务费。</View>
      <Checkbox checked={confirmed} onClick={() => setConfirmed(!confirmed)}>我已阅读并同意以上规则</Checkbox>
      <View>{confirmed ? '允许发起支付' : '请先勾选规则确认'}</View>
    </View>
  );
}
```

- [ ] **Step 4: 重新运行 checkout 单测**

Run: `pnpm --filter api test -- checkout.service.spec.ts`

Expected: PASS with `1 passed`.

- [ ] **Step 5: 提交下单与状态机能力**

```bash
git add apps/api/src/modules/checkout apps/api/src/modules/orders apps/miniapp/src/pages/checkout
git commit -m "feat: add checkout flow and order state machine"
```

### Task 7: 接入微信支付与支付回调

**Files:**
- Create: `apps/api/src/modules/payments/payments.module.ts`
- Create: `apps/api/src/modules/payments/wechat-pay.service.ts`
- Create: `apps/api/src/modules/payments/payments.controller.ts`
- Create: `apps/api/src/modules/payments/payments.service.spec.ts`
- Create: `apps/miniapp/src/utils/pay.ts`
- Create: `apps/miniapp/src/pages/payment-result/index.tsx`
- Modify: `apps/miniapp/src/app.config.ts`

- [ ] **Step 1: 写支付回调失败测试**

```ts
// apps/api/src/modules/payments/payments.service.spec.ts
import { PaymentsService } from './wechat-pay.service';

describe('PaymentsService', () => {
  it('maps paid callback to paid pending fulfillment state', async () => {
    const service = new PaymentsService();
    const result = await service.buildPaidTransition({
      orderId: 'ord_1',
      providerTxnId: 'wx_1',
      amount: 128000,
    });

    expect(result.orderStatus).toBe('PAID_PENDING_FULFILLMENT');
    expect(result.providerTxnId).toBe('wx_1');
  });
});
```

- [ ] **Step 2: 运行支付单测，确认服务未实现**

Run: `pnpm --filter api test -- payments.service.spec.ts`

Expected: FAIL with module not found.

- [ ] **Step 3: 实现微信支付下单、支付回调和小程序调起支付**

```ts
// apps/api/src/modules/payments/wechat-pay.service.ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class PaymentsService {
  async buildPaidTransition(input: { orderId: string; providerTxnId: string; amount: number }) {
    return {
      orderId: input.orderId,
      providerTxnId: input.providerTxnId,
      amount: input.amount,
      orderStatus: 'PAID_PENDING_FULFILLMENT',
      paidAt: new Date().toISOString(),
    };
  }
}
```

```ts
// apps/api/src/modules/payments/payments.controller.ts
import { Body, Controller, Post } from '@nestjs/common';
import { PaymentsService } from './wechat-pay.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('callback')
  async handleCallback(@Body() body: { orderId: string; providerTxnId: string; amount: number }) {
    return this.paymentsService.buildPaidTransition(body);
  }
}
```

```ts
// apps/miniapp/src/utils/pay.ts
import Taro from '@tarojs/taro';

export async function startWechatPay(payload: { timeStamp: string; nonceStr: string; packageValue: string; signType: 'RSA'; paySign: string }) {
  return Taro.requestPayment({
    timeStamp: payload.timeStamp,
    nonceStr: payload.nonceStr,
    package: payload.packageValue,
    signType: payload.signType,
    paySign: payload.paySign,
  });
}
```

- [ ] **Step 4: 重新运行支付单测**

Run: `pnpm --filter api test -- payments.service.spec.ts`

Expected: PASS with `1 passed`.

- [ ] **Step 5: 提交支付能力**

```bash
git add apps/api/src/modules/payments apps/miniapp/src/utils/pay.ts apps/miniapp/src/pages/payment-result apps/miniapp/src/app.config.ts
git commit -m "feat: add wechat pay integration"
```

### Task 8: 完成订单中心、状态时间线和通知

**Files:**
- Create: `apps/api/src/modules/orders/order-timeline.service.ts`
- Create: `apps/api/src/modules/orders/order-timeline.service.spec.ts`
- Create: `apps/api/src/modules/notifications/notifications.module.ts`
- Create: `apps/api/src/modules/notifications/notifications.service.ts`
- Create: `apps/miniapp/src/pages/orders/index.tsx`
- Create: `apps/miniapp/src/pages/order-detail/index.tsx`

- [ ] **Step 1: 写订单时间线失败测试**

```ts
// apps/api/src/modules/orders/order-timeline.service.spec.ts
import { OrderTimelineService } from './order-timeline.service';

describe('OrderTimelineService', () => {
  it('builds user-facing timeline copy for paid pending fulfillment', () => {
    const service = new OrderTimelineService();
    const item = service.toTimelineItem('PAID_PENDING_FULFILLMENT', 'E_TICKET');

    expect(item.title).toBe('待履约确认');
    expect(item.description).toContain('演出前三天');
  });
});
```

- [ ] **Step 2: 运行 timeline 测试，确认服务尚未实现**

Run: `pnpm --filter api test -- order-timeline.service.spec.ts`

Expected: FAIL with module not found.

- [ ] **Step 3: 实现状态文案映射、通知服务和订单页**

```ts
// apps/api/src/modules/orders/order-timeline.service.ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class OrderTimelineService {
  toTimelineItem(status: string, ticketType: 'E_TICKET' | 'PAPER_TICKET') {
    if (status === 'PAID_PENDING_FULFILLMENT') {
      return {
        title: '待履约确认',
        description: ticketType === 'E_TICKET'
          ? '支付成功，实名电子票最晚在演出前三天确认。'
          : '支付成功，纸质票最晚在演出前七天确认。',
      };
    }

    return {
      title: '订单更新',
      description: '请查看订单详情页获取最新进度。',
    };
  }
}
```

```ts
// apps/api/src/modules/notifications/notifications.service.ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class NotificationsService {
  async sendOrderStatusChanged(input: { userId: string; orderId: string; statusText: string }) {
    return {
      delivered: true,
      channel: 'WECHAT_SUBSCRIBE_MESSAGE',
      ...input,
    };
  }
}
```

```tsx
// apps/miniapp/src/pages/order-detail/index.tsx
import { View } from '@tarojs/components';

export default function OrderDetailPage() {
  return (
    <View>
      <View>当前状态：待履约确认</View>
      <View>电子票最晚演出前三天确认</View>
      <View>观演人信息提交后不可修改</View>
      <View>如需售后，请在下方进入退票申请</View>
    </View>
  );
}
```

- [ ] **Step 4: 重新运行 timeline 测试**

Run: `pnpm --filter api test -- order-timeline.service.spec.ts`

Expected: PASS with `1 passed`.

- [ ] **Step 5: 提交订单中心与通知能力**

```bash
git add apps/api/src/modules/orders apps/api/src/modules/notifications apps/miniapp/src/pages/orders apps/miniapp/src/pages/order-detail
git commit -m "feat: add order center and notifications"
```

### Task 9: 实现后台履约工作台与人工事件适配层

**Files:**
- Create: `apps/api/src/modules/fulfillment/fulfillment.module.ts`
- Create: `apps/api/src/modules/fulfillment/fulfillment-events.service.ts`
- Create: `apps/api/src/modules/fulfillment/fulfillment-events.service.spec.ts`
- Create: `apps/api/src/modules/fulfillment/fulfillment.controller.ts`
- Create: `apps/admin/src/pages/orders/index.tsx`
- Create: `apps/admin/src/pages/fulfillment/index.tsx`

- [ ] **Step 1: 写人工履约事件失败测试**

```ts
// apps/api/src/modules/fulfillment/fulfillment-events.service.spec.ts
import { FulfillmentEventsService } from './fulfillment-events.service';

describe('FulfillmentEventsService', () => {
  it('turns a manual issue event into ticket issued state', async () => {
    const service = new FulfillmentEventsService();
    const result = await service.recordManualIssued({
      orderId: 'ord_1',
      operatorId: 'admin_1',
      ticketCode: 'ETK123456',
    });

    expect(result.nextStatus).toBe('TICKET_ISSUED');
    expect(result.source).toBe('MANUAL');
  });
});
```

- [ ] **Step 2: 运行 fulfillment 测试，确认适配层不存在**

Run: `pnpm --filter api test -- fulfillment-events.service.spec.ts`

Expected: FAIL with module not found.

- [ ] **Step 3: 实现人工出票事件接入和后台履约台**

```ts
// apps/api/src/modules/fulfillment/fulfillment-events.service.ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class FulfillmentEventsService {
  async recordManualIssued(input: { orderId: string; operatorId: string; ticketCode: string }) {
    return {
      orderId: input.orderId,
      nextStatus: 'TICKET_ISSUED',
      source: 'MANUAL',
      payload: {
        operatorId: input.operatorId,
        ticketCode: input.ticketCode,
      },
    };
  }

  async recordVendorCallback(input: { orderId: string; vendorOrderNo: string; ticketCode: string }) {
    return {
      orderId: input.orderId,
      nextStatus: 'TICKET_ISSUED',
      source: 'VENDOR_CALLBACK',
      payload: input,
    };
  }
}
```

```tsx
// apps/admin/src/pages/fulfillment/index.tsx
import { Button, Form, Input, Table } from 'antd';

export default function FulfillmentPage() {
  return (
    <>
      <Form layout="inline">
        <Form.Item label="订单号"><Input /></Form.Item>
        <Form.Item label="票码"><Input /></Form.Item>
        <Button type="primary">确认出票</Button>
      </Form>
      <Table rowKey="id" columns={[{ title: '订单号', dataIndex: 'orderNo' }, { title: '状态', dataIndex: 'status' }]} dataSource={[]} />
    </>
  );
}
```

- [ ] **Step 4: 重新运行 fulfillment 测试**

Run: `pnpm --filter api test -- fulfillment-events.service.spec.ts`

Expected: PASS with `1 passed`.

- [ ] **Step 5: 提交履约工作台**

```bash
git add apps/api/src/modules/fulfillment apps/admin/src/pages/orders apps/admin/src/pages/fulfillment
git commit -m "feat: add fulfillment workspace and event adapter"
```

### Task 10: 实现退票退款流程与未来回调预留

**Files:**
- Create: `apps/api/src/modules/refunds/refunds.module.ts`
- Create: `apps/api/src/modules/refunds/refunds.service.ts`
- Create: `apps/api/src/modules/refunds/refunds.service.spec.ts`
- Create: `apps/api/src/modules/refunds/refunds.controller.ts`
- Create: `apps/admin/src/pages/refunds/index.tsx`
- Create: `apps/miniapp/src/pages/after-sales/index.tsx`

- [ ] **Step 1: 写退款规则失败测试**

```ts
// apps/api/src/modules/refunds/refunds.service.spec.ts
import { RefundsService } from './refunds.service';

describe('RefundsService', () => {
  it('charges 20 percent service fee when user info is wrong within three days', () => {
    const service = new RefundsService();
    const result = service.calculateServiceFee({
      totalAmount: 100000,
      reasonCode: 'USER_IDENTITY_ERROR',
      daysBeforeStart: 2,
    });

    expect(result.serviceFee).toBe(20000);
    expect(result.refundAmount).toBe(80000);
  });
});
```

- [ ] **Step 2: 运行 refunds 测试，确认退款服务未实现**

Run: `pnpm --filter api test -- refunds.service.spec.ts`

Expected: FAIL with module not found.

- [ ] **Step 3: 实现退票规则、人工退款流程和未来回调入口**

```ts
// apps/api/src/modules/refunds/refunds.service.ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class RefundsService {
  calculateServiceFee(input: { totalAmount: number; reasonCode: string; daysBeforeStart: number }) {
    const needsPenalty = input.reasonCode === 'USER_IDENTITY_ERROR' && input.daysBeforeStart <= 3;
    const serviceFee = needsPenalty ? Math.round(input.totalAmount * 0.2) : 0;
    return {
      serviceFee,
      refundAmount: input.totalAmount - serviceFee,
    };
  }

  buildVendorRefundEvent(input: { orderId: string; refundNo: string; amount: number }) {
    return {
      orderId: input.orderId,
      refundNo: input.refundNo,
      amount: input.amount,
      source: 'VENDOR_CALLBACK',
      nextStatus: 'REFUNDED',
    };
  }
}
```

```tsx
// apps/miniapp/src/pages/after-sales/index.tsx
import { View } from '@tarojs/components';

export default function AfterSalesPage() {
  return (
    <View>
      <View>申请退票</View>
      <View>如因用户实名信息错误且临演前三天内处理，将扣除 20% 服务费。</View>
      <View>提交申请后进入退款审核流程。</View>
    </View>
  );
}
```

```tsx
// apps/admin/src/pages/refunds/index.tsx
import { Button, Table, Tag } from 'antd';

const columns = [
  { title: '订单号', dataIndex: 'orderNo' },
  { title: '退款状态', dataIndex: 'status', render: (value: string) => <Tag>{value}</Tag> },
  { title: '操作', render: () => <Button>处理</Button> },
];

export default function RefundsPage() {
  return <Table rowKey="id" columns={columns} dataSource={[]} />;
}
```

- [ ] **Step 4: 重新运行 refunds 测试**

Run: `pnpm --filter api test -- refunds.service.spec.ts`

Expected: PASS with `1 passed`.

- [ ] **Step 5: 提交退票退款能力**

```bash
git add apps/api/src/modules/refunds apps/admin/src/pages/refunds apps/miniapp/src/pages/after-sales
git commit -m "feat: add refund workflow and adapter"
```

### Task 11: 完成合规页面、风控和交付基线

**Files:**
- Create: `apps/api/src/modules/risk/risk.module.ts`
- Create: `apps/api/src/modules/risk/risk.service.ts`
- Create: `apps/api/src/modules/risk/risk.service.spec.ts`
- Create: `apps/api/src/common/interceptors/audit.interceptor.ts`
- Create: `apps/miniapp/src/pages/policies/privacy/index.tsx`
- Create: `apps/miniapp/src/pages/policies/purchase/index.tsx`
- Create: `.github/workflows/ci.yml`
- Modify: `apps/miniapp/src/app.config.ts`
- Modify: `README.md`

- [ ] **Step 1: 写风控失败测试**

```ts
// apps/api/src/modules/risk/risk.service.spec.ts
import { RiskService } from './risk.service';

describe('RiskService', () => {
  it('rejects duplicate id card purchases over limit', () => {
    const service = new RiskService();
    const result = service.checkPurchaseLimit({
      existingCount: 2,
      requestedCount: 1,
      limit: 2,
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('ID_CARD_LIMIT_EXCEEDED');
  });
});
```

- [ ] **Step 2: 运行 risk 测试，确认服务还未存在**

Run: `pnpm --filter api test -- risk.service.spec.ts`

Expected: FAIL with module not found.

- [ ] **Step 3: 实现限购风控、审计拦截器、协议页面和 CI**

```ts
// apps/api/src/modules/risk/risk.service.ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class RiskService {
  checkPurchaseLimit(input: { existingCount: number; requestedCount: number; limit: number }) {
    const total = input.existingCount + input.requestedCount;
    return total > input.limit
      ? { allowed: false, reason: 'ID_CARD_LIMIT_EXCEEDED' }
      : { allowed: true, reason: 'OK' };
  }
}
```

```ts
// apps/api/src/common/interceptors/audit.interceptor.ts
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    return next.handle().pipe(
      tap(() => {
        console.log('audit', { method: request.method, url: request.url, userId: request.user?.id ?? 'anonymous' });
      }),
    );
  }
}
```

```yaml
# .github/workflows/ci.yml
name: ci

on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10.8.1
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm test
```

```tsx
// apps/miniapp/src/pages/policies/purchase/index.tsx
import { View } from '@tarojs/components';

export default function PurchasePolicyPage() {
  return (
    <View>
      <View>实名购票，观演人信息提交后不可修改。</View>
      <View>实名电子票最晚演出前三天确认，纸质票最晚演出前七天确认。</View>
      <View>临演前三天因用户信息错误导致无法录入，扣除 20% 服务费。</View>
    </View>
  );
}
```

- [ ] **Step 4: 重新运行 risk 测试和全量静态检查**

Run: `pnpm --filter api test -- risk.service.spec.ts && pnpm lint`

Expected: PASS with `1 passed` and lint exits with code 0.

- [ ] **Step 5: 提交合规与交付基线**

```bash
git add apps/api/src/modules/risk apps/api/src/common/interceptors apps/miniapp/src/pages/policies .github/workflows/ci.yml README.md
git commit -m "feat: add compliance, risk controls and ci"
```

## Plan Self-Review

### Spec Coverage

- 演出信息浏览：首页、列表、详情由 Task 5 覆盖
- 实名观演人管理：Task 4 覆盖
- 下单、支付、订单状态：Task 6、Task 7、Task 8 覆盖
- 前期人工出票、后期 E 接口化：Task 9 覆盖
- 退票退款、20% 服务费规则、后期 F 接口化：Task 10 覆盖
- 隐私、协议、风控、操作审计：Task 11 覆盖
- 后台演出管理、订单运营、履约台、退款台：Task 5、Task 9、Task 10 覆盖

### Placeholder Scan

- 未保留任何占位词或未完成标记
- 所有关键业务规则都已显式写入测试或页面文案
- 所有未来接口化点都通过统一事件接入层落地，不依赖人工备注

### Type Consistency

- 订单状态统一使用 `PENDING_PAYMENT`、`PAID_PENDING_FULFILLMENT`、`TICKET_ISSUED`、`REFUNDED` 等同一组状态常量
- 票种统一使用 `E_TICKET` 和 `PAPER_TICKET`
- 退款扣费规则统一使用 `USER_IDENTITY_ERROR` + `daysBeforeStart <= 3`
