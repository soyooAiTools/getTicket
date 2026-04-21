# Load-Testing SaaS 重构实施记录

> **供 Agent Worker 参考：** 原始实施阶段基于 `superpowers:subagent-driven-development` / `superpowers:executing-plans` 逐项推进，当前文档保留的是对最终落地结果的摘要，而不是逐步执行说明。

**目标：** 将仓库重构为一套内部 Load-Testing SaaS，使 `apps/admin` 成为操作台，`apps/load-control` 成为持久化控制面，云节点 Agent 负责实时遥测回传，而 `apps/api` 作为内置样例被测系统保留在仓库中。

**架构：** 保留 `apps/load-control` 作为编排后端，补齐持久化运行态与实时遥测能力；把 `apps/admin` 改造成控制室式 UI；通过 `packages/contracts` 统一控制台、控制面、Agent 与测试之间的合约。

**技术栈：** TypeScript、NestJS、React、React Router、Ant Design、Prisma、Redis、Postgres、Jest、Vitest、pnpm workspace

---

## 状态

- `设计文档`：
  [2026-04-18-load-testing-saas-reframe-design.md](../specs/2026-04-18-load-testing-saas-reframe-design.md)
- `操作手册`：
  [2026-04-18-load-testing-saas-operator-guide.md](../guides/2026-04-18-load-testing-saas-operator-guide.md)
- `研发交接`：
  [2026-04-21-load-testing-saas-engineering-handoff.md](../guides/2026-04-21-load-testing-saas-engineering-handoff.md)
- `执行状态`：已在分支 `codex/load-testing-saas-reframe` 上完成
- `最新 fresh smoke`：`run-handoff-smoke-20260421234408` 已于 `2026-04-21` 跑通，结果为 `18/18` 成功请求、`1` 个 assignment、`1` 个 summary、`6` 个样例订单

## 实施拆分

### 任务 1：控制面持久化基础能力

**结果：** 用持久化 run、assignment、summary、telemetry 替代原有的内存态方案。

- [x] 在 `packages/contracts/src/load-testing.ts` 中补齐共享合约与相关测试
- [x] 在 `apps/load-control/src/modules/control/control.repository.ts` 中引入 Prisma 持久化
- [x] 将 load-control 的 Prisma client 隔离在 `apps/load-control/prisma/generated/client`
- [x] 持久化 assignment 与校验后的 summary，确保重启后仍可复盘

### 任务 2：运行时控制 API 与遥测聚合

**结果：** 为 SaaS 控制台暴露完整的控制面 API，并让实时运行态可查询、可聚合。

- [x] 在 `apps/load-control/src/modules/control/default-control-catalog.ts` 中预置节点池与模板
- [x] 在 `apps/load-control/src/modules/control/control.controller.ts` 中补齐节点池、模板、run 列表、run 详情、start、stop、live snapshot 等接口
- [x] 在 `apps/load-control/src/modules/telemetry` 中加入实时遥测写入与查询路径
- [x] 为控制台访问路径启用 CORS，并补上 e2e 覆盖

### 任务 3：云节点 Agent 实时执行链路

**结果：** Agent 会等待任务进入运行态，在 phase 执行过程中连续上报 telemetry，并在结束后提交 summary。

- [x] 更新 `apps/load-control/src/agent/http-control.client.ts`，支持运行态轮询与 telemetry 上传
- [x] 更新 `apps/load-control/src/agent/agent-runner.ts`，在 phase 窗口内实时发射 telemetry
- [x] 更新 `apps/load-control/src/agent/main.ts`，实现 register -> wait -> execute -> summarize 的标准生命周期
- [x] 用单测和 e2e 覆盖 Agent 侧关键流程

### 任务 4：操作台重构

**结果：** 将 `apps/admin` 改造成面向抢票压测 SaaS 的控制室式 UI。

- [x] 在 `apps/admin/src/router.tsx` 中将旧票务路由替换为 `/overview`、`/runs`、`/runs/:runId`、`/nodes`、`/reports/:baselineRunId/:productionRunId`
- [x] 在 `apps/admin/src/layouts/control-shell.tsx` 中加入控制台壳层
- [x] 在 `apps/admin/src/services/load-control.ts` 与 `apps/admin/src/hooks/use-run-stream.ts` 中补齐 load-control 客户端与 live stream hook
- [x] 在 `apps/admin/src/pages` 下实现 overview、runs、run detail、nodes、reports 页面
- [x] 补齐操作台路由测试、页面测试与操作手册

## 验证

- [x] `corepack pnpm --filter load-control exec tsc -p tsconfig.json --noEmit`
- [x] `corepack pnpm --filter admin test`
- [x] `corepack pnpm --filter admin build`
- [x] `corepack pnpm test`
- [x] `.\start-local-stack.cmd --no-browser`
- [x] 对 `apps/api` 跑通 fresh real HTTP smoke：`run-handoff-smoke-20260421234408`
- [x] `corepack pnpm --filter api exec jest --runInBand`
- [x] `corepack pnpm --filter load-control exec jest --runInBand`
- [x] `corepack pnpm --filter @ticketing/contracts test -- --runInBand`
- [x] `corepack pnpm exec tsc -p apps/api/tsconfig.json --noEmit`
- [x] `corepack pnpm exec tsc -p apps/load-control/tsconfig.json --noEmit`
- [x] `corepack pnpm exec vitest run tests/workspace/local-stack-launchers.spec.ts tests/workspace/repo-layout.spec.ts`

## 备注

- 当前产品线的仓库边界是 `apps/api`、`apps/admin`、`apps/load-control`
- `admin` 的 Vitest 仍会打印 React Router / Ant Design 的 `useLayoutEffect` SSR warning，但测试与构建结果均为通过
- 当前分支应被视为 Load-Testing SaaS 重构后的干净交接基线
