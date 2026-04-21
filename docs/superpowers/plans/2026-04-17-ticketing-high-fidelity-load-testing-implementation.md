# 票务高保真压测方案实施记录（历史归档）

> 这份文档对应的是 `2026-04-17` 的早期实施方案，已被后续的 Load-Testing SaaS 重构方案取代。之所以保留，是为了让研发团队理解这条产品线最初的设计出发点与第一阶段交付范围。

## 当前状态

- `文档性质`：历史实施记录
- `适用阶段`：SaaS 重构前的第一轮高保真压测闭环建设
- `当前结论`：核心能力已经被吸收进 `apps/load-control`、`apps/admin`、`apps/api` 与 `packages/contracts`
- `建议阅读顺序`：
  1. [2026-04-18-load-testing-saas-reframe-design.md](../specs/2026-04-18-load-testing-saas-reframe-design.md)
  2. [2026-04-21-load-testing-saas-engineering-handoff.md](../guides/2026-04-21-load-testing-saas-engineering-handoff.md)
  3. 本文档

## 原始目标

第一阶段的目标，是先搭出一条最小可闭环的高保真压测系统，用来验证以下能力：

1. 是否能通过独立控制面编排压测任务
2. 是否能由多节点 Agent 执行任务并回传 summary
3. 是否能把预发压测与线上受控验证结果放到同一套校准模型里
4. 是否能在不引入完整可视化控制台的前提下，先把后端链路跑通

当时的重点不是“交付完整 SaaS”，而是尽快证明闭环是成立的。

## 第一阶段交付内容

早期方案最终沉淀出的关键能力包括：

1. 在 `apps/load-control` 中建立独立控制面，负责健康检查、节点注册、run 创建、run 规划、summary 上报与结果查询
2. 在 `packages/contracts` 中建立共享的负载测试合约，让控制面、Agent 与测试使用统一 schema
3. 为 Agent 建立最基础的注册、拉取任务、执行 phase、提交 summary 的生命周期
4. 将 `apps/api` 作为样例被测系统，保留在仓库中用于联调
5. 建立最早一版的校准报告与预发 / 线上结果对比模型

这些内容后来被扩展为当前 SaaS 版本中的：

- 持久化控制面
- 实时遥测聚合
- Battle Station 式运行详情页
- 节点池与任务模板
- 真实 HTTP workflow probe
- 研发与运营共同使用的控制台

## 为什么这份文档被归档

这份早期实施文档在当时是面向“从零搭第一版”的执行计划，因此具备以下特征：

1. 文档篇幅非常长，包含大量逐步拆解的 worker 执行说明
2. 假设前提仍是“先命令行闭环，后控制台重构”
3. 产品边界还带有早期 ticketing platform 的语言痕迹
4. 与当前已经完成的 SaaS 收口版本相比，很多描述已经过时

因此本次中文化时不再保留原始的 1800+ 行逐步执行草稿，而是保留对阶段成果的中文摘要，避免研发团队在交接时被过时实施细节干扰。

## 对当前系统仍然有价值的历史结论

即使它已归档，这份早期方案依然留下了几个对今天仍然成立的判断：

1. 控制面必须独立于被测系统存在，不能和业务后端混在一起
2. 节点执行链路必须有结构化 summary，否则复盘价值不足
3. 合约要前置收敛，否则控制台、控制面、Agent 会快速漂移
4. 预发与线上受控校准必须被设计为同一闭环，而不是两套系统

这些判断后来都延续到了当前交接版本。

## 与当前交付版本的关系

当前研发真正应该关注的是已经完成收口的 SaaS 版本，而不是这份历史执行稿。两者关系可以理解为：

- `2026-04-17` 文档：证明“高保真压测闭环”值得做
- `2026-04-18` 之后的重构文档：把它收敛成真正可交付、可操作、可交接的内部 SaaS

## 相关文档

- [2026-04-17-ticketing-high-fidelity-load-testing-design.md](../specs/2026-04-17-ticketing-high-fidelity-load-testing-design.md)
- [2026-04-18-load-testing-saas-reframe-design.md](../specs/2026-04-18-load-testing-saas-reframe-design.md)
- [2026-04-18-load-testing-saas-reframe-implementation.md](./2026-04-18-load-testing-saas-reframe-implementation.md)
- [2026-04-21-load-testing-saas-engineering-handoff.md](../guides/2026-04-21-load-testing-saas-engineering-handoff.md)
