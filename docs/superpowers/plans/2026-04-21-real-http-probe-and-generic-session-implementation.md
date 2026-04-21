# Real HTTP Probe 与通用会话链路实施记录

> 这份文档记录 `2026-04-21` 这轮“把 stub probe 替换成真实 HTTP workflow，并去掉样例后端里的 WeChat 专属依赖”的实施结果。当前内容保留最终落地结论，便于研发团队快速接手，而不是重复阅读当时的逐步执行草稿。

## 状态

- `设计参考`：
  [2026-04-21-real-http-probe-and-generic-session-design.md](../specs/2026-04-21-real-http-probe-and-generic-session-design.md)
- `执行状态`：已完成并并入当前交接基线
- `最新验收 smoke`：`run-handoff-smoke-20260421234408`
- `验收结果`：fresh stack 下真实 HTTP workflow 可跑通，summary 可持久化，`api.err.log` 与 `load-control.err.log` 为空

## 实施目标

这一轮改造的核心目标有两个：

1. 用真实 HTTP 请求替代 Agent 里的 stub probe，让 load-control 不再只是“编排烟雾测试”
2. 把 `apps/api` 中对特定平台登录 / 支付的绑定拆掉，改成对压测场景更稳定的通用会话与通用支付样例流程

## 最终交付范围

已完成的交付项如下：

1. 样例后端新增通用 customer-session bootstrap 流程，替代早期的 WeChat 专属登录路径
2. 样例支付链路改为 provider-neutral 的 payment intent 样例，不再强依赖 WeChat 语义
3. `apps/load-control` 的默认探针切换到 `HttpWorkflowProbe`
4. 探针真实执行以下链路：
   - `POST /api/auth/session/bootstrap`
   - `GET /api/viewers`
   - `POST /api/viewers`
   - `GET /api/catalog/events`
   - `GET /api/catalog/events/:eventId`
   - `POST /api/orders/draft`
5. Agent 侧对 `401 Unauthorized` 的处理改为清理缓存 token，并将失败暴露到运行结果中，而不是伪造重试成功
6. API bootstrap 与 Agent 侧并发 bootstrap 的竞态已经收口

## 关键改动点

### 共享合约与持久化模型

- 更新 `packages/contracts` 中的认证与支付合约
- 补齐样例后端所需的 Prisma schema / migration
- 保证控制面、Agent 与样例后端的输入输出结构一致

### 样例后端认证链路

- 新增 `session bootstrap` 能力，面向内部压测与本地联调使用
- 去除对外部平台登录态的强耦合
- 让本地、预发、受控演练都能复用同一条稳定路径

### 样例后端支付链路

- 将旧的 WeChat-only 支付样例改造成通用 payment intent sandbox
- 保留“可演示、可联调、可被压测”的基本能力
- 不把真实三方支付接入带入本轮范围

### Agent 真实 HTTP Workflow

- `HttpWorkflowProbe` 维护自身会话状态
- 首次运行或 token 失效时自动重新 bootstrap
- 在 viewer 不存在时完成创建
- 对 catalog / draft order 失败进行上报，而不是静默吞掉

## 回归验证

本轮实施完成后，已通过的关键验证包括：

- `corepack pnpm --filter api exec jest --runInBand`
- `corepack pnpm --filter load-control exec jest --runInBand`
- `corepack pnpm --filter @ticketing/contracts test -- --runInBand`
- `corepack pnpm exec tsc -p apps/api/tsconfig.json --noEmit`
- `corepack pnpm exec tsc -p apps/load-control/tsconfig.json --noEmit`
- 空 Docker volume 条件下重新启动本地栈并完成 fresh smoke

## 对当前交接版本的意义

这轮改造把系统从“控制面能跑通”推进到了“真实业务 HTTP 链路能跑通”，因此它是当前交接版本里的关键里程碑之一。没有这一步，控制台中的任务运行、作战台与复盘都只能建立在 synthetic success 之上，缺少真实价值。

## 相关文档

- [2026-04-21-real-http-probe-and-generic-session-design.md](../specs/2026-04-21-real-http-probe-and-generic-session-design.md)
- [2026-04-18-load-testing-saas-reframe-design.md](../specs/2026-04-18-load-testing-saas-reframe-design.md)
- [2026-04-21-load-testing-saas-engineering-handoff.md](../guides/2026-04-21-load-testing-saas-engineering-handoff.md)
