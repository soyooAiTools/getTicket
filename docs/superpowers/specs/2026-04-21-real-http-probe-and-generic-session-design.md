# Real HTTP Probe 与通用会话链路设计说明

## 背景

在这轮设计开始前，load-testing 栈已经能够完成以下流程：

1. 启动控制面
2. 创建 run
3. 规划 run
4. 执行 Agent
5. 推送实时遥测
6. 完成 run 并持久化 summary

但当时 Agent 仍然依赖 stub probe，只会返回 synthetic success，因此整套系统本质上还是“控制面烟雾测试”，而不是针对样例票务后端的真实端到端压测路径。

与此同时，`apps/api` 里还保留着较重的特定平台登录 / 支付语义，例如：

1. 登录链路依赖 WeChat 风格接口
2. 支付 intent 与回调仍然是 WeChat JSAPI 语义
3. 环境变量、合约与命名里还残留 `WECHAT_*`

这会同时带来两个问题：

1. Agent 无法通过真实业务 HTTP 路径施压
2. 样例后端对特定平台强绑定，不利于本地、预发与受控演练场景复用

## 目标

本轮设计要达成：

1. 让 Agent 对 `apps/api` 发起真实 HTTP 请求
2. 支持稳定的一期 workflow：
   `session bootstrap -> viewers -> catalog events -> event detail -> draft order`
3. 用通用内部会话 bootstrap 替代 WeChat 专属登录
4. 把样例支付模块改成 provider-neutral 的 payment intent sandbox
5. 保持现有 control-plane 生命周期、phase planner、telemetry 与报告模型不变

## 非目标

本轮不做：

1. 浏览器自动化 Agent
2. 真实第三方认证接入
3. 完整客户注册产品流程
4. 将 load-control phase 模型重构成 step graph
5. 账号池管理 UI
6. 在第一版真实 HTTP probe 中引入支付压测

## 已批准方案

### 推荐方案

采用“内部 session bootstrap + 有状态 HTTP workflow probe”的组合。

这样做的好处是：

1. 不需要推翻现有 run lifecycle
2. 能把 synthetic success 升级为真实后端流量
3. 能让本地与预发压测保持稳定、可控、可复现
4. 能让认证路径脱离外部平台依赖

### 放弃的替代方案

以下路径在本轮被明确放弃：

1. 继续保留 stub probe，只在 summary 里伪造业务结果
2. 直接引入浏览器自动化，把真实 UI 作为第一阶段执行器
3. 继续沿用 WeChat 风格登录与支付语义，仅在命名层面“弱化品牌感”

## 目标工作流

一期真实 workflow 为：

1. `POST /api/auth/session/bootstrap`
2. `GET /api/viewers`
3. 如果缺少目标 viewer，则 `POST /api/viewers`
4. `GET /api/catalog/events`
5. `GET /api/catalog/events/:eventId`
6. `POST /api/orders/draft`

Agent 在 phase 周期内重复执行该链路，并上报 telemetry 与最终 summary。

## API 侧设计

### 通用会话 bootstrap

新增专门面向内部压测和本地联调的 session bootstrap 接口，用来：

1. 按 `accountKey` 获取或创建样例 customer
2. 下发可复用的 bearer token
3. 让 Agent 在没有外部平台前置动作的情况下稳定进入业务链路

### 通用支付样例流程

支付模块保留为“样例可运行”状态，但从命名和合约上转为 provider-neutral 的 payment intent sandbox。这样既能保留演示和联调价值，也不会把真实第三方平台接入强行耦合到压测主路径中。

## Agent 侧设计

`HttpWorkflowProbe` 负责维护会话状态，并执行上述真实 HTTP workflow。它需要处理：

1. token 缓存与复用
2. `401 Unauthorized` 后清理 token 并在下一次重新 bootstrap
3. viewer 不存在时的创建逻辑
4. catalog 或 draft order 失败时的错误上报

## 验收标准

本轮设计的验收标准包括：

1. fresh local stack 下可以成功创建、规划并启动真实 HTTP run
2. Agent summary 能落库
3. `api` 与 `load-control` 错误日志保持干净
4. 现有控制台、作战台与复盘视图无需因 probe 切换而重写

## 相关文档

- [2026-04-21-real-http-probe-and-generic-session-implementation.md](../plans/2026-04-21-real-http-probe-and-generic-session-implementation.md)
- [2026-04-21-load-testing-saas-engineering-handoff.md](../guides/2026-04-21-load-testing-saas-engineering-handoff.md)
