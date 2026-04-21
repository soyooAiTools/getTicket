# Load-Testing SaaS 研发交接说明

## 范围

这份交接说明覆盖 `2026-04-21` 时点的 Load-Testing SaaS 重构分支状态。

当前有效研发边界为：

- `apps/admin`
- `apps/load-control`
- `apps/api`
- `packages/contracts`
- `scripts` 与 `tests` 下的本地栈脚本、仓库级验证与辅助能力

明确不在本次交接范围内的内容：

- 早于 SaaS 重构阶段的旧票务产品设计文档

## 交接前已完成的关键收口

当前分支已经完成以下此前阻塞交接的事项：

1. fresh run 规划阶段会先持久化节点，再写入 assignment，已经消除 clean stack 下的外键失败问题
2. 本地栈启动流程已经具备 fail-fast、基础设施 ready 检测、双存储 reseed、以及 Redis 旧运行态清理能力
3. `apps/api` 已支持面向压测链路的通用会话 bootstrap 与通用支付样例流程，不再依赖特定平台语义
4. 默认负载探针已经切换到真实的 HTTP workflow，不再使用 stub probe
5. API bootstrap 与 Agent 侧的并发 bootstrap race 已完成收口
6. `admin` 已清理到交接面，旧页面与乱码文案不再进入当前产品边界
7. `load-control` 的 Zod 合约校验失败现在会返回 `400 Bad Request`，API 与 control 的 health 标识也已改为 SaaS 命名

## 主要入口文档

建议研发接手时优先阅读以下文档：

- 产品/设计基线：
  [2026-04-18-load-testing-saas-reframe-design.md](../specs/2026-04-18-load-testing-saas-reframe-design.md)
- 操作/运行手册：
  [2026-04-18-load-testing-saas-operator-guide.md](./2026-04-18-load-testing-saas-operator-guide.md)
- 面向研发团队的转发模板：
  [2026-04-22-load-testing-saas-team-handoff-message.md](./2026-04-22-load-testing-saas-team-handoff-message.md)
- 重构实施记录：
  [2026-04-18-load-testing-saas-reframe-implementation.md](../plans/2026-04-18-load-testing-saas-reframe-implementation.md)
- Real HTTP Probe 详细实现过程：
  [2026-04-21-real-http-probe-and-generic-session-implementation.md](../plans/2026-04-21-real-http-probe-and-generic-session-implementation.md)

当前代码入口建议从这些位置开始：

- `apps/admin/src/router.tsx`
- `apps/admin/src/shared/console-copy.ts`
- `apps/load-control/src/modules/control/control.service.ts`
- `apps/load-control/src/agent/main.ts`
- `apps/load-control/src/agent/http-workflow.probe.ts`
- `apps/api/src/modules/auth/session-bootstrap.service.ts`
- `apps/api/src/modules/payments/payments.service.ts`
- `scripts/local-stack.common.ps1`

## 最新验证基线

基于当前分支状态，以下结果已在 `2026-04-21` 完成验证：

- `.\start-local-stack.cmd --no-browser` 可在空 Docker volume 条件下成功启动
- `api`、`load-control`、`admin` 三个服务都能健康启动
- fresh smoke run `run-handoff-smoke-20260421234408` 成功完成
- smoke 结果为：
  - 状态 `COMPLETED`
  - `1` 个 assignment
  - `1` 个 summary
  - phase 成功数 `18/18`
  - 样例目标侧新增 `6` 个订单
- 完成 smoke 后，`api.err.log` 与 `load-control.err.log` 为空

## 交接前重新执行过的命令

```powershell
corepack pnpm --filter api exec jest --runInBand
corepack pnpm --filter load-control exec jest --runInBand
corepack pnpm --filter @ticketing/contracts test -- --runInBand
corepack pnpm exec tsc -p apps/api/tsconfig.json --noEmit
corepack pnpm exec tsc -p apps/load-control/tsconfig.json --noEmit
corepack pnpm --filter api test:e2e -- --runInBand --runTestsByPath test/health.e2e-spec.ts
corepack pnpm --filter load-control test:e2e -- --runInBand --runTestsByPath test/health.e2e-spec.ts test/control.e2e-spec.ts
corepack pnpm exec vitest run apps/admin/src tests/workspace/repo-layout.spec.ts --reporter=verbose
corepack pnpm exec vitest run tests/workspace/local-stack-launchers.spec.ts --reporter=verbose
corepack pnpm --filter admin build
```

## 建议审阅顺序

1. 先看重构设计与 Real HTTP Probe 相关设计，理解产品边界
2. 再看 `apps/load-control` 的规划、运行态与 Agent 侧变化
3. 然后看 `apps/api` 的 session bootstrap 与通用支付样例链路
4. 再看本地栈脚本、seed 与基础设施启动流程
5. 最后看 `admin` 的任务路由页、节点页与复盘页

## 运行说明

- 默认本地目标仍然是 `apps/api`
- 预置本地 draft run 为 `run-local-demo-01`
- `LOAD_TEST_INTERNAL_SECRET` 必须在 API 与 Agent 两侧保持一致
- 探针会把未授权响应当成真实失败，不会再伪造“成功重试”路径

## 已知非阻塞约束

- `admin` 当前测试更偏向路由页与任务页覆盖，不是完整视觉回归体系
- 当前分支应被视为干净的 SaaS handoff baseline，而不是混合型票务产品分支
