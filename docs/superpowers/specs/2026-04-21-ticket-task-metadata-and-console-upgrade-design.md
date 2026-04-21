# 抢票任务元数据与控制台升级设计说明

## 背景

控制台已经完成第一轮中文化，但仍有两个明显缺口：

1. 默认模板、节点池与本地 seed 数据还偏技术夹具风格，不像真实抢票任务
2. 任务创建页仍然更像“run 表单改名版”，还没有成为真正的抢票任务配置器

因此这一轮设计的目标，是在不改动底层 run lifecycle 和控制面 API 的前提下，引入结构化 `ticketTask` 元数据，并用它来提升任务创建、任务列表与任务作战台的业务语义。

## 目标

1. 为 run definition 增加结构化 `ticketTask`
2. 让默认模板与节点池使用更贴近真实演练的中文名称
3. 让任务创建页直接围绕场次、票档、节点策略、执行策略配置
4. 在任务列表与任务作战台中展示新的抢票任务摘要
5. 保持既有 create / plan / start / stop / live snapshot / report 流程不变

## 非目标

1. 账号池管理
2. 厂商专属票务适配器
3. 浏览器自动化链路
4. 另起一套新的顶层 task 资源来替代现有 run

## 已批准数据模型

`LoadTestRunDefinition` 保留既有字段，并新增一个结构化 `ticketTask` 对象。

### ticketTask

`ticketTask` 由四部分组成：

1. `event`
   描述演练目标场次的业务上下文
2. `ticket`
   描述票档、数量与价格区间等目标信息
3. `nodeStrategy`
   描述节点池、锚点、边缘节点与角色意图
4. `executionStrategy`
   描述目标模式、验证模式、phase 选择与阈值

## 控制台升级方向

### 默认模板与节点池

默认模板与默认节点池不应再呈现“技术 demo”的命名方式，而应直接体现：

1. 演练对象是什么
2. 使用什么节点池
3. 目标是首发冲击、复盘、校准还是线上灰度验证

### 任务创建页

任务创建页应按以下结构组织：

1. `基础参数`
2. `场次信息`
3. `票档目标`
4. `节点策略`
5. `执行策略`

操作员填写完成后，页面将其映射回既有的 run definition 结构，从而复用当前控制面 API。

### 任务列表与作战台

任务列表和作战台需要展示更业务化的摘要，例如：

1. 目标场次
2. 票档与票量
3. 节点池与模式
4. 当前执行状态

## 验收标准

本轮设计通过以下结果判定成立：

1. `ticketTask` 合约可以被共享包校验
2. 本地默认模板与 seed 数据读起来像真实抢票演练
3. 控制台能创建、展示并复用新的任务元数据
4. 现有 run lifecycle 与控制面接口不需要重写

## 相关文档

- [2026-04-21-ticket-task-metadata-and-console-upgrade-implementation.md](../plans/2026-04-21-ticket-task-metadata-and-console-upgrade-implementation.md)
- [2026-04-18-load-testing-saas-operator-guide.md](../guides/2026-04-18-load-testing-saas-operator-guide.md)
