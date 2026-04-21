# Load-Testing SaaS 操作台使用说明

这份文档描述当前 Load-Testing SaaS 重构后的操作台与运行面。当前主操作路径已经收敛到 `apps/admin` 与 `apps/load-control`，而 `apps/api` 则作为本地联调与 smoke 的内置样例被测系统。

## 控制台路由

当前控制台公开的主要路由是：

- `/overview`
- `/runs`
- `/runs/:runId`
- `/nodes`
- `/reports/:baselineRunId/:productionRunId`

控制台内显示的中文路由标题为：

- `/overview`：`作战总览`
- `/runs`：`抢票任务`
- `/runs/:runId`：`任务作战台`
- `/nodes`：`节点池`
- `/reports/:baselineRunId/:productionRunId`：`校准复盘`

`/runs` 页面中的任务表单目前分为以下几个区块：

- `基础参数`
- `场次信息`
- `票档目标`
- `节点策略`
- `执行策略`

任务页上的主要操作按钮为：

- `保存任务草稿`
- `创建并规划`
- `创建、规划并启动`

## 运行时 API

控制台直接对接 `load-control` 的运行时接口。

核心控制接口：

- `GET /control/node-pools`
- `GET /control/templates`
- `GET /control/nodes`
- `GET /control/runs`
- `GET /control/runs/:runId`
- `POST /control/runs`
- `POST /control/runs/:runId/plan`
- `POST /control/runs/:runId/start`
- `POST /control/runs/:runId/stop`
- `GET /control/reports/calibration/:baselineRunId/:productionRunId`

实时运行相关接口：

- `GET /control/runs/:runId/live`
- `GET /control/runs/:runId/stream`

当前 Agent 对目标系统执行的真实 HTTP workflow 为：

- `POST /api/auth/session/bootstrap`
- `GET /api/viewers`
- `POST /api/viewers`
- `GET /api/catalog/events`
- `GET /api/catalog/events/:eventId`
- `POST /api/orders/draft`

## 配置说明

`apps/admin` 会按照以下顺序解析 `load-control` 的基础地址：

1. `window.localStorage['load-testing.operator.base-url']`
2. `VITE_LOAD_CONTROL_BASE_URL`
3. 默认值 `http://localhost:3001/control`

本地全栈联调时，最关键的环境变量是：

- `LOAD_CONTROL_BASE_URL`
- `VITE_LOAD_CONTROL_BASE_URL`
- `LOAD_TEST_INTERNAL_SECRET`
- `LOAD_TEST_AGENT_ACCOUNT_PREFIX`
- `DATABASE_URL`
- `LOAD_CONTROL_DATABASE_URL`
- `REDIS_URL`

## 本地栈启动脚本

本地最快的启动方式是：

```powershell
.\start-local-stack.cmd --no-browser
```

这个启动器会转入 `scripts/start-local-stack.ps1` 与 `scripts/local-stack.common.ps1`。当前启动流程已经固定为：

1. 确保 `.env` 存在
2. 从 `.env.example` 回填缺失配置项
3. 通过 `docker compose` 启动 `Postgres` 与 `Redis`
4. 等待两个基础设施都真正 ready
5. 如果缺失 `node_modules`，自动补装依赖
6. 对 `api` 与 `load-control` 执行非交互的 Prisma generate / migrate
7. 执行 API demo 数据与 load-control 持久化目录的 seed
8. 在 reseed 后清理 `load-control:*` Redis 键
9. 启动 `api`、`load-control`、`admin`

配套脚本包括：

- `.\status-local-stack.cmd`
- `.\stop-local-stack.cmd`

本地栈运行状态会写入 `.codex-temp/local-stack`，日志位于：

- `.codex-temp/local-stack/logs/api.out.log`
- `.codex-temp/local-stack/logs/api.err.log`
- `.codex-temp/local-stack/logs/load-control.out.log`
- `.codex-temp/local-stack/logs/load-control.err.log`
- `.codex-temp/local-stack/logs/admin.out.log`
- `.codex-temp/local-stack/logs/admin.err.log`

## 预置本地数据

本地栈启动后会自动得到以下预置数据：

- `apps/load-control` 中持久化的节点池与任务模板
- `apps/api` 中一个已发布的样例演出与场次
- 一个预置 draft run：`run-local-demo-01`

这意味着操作人员可以直接：

1. 启动本地栈
2. 打开 `/runs`
3. 查看或复制预置模板
4. 无需手工补全大量样例数据就能直接规划或启动任务

## 本地端到端 Smoke

当前 handoff smoke 的标准路径为：

1. 从空 Docker volume 启动本地栈
2. 向 `load-control` 注册本地 Agent
3. 创建一条 fresh run
4. 规划 run
5. 启动 run
6. 让 Agent 对 `apps/api` 执行真实 HTTP workflow
7. 确认 summary 与 live telemetry 都已持久化

最新一次已验证的 fresh smoke 基线记录于 `2026-04-21`：

- run id：`run-handoff-smoke-20260421234408`
- 最终状态：`COMPLETED`
- assignment 数：`1`
- summary 数：`1`
- phase 成功结果：`18 / 18`
- 生成订单数：`6`

## 推荐操作流程

1. 打开 `/overview` 确认整体栈状态正常
2. 打开 `/runs`，选择一个预置模板
3. 补充或调整 `场次信息`、`票档目标`、`节点策略`、`执行策略`
4. 先保存草稿，或者直接规划
5. 启动任务后切换到 `/runs/:runId`
6. 观察节点实时状态、当前 phase、聚合指标与 summary 回传情况
7. 比较基线与生产近似任务时，进入 `/reports/...` 查看复盘结果

## 验证命令

可用于交接基线确认的命令如下：

```powershell
corepack pnpm --filter api exec jest --runInBand
corepack pnpm --filter load-control exec jest --runInBand
corepack pnpm --filter @ticketing/contracts test -- --runInBand
corepack pnpm exec tsc -p apps/api/tsconfig.json --noEmit
corepack pnpm exec tsc -p apps/load-control/tsconfig.json --noEmit
corepack pnpm exec vitest run apps/admin/src tests/workspace/repo-layout.spec.ts --reporter=verbose
corepack pnpm exec vitest run tests/workspace/local-stack-launchers.spec.ts --reporter=verbose
corepack pnpm --filter admin build
```

## 常见排查

- 如果 fresh run 在规划阶段报 node foreign-key 错误，优先确认当前 `ControlService` 已包含“先持久化节点再写 assignment”的改动
- 如果 `POST /control/runs` 或 telemetry 写入返回 `400`，优先检查请求体是否满足合约；当前 Zod 校验失败已经明确以客户端错误返回
- 如果 reseed 后看到的模板或运行态仍旧像旧数据，优先重新通过本地启动器重启，让 Redis 清理逻辑重新执行
- 如果 Agent 从 `apps/api` 收到 `401 Unauthorized`，优先确认 API 与 Agent 使用的是同一个 `LOAD_TEST_INTERNAL_SECRET`
- 如果高并发下第一次 bootstrap 出现抖动，优先确认当前分支已经带上 bootstrap 去重与 fallback 逻辑

## 当前产品边界

当前交接边界限定为：

- `apps/admin`
- `apps/load-control`
- `apps/api`
- `packages/contracts`
