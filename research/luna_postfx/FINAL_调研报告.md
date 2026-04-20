# Unity Luna 未支持后处理扩展调研报告

## 摘要
结论很明确：`Luna 7.1.0 不能直接承载 Unity 原生完整后处理栈`，但可以通过“官方支持项 + 替代实现 + HTML/JS 注入”三层方案，把大多数常见后处理需求做成可上线版本。

## 1. 核心判断

### 1.1 官方支持边界
截至我本次核验的官方文档，Unity Playworks / Luna 对 URP 的支持边界是：

- `Post Processing = No`
- 真正官方承认的 Post Effects 只有：
  - `SSAO`
  - `CSS Filters`

这意味着：

- `Bloom`
- `Depth of Field`
- `Motion Blur`
- `Chromatic Aberration`
- `Lens Distortion`
- `Vignette`

都不能按“Unity 原生后处理照搬”来规划。

## 2. 本地插件与样本产物结论

### 2.1 插件包内部证据
你提供的 `Soyoo-Luna_7.1.0.zip` 解包后，我确认到几条很关键的本地证据：

1. `config.json` 的 `postprocesses` 节点里只有 `ssao`
2. `supported-packages.json` 里没有 Post Processing / URP Volume 相关 package 白名单
3. `release-notes.json` 中 7.1.0 重点是：
   - `URP Render Objects support`
   - `Add warning for URP SSAO usage`
4. HTML 模板的 `filters.pug` 直接对 `#application-canvas` 执行 CSS `filter`

这说明 7.1.0 的产品方向不是“开放完整后处理”，而是：

- 支持一小部分官方后处理
- 提供 CSS Filter
- 提供 Render Objects 这类替代型渲染能力

### 2.2 打包产物证据
你给的 `打包后文件.html` 里，我确认到了稳定挂点：

- 存在 `canvas id="application-canvas"`
- 启动代码明确把这个 canvas 传给 `new LunaUnity.Application(...)`

这很重要，因为它意味着即便最终产物没有保留 Luna 模板中的所有内部滤镜钩子，我们依然可以在产物层对 canvas 叠加：

- CSS filters
- DOM overlay
- 自定义 JS 控制逻辑

## 3. 最可行的三层方案

### 方案 A：打包前，优先走官方支持路径
这是最推荐的主路线。

#### 可直接使用
- `SSAO`
- `CSS Filters`
- `Render Objects`
- `Bridge.Script.Write()`
- `External JS Libraries`

#### 适合解决的问题
- SSAO：直接走官方支持
- 全局色调：亮度、对比度、饱和度、色相、黑白、复古
- Outline / X-Ray / Silhouette：Render Objects
- 暗角 / 噪点 / 屏幕染色：外部 JS + DOM overlay

### 方案 B：把“后处理”改写成“伪后处理”
这是第二推荐路线，适合大多数手游试玩广告。

#### 建议映射
| 目标效果 | 推荐替代 |
|---|---|
| Bloom / Glow | 发光材质 + Halo Sprite + Additive Pass |
| Vignette | UI 全屏贴图 或 HTML radial-gradient overlay |
| Film Grain | 半透明噪点贴图 / DOM noise overlay |
| Color Grading | CSS Filters + 材质色调参数 |
| Outline | Render Objects |
| X-Ray | Render Objects + Stencil / Override Material |
| Chromatic Aberration | 轻量 DOM overlay 或边缘彩偏贴图 |
| Lens Distortion | 局部 shader 近似，不做全屏真畸变 |
| DOF | 不建议做真景深，改成前景/背景模糊资源分层 |
| Motion Blur | 不建议做真全屏 motion blur，改用 Trail / 残影 |

### 方案 C：打包后，对 HTML 做最小补丁
这是第三层兜底方案，适合：

- 最终导出的 playable 已经生成
- 你只想做最后一层视觉 polish
- 不想重新改 Unity 工程

#### 能做什么
- 对 `#application-canvas` 直接加 `filter`
- 在 canvas 外再包一层容器
- 在 canvas 上方插入：
  - vignette
  - noise
  - scanline
  - color wash

#### 不建议做什么
- 深改 Luna 核心 JS
- 试图把 Unity 的完整 post stack 反向注入到导出 HTML

## 4. 我给你的推荐实施顺序

### 第 1 阶段：建立稳定基础层
先不要碰复杂特效，先接入一套可复用的 `LunaPostFx` 能力层：

1. 打包前把 `luna-postfx.js` 作为 External JS Library 接入
2. 用 `Bridge.Script.Write()` 或桥接类从 C# 调参数
3. 第一批先做：
   - brightness
   - contrast
   - saturate
   - hue rotate
   - vignette overlay
   - grain overlay

### 第 2 阶段：把项目中依赖原生后处理的效果逐项替换
优先级建议：

1. `Color Adjustments` -> CSS Filters / shader 参数
2. `Vignette` -> overlay
3. `Bloom` -> halo / additive sprite
4. `Outline/X-Ray` -> Render Objects
5. `DOF/Motion Blur` -> 删除或重设计

### 第 3 阶段：仅在必要时对最终 HTML 做补丁
如果平台层调节还不够，再做导出产物补丁，而不是一上来就手改打包结果。

## 5. 风险判断

### 低风险
- SSAO
- CSS Filters
- Render Objects
- DOM overlay
- External JS + Bridge

### 中风险
- 用 shader / UI 做 Bloom、Vignette、Chromatic Aberration 的近似替代

### 高风险
- 完整移植 Unity 原生 Post Processing
- 继续依赖旧 Post Processing package
- 深改 Luna runtime

## 5.2 GPU Instancing 是否支持

结论：`不建议把 GPU Instancing 当成 Luna 可用能力。`

官方当前文档把 `Optimized graphics API (instancing, cbuffers, vertexBuffer partial update)` 明确列在 `Not Supported` 中，这里的 `instancing` 就包含 GPU Instancing 这一类路径。与此同时，官方又单独提供并维护了：

- [Dynamic Batching](https://docs.lunalabs.io/docs/playable/optimise-your-builds/dynamic-batching/)
- [Static Batching](https://docs.lunalabs.io/docs/playable/optimise-your-builds/static-batching/)

这说明 Luna 的推荐优化思路不是依赖 Unity 原生 instancing，而是：

1. 静态物体优先 `Static Batching`
2. 可批对象优先 `Dynamic Batching`
3. 重复物体多时，尽量共享材质、贴图和网格结构
4. 不要把 shader 关键字 `INSTANCING_ON` 当作 Luna 最终构建中的稳定前提

如果你的项目里现在大量依赖 `Enable GPU Instancing` 来控 draw call，那迁移到 Luna 时需要重新评估，不能假设它会按 Unity 原版生效。

## 5.1 你这批效果的逐项判断

| 效果 | 是否建议按原版复刻 | 建议路线 |
|---|---|---|
| Channel Mixer | 否 | CSS Filters + shader 色偏 |
| Chromatic Aberration | 否 | 边缘色偏 overlay / shader |
| Color Curves | 否 | 曲线预设近似 |
| Color Lookup | 否 | LUT 风格近似 |
| Depth Of Field | 否 | 分层模糊 / 假景深 |
| Film Grain | 是，适合替代 | overlay noise |
| Lens Distortion | 否 | 轻度扭曲近似 |
| Motion Blur | 否 | 拖尾 / 残影替代 |
| Shadows, Midtones, Highlights | 否 | 三段调色 preset |
| Split Toning | 是，适合替代 | 双层调色 |
| White Balance | 是，适合替代 | 全局色温参数 |

详细版本见：

- [06_效果映射表.md](D:/CodexFolder/research/luna_postfx/06_效果映射表.md)

## 6. 最终建议
如果你的目标是“让试玩广告看起来更有后处理质感”，最务实的路线不是继续追 Luna 对原生后处理的支持，而是做一套分层方案：

1. 官方支持的 `SSAO + CSS Filters`
2. Render Objects 替代几类伪后处理
3. 自己维护一个 `LunaPostFx` 的 HTML/JS 覆盖层

这条路线的优点是：

- 稳
- 可复用
- 不依赖 Luna 某个未公开内部实现
- 后续版本升级时可维护性最好

## 7. 附带 PoC

- JS 示例：`D:\CodexFolder\research\luna_postfx\examples\post_build_patch_example.js`
- C# 示例：`D:\CodexFolder\research\luna_postfx\examples\LunaPostFxController.cs`

## 参考资料

- [Luna URP 支持矩阵](https://docs.lunalabs.io/docs/playable/getting-started/supported-features/urp/)
- [Luna Post Effects](https://docs.lunalabs.io/docs/playable/getting-started/supported-features/post-effects/)
- [Luna Render Objects](https://docs.lunalabs.io/docs/playable/getting-started/supported-features/urp-render-features/render-objects/)
- [Luna Dev Environment](https://docs.lunalabs.io/docs/playable/code/plugin-in-browser/dev-environment/)
- [Luna Insert JS at Runtime](https://docs.lunalabs.io/docs/playable/code/js-code-insertions/)
- [Luna External JS Libraries](https://docs.lunalabs.io/docs/playable/code/external-js-libraries/)
- [Luna Common Issues - Post Processing package](https://docs.lunalabs.io/docs/playable/common-issues/builds/build-fails-at/)
- [Luna CSS Filters](https://docs.lunalabs.io/docs/playable/unityplayworks/editor/css-filters/)
- [MDN CSS filter](https://developer.mozilla.org/en-US/docs/Web/CSS/filter)
