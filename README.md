# Load-Testing SaaS 重构工作区

这是一个面向内部研发与测试团队的 `Monorepo`，用于承载一套内部抢票压测 SaaS。
当前产品边界已经收敛为三块核心能力：

- `apps/admin`：运营与研发共用的控制台
- `apps/load-control`：控制面、调度面与本地 Agent 入口
- `apps/api`：内置样例被测系统（System Under Test）

## 工作区结构

- `apps/api`：基于 NestJS 的样例票务后端，覆盖认证、观演人、票务目录、草稿单、支付、履约、退款等链路
- `apps/admin`：基于 Vite + React 的运营控制台，负责任务创建、任务运行、节点观测与复盘查看
- `apps/load-control`：基于 NestJS 的压测控制面，负责任务规划、节点注册、实时遥测汇总与本地 Agent 启动
- `packages/contracts`：共享 Zod 合约，供控制台、控制面、Agent 与测试共同使用
- `tests`：仓库结构与工作区级别校验

## 核心文档

- 需求与设计：
  [2026-04-18-load-testing-saas-reframe-design.md](docs/superpowers/specs/2026-04-18-load-testing-saas-reframe-design.md)
- 操作手册：
  [2026-04-18-load-testing-saas-operator-guide.md](docs/superpowers/guides/2026-04-18-load-testing-saas-operator-guide.md)
- 研发交接：
  [2026-04-21-load-testing-saas-engineering-handoff.md](docs/superpowers/guides/2026-04-21-load-testing-saas-engineering-handoff.md)
- 团队转发模板：
  [2026-04-22-load-testing-saas-team-handoff-message.md](docs/superpowers/guides/2026-04-22-load-testing-saas-team-handoff-message.md)
- 重构实施记录：
  [2026-04-18-load-testing-saas-reframe-implementation.md](docs/superpowers/plans/2026-04-18-load-testing-saas-reframe-implementation.md)
- Real HTTP Probe 历史执行计划：
  [2026-04-21-real-http-probe-and-generic-session-implementation.md](docs/superpowers/plans/2026-04-21-real-http-probe-and-generic-session-implementation.md)

## 常用命令

- `corepack pnpm install`
- `corepack pnpm dev:api`
- `corepack pnpm dev:admin`
- `corepack pnpm dev:load-control`
- `corepack pnpm lint`
- `corepack pnpm test`

## 说明

- 当前主交付边界是 `apps/api`、`apps/admin`、`apps/load-control` 与 `packages/contracts`
- `apps/api` 主要使用 Jest
- 前端与共享包主要使用 Vitest
- 根目录 `lint` 是工作区级基线校验，不是全仓库的严格风格扫描
