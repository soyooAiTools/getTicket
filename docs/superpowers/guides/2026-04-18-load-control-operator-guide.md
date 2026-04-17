# load-control 运行与调参指南

这是一份给内部工程同事的 `load-control` 运行说明，目标是让你能在本地或预发环境里把控制面、节点 agent、场景规划和校验报告串起来跑通。

`load-control` 是一个独立的 NestJS 控制面，所有 HTTP 接口都挂在 `/control` 前缀下。它负责接收节点注册、创建 run、按场景拆分并规划分配、接收节点 summary、以及在两个已完成 run 之间生成 calibration report。

## 1. 职责与关键组件

### 控制面

- `apps/load-control/src/main.ts`：启动服务，默认端口是 `3001`，并把全局前缀设为 `/control`。
- `apps/load-control/src/modules/control/control.controller.ts`：提供节点注册、run 创建、run 查询、run 规划和 summary 上传接口。
- `apps/load-control/src/modules/control/control.service.ts`：用内存 `Map` 保存 nodes 和 runs，维护 `DRAFT`、`PLANNED`、`COMPLETED` 状态。
- `apps/load-control/src/modules/scenarios/scenario-engine.service.ts`：把 run 定义和已注册节点转换成按 phase 分配后的 `PlannedNodeAssignment`。
- `apps/load-control/src/modules/validation/validation-policy.service.ts`：对生产验证模式做门禁检查。
- `apps/load-control/src/modules/reports/reports.controller.ts` 和 `scoring.service.ts`：在两个已完成 run 之间生成 calibration report。

### Agent

- `apps/load-control/src/agent/main.ts`：agent CLI 入口，读取环境变量，向控制面注册节点，拉取 run，执行 assignment，再把 summary 回传。
- `apps/load-control/src/agent/agent-runner.ts`：按 phase 窗口重复发请求并聚合 summary。
- `apps/load-control/src/agent/http-control.client.ts`：agent 与控制面的 HTTP 客户端。

当前实现里，agent 的目标探针是本地 stub，不会真的打外部业务接口；它更像是一个闭环验证 harness。要做真实压测，需要把 `TargetProbe` 换成真正的请求实现。

## 2. 本地 / 预发运行前提

1. 先启动 `load-control` 控制面。
2. 先注册节点，再创建 run，再执行 `POST /control/runs/:runId/plan`。
3. agent 只会去找已经被规划到自己 `nodeId` 的 assignment。
4. `load-control` 当前是内存状态，重启会清空已注册节点、run、assignment 和 summary。
5. 生产验证模式在代码里有额外门禁：
   - `OBSERVE_ONLY` 不能带写请求并发。
   - `WHITELIST_FULL_PATH` 和 `GRAY_VALIDATION` 需要 `inventoryPoolId`。
   - 非 `PREPROD` run 需要 `tags.test_run_id`。
   - `GRAY_VALIDATION` 还要求 `maxGlobalQps <= 150`。
   - 写能力生产模式还要求 `LOAD_CONTROL_ALLOW_PRODUCTION_WRITE=true`。

## 3. 关键环境变量

### 控制面

| 变量 | 默认值 | 作用 |
| --- | --- | --- |
| `LOAD_CONTROL_PORT` | `3001` | 控制面监听端口。 |
| `LOAD_CONTROL_ALLOW_PRODUCTION_WRITE` | `false` | 允许 `WHITELIST_FULL_PATH` / `GRAY_VALIDATION` 这两类写能力生产验证模式通过门禁。 |

### Agent

| 变量 | 默认值 | 作用 |
| --- | --- | --- |
| `LOAD_CONTROL_BASE_URL` / `LOAD_CONTROL_URL` | `http://localhost:3001/control` | agent 访问控制面的 base URL。 |
| `LOAD_CONTROL_RUN_ID` / `LOAD_AGENT_RUN_ID` | `run-preprod-1` | agent 要执行的 run ID。 |
| `NODE_ID` / `LOAD_AGENT_NODE_ID` | `node-local` | 节点 ID，和控制面里注册的节点 ID 需要匹配。 |
| `NODE_REGION` / `LOAD_AGENT_REGION` | `hk` | 节点所属区域标签。 |
| `NODE_ROLE` / `LOAD_AGENT_ROLE` | `ANCHOR` | 节点角色，当前支持 `ANCHOR`、`EDGE`、`CONTROL`。 |
| `NODE_PROFILE_ID` / `LOAD_AGENT_NETWORK_PROFILE_ID` | `hk-anchor` | 网络画像 ID。 |
| `NODE_PROFILE_LABEL` / `LOAD_AGENT_NETWORK_PROFILE_LABEL` | `Hong Kong anchor` | 网络画像名称。 |
| `NODE_BASE_LATENCY_MS` / `LOAD_AGENT_BASE_LATENCY_MS` | `18` | 网络画像的基础 RTT。 |
| `NODE_JITTER_MS` / `LOAD_AGENT_JITTER_MS` | `4` | 网络画像的抖动值。 |
| `NODE_PACKET_LOSS_RATIO` / `LOAD_AGENT_PACKET_LOSS_RATIO` | `0.002` | 网络画像的丢包率。 |
| `NODE_MAX_CONCURRENCY` / `LOAD_AGENT_MAX_CONCURRENCY` | `180` | 节点可承载的最大并发。 |

### 备注

- `.env.example` 里还有 `LOAD_CONTROL_REGION`，但当前 `load-control` 启动代码没有读取它。
- `NODE_*` 和 `LOAD_AGENT_*` 是双写兼容别名，优先级由代码里 `readEnv` 的顺序决定。

## 4. 关键语义

### `maxGlobalQps`

`maxGlobalQps` 不是一个运行时硬限流器，而是规划阶段的总预算上限。

在 `ScenarioEngineService.planRun()` 里，单个 phase 的预算会取这三者的最小值：

1. 该 phase 下四个 pool 的总并发
2. `run.maxGlobalQps`
3. 所有节点的并发上限之和

然后这个预算会先按节点 `maxConcurrency` 分配，再按 `query`、`queuePolling`、`inventoryLock`、`orderSubmission` 四个 pool 分配。

实操上，这意味着：

- `maxGlobalQps` 调高，不会自动让 agent 跑得更快，只会影响规划时能分到多少并发。
- 真正的请求节奏，还会被 `workerLaunchIntervalMs` 和 phase window 一起决定。

### `workerLaunchIntervalMs`

`workerLaunchIntervalMs` 是 `AgentRunner` 里每个 worker 两次 launch 之间的间隔，默认是 `1000ms`。

它的实际效果是：

- 每个 worker 在 phase window 里会持续重复发请求；
- 间隔越小，同一窗口里发出的请求次数越多；
- 间隔越大，窗口内请求密度越低。

当前 CLI 入口没有把它暴露成环境变量，所以本地改这个值要么改测试 harness，要么自己封装 runner。

### phase window

phase window 由 `startsAtOffsetMs` 和 `durationMs` 定义：

- `startsAtOffsetMs` 是相对于 assignment 开始时间的偏移；
- `durationMs` 是这个 phase 的持续时长；
- 每个 phase 的结束时间是 `phaseStartAtMs + durationMs`。

`AgentRunner` 会按 phase start offset 排序启动，但允许 phase 之间重叠。只要当前时间还没到窗口末尾，worker 就会继续 launch。

这意味着 phase 不是“发固定数量请求”，而是“在固定时间窗里尽量持续发请求”。

### summary / report gating

控制面对结果和报告都有明确门禁：

- `POST /control/runs/:runId/results` 会校验 summary 的 `runId`、`nodeId` 和 phase 列表是否与 assignment 一致。
- summary 里不能漏 phase、不能多 phase、不能重复 phase。
- 只有当一个 run 的所有已分配节点都回传了 summary，run 才会变成 `COMPLETED`。
- `GET /control/reports/calibration/:baselineRunId/:productionRunId` 只接受两个都已经 `COMPLETED` 的 run。
- `ScoringService` 还要求 baseline 和 production 都真的有 recorded summaries，否则会拒绝生成 report。

## 5. 推荐的本地验证命令

### 启动控制面

```powershell
corepack pnpm --filter load-control dev
```

默认访问地址：

- 健康检查：`GET http://localhost:3001/control/health`
- 节点注册：`POST http://localhost:3001/control/nodes/register`
- 创建 run：`POST http://localhost:3001/control/runs`
- 规划 run：`POST http://localhost:3001/control/runs/:runId/plan`
- 回传 summary：`POST http://localhost:3001/control/runs/:runId/results`
- 取 calibration report：`GET http://localhost:3001/control/reports/calibration/:baselineRunId/:productionRunId`

### 运行 agent

```powershell
corepack pnpm --filter load-control dev:agent
```

运行前请先保证：

- 控制面里已经注册了和 `NODE_ID` 一致的节点；
- 目标 run 已经创建并完成规划；
- `LOAD_CONTROL_RUN_ID` 指向正确的 run。

### 回归验证

```powershell
corepack pnpm --filter load-control test
corepack pnpm --filter load-control test:e2e
corepack pnpm exec vitest run tests/perf/load-testing-fixtures.spec.ts
corepack pnpm test
```

建议的最小闭环顺序是：

1. `corepack pnpm --filter load-control dev`
2. `POST /control/nodes/register`
3. `POST /control/runs`
4. `POST /control/runs/:runId/plan`
5. `corepack pnpm --filter load-control dev:agent`
6. `GET /control/runs/:runId`
7. `GET /control/reports/calibration/:baselineRunId/:productionRunId`

## 6. 常见调参建议

1. 如果规划出来的 assignment 看起来“太轻”，优先检查 `maxGlobalQps`、`maxNodeConcurrency` 和节点自身的 `maxConcurrency`，因为 planner 会取最小可用预算。
2. 如果你想增加 phase 压力，优先增加 phase 的并发配置，而不是先把 `workerLaunchIntervalMs` 调得特别小。
3. 如果希望窗口内请求更密，可以缩短 `workerLaunchIntervalMs`，但这会更快吃满节点和全局预算，容易掩盖真实瓶颈。
4. 如果要跑 `GRAY_VALIDATION`，先把 `LOAD_CONTROL_ALLOW_PRODUCTION_WRITE=true` 配好，再确认 `inventoryPoolId`、`tags.test_run_id` 和 `maxGlobalQps <= 150`。
5. 如果 summary 上传被拒绝，先看是不是 phase 列表不完整，或者 `nodeId` 并不是当前 run 的 assignment 节点。
6. 如果 report 生成失败，先确认 baseline / production 两个 run 都已经 `COMPLETED`，并且确实有 recorded summaries。

## 7. 注意事项

- 这个服务现在没有持久化层，重启就会丢失 run 和 summary。
- 当前 agent CLI 只验证控制流，不验证真实外部流量。
- `LOAD_CONTROL_REGION` 目前是环境模板字段，不是运行时依赖。
- 生产验证模式必须先在组织流程上确认窗口、白名单和资源隔离，再去跑命令。

